use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use js_sys::{Function, Reflect, Object};
use serde::{Serialize, Deserialize};
use serde_wasm_bindgen::from_value;
use std::cell::RefCell;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(a: &JsValue);
}

#[derive(Clone, Copy, Debug)]
enum BuiltinKind {
    Echo,
    Logger,
}

#[derive(Clone)]
struct Signal {
    object_type: String,
    action_id: String,
    payload: Vec<u8>,
}

thread_local! {
    static SIGNAL_QUEUE: RefCell<Vec<Signal>> = RefCell::new(Vec::new());
}

fn action_id_from_name(name: &str) -> Option<u8> {
    match name {
        "get" => Some(1),
        "set" => Some(2),
        "call" => Some(3),
        "delete" => Some(4),
        "transform" => Some(5),
        "clone" => Some(6),
        "observe" => Some(7),
        "define" => Some(8),
        _ => None,
    }
}

#[derive(Default, Serialize, Deserialize)]
struct Metrics {
    frames: u64,
    dispatched: u64,
    errors: u64,
    signals: u64,
}

#[derive(Clone)]
struct Context {
    header: [u8; 3],
    object_type: String,
    payload: JsValue,
    result_value: JsValue,
}

impl Context {
    fn to_js(&self) -> JsValue {
        let o = Object::new();
        let frame = Object::new();
        Reflect::set(&frame, &"header".into(), &js_sys::Uint8Array::from(&self.header[..]).into()).ok();
        Reflect::set(&frame, &"object".into(), &JsValue::from_str(&self.object_type)).ok();
        Reflect::set(&frame, &"payload".into(), &self.payload).ok();
        Reflect::set(&o, &"frame".into(), &frame).ok();
        Reflect::set(&o, &"actionId".into(), &JsValue::from_f64((self.header[0] & 0x0F) as f64)).ok();
        Reflect::set(&o, &"stateCode".into(), &JsValue::from_f64(self.header[1] as f64)).ok();
        Reflect::set(&o, &"resultCode".into(), &JsValue::from_f64(self.header[2] as f64)).ok();
        Reflect::set(&o, &"resultValue".into(), &self.result_value).ok();
        o.into()
    }
}

enum HandlerKind {
    RustEcho,
    Js(Function),
}

#[wasm_bindgen]
pub struct WasmRuntime {
    object_index: HashMap<String, usize>,
    max_action_id: usize,
    handlers: Vec<Vec<Option<HandlerKind>>>, 
    subs: HashMap<u8, Vec<Function>>,
    metrics: Metrics,
    logger_level: Option<String>,
    fallback: Option<Function>,
}

#[wasm_bindgen]
impl WasmRuntime {
    #[wasm_bindgen(constructor)]
    pub fn new(object_list: JsValue, max_action_id: u32) -> WasmRuntime {
        let objects: Vec<String> = from_value(object_list).unwrap_or_else(|_| vec!["Object".into(), "Array".into()]);
        let mut object_index = HashMap::new();
        for (i, name) in objects.iter().enumerate() {
            object_index.insert(name.clone(), i);
        }
        let obj_count = objects.len();
        let max_a = max_action_id as usize;

        let mut handlers = Vec::with_capacity(obj_count);
        for _ in 0..obj_count {
            handlers.push((0..=max_a).map(|_| None).collect());
        }

        WasmRuntime {
            object_index,
            max_action_id: max_a,
            handlers,
            subs: HashMap::new(),
            metrics: Metrics::default(),
            logger_level: None,
            fallback: None,
        }
    }
    pub fn use_logger(&mut self, level: Option<String>) {
        self.logger_level = level;
    }
    pub fn register_builtin(&mut self, object_type: &str, action_name: &str, kind: &str) -> Result<(), JsValue> {
        let action_id = action_id_from_name(action_name).ok_or_else(|| JsValue::from_str("Unknown action"))? as usize;
        let obj = *self.object_index.get(object_type).ok_or_else(|| JsValue::from_str("Unknown object type"))?;
        let hk = match kind {
            "Echo" | "echo" => HandlerKind::RustEcho,
            _ => return Err(JsValue::from_str("Unsupported builtin kind")),
        };
        self.handlers[obj][action_id] = Some(hk);
        Ok(())
    }
    pub fn register_js_handler(&mut self, object_type: &str, action_name: &str, func: Function) -> Result<(), JsValue> {
        let action_id = action_id_from_name(action_name).ok_or_else(|| JsValue::from_str("Unknown action"))? as usize;
        let obj = *self.object_index.get(object_type).ok_or_else(|| JsValue::from_str("Unknown object type"))?;
        self.handlers[obj][action_id] = Some(HandlerKind::Js(func));
        Ok(())
    }
    pub fn set_fallback(&mut self, func: Option<Function>) {
        self.fallback = func;
    }
    pub fn subscribe(&mut self, action_key: JsValue, callback: Function) -> Result<(), JsValue> {
        let id = if action_key.is_string() {
            let s = action_key.as_string().unwrap();
            action_id_from_name(&s).ok_or_else(|| JsValue::from_str("Unknown action"))?
        } else {
            (action_key.as_f64().ok_or_else(|| JsValue::from_str("Invalid action key"))?) as u8
        };
        self.subs.entry(id).or_default().push(callback);
        Ok(())
    }
    pub fn emit_signal(&self, action_key: JsValue, data: JsValue) -> Result<(), JsValue> {
        let id = if action_key.is_string() {
            let s = action_key.as_string().unwrap();
            action_id_from_name(&s).ok_or_else(|| JsValue::from_str("Unknown action"))?
        } else {
            (action_key.as_f64().ok_or_else(|| JsValue::from_str("Invalid action key"))?) as u8
        };
        if let Some(list) = self.subs.get(&id) {
            for cb in list {
                let _ = cb.call1(&JsValue::NULL, &data);
            }
        }
        Ok(())
    }
    pub fn dispatch_signal(&mut self, action_name: &str, object_type: &str, payload: JsValue) -> Result<JsValue, JsValue> {
        let action_id = action_id_from_name(action_name).ok_or_else(|| JsValue::from_str("Unknown action"))? as usize;
        let obj = *self.object_index.get(object_type).ok_or_else(|| JsValue::from_str("Unknown object type"))?;
        self.metrics.frames += 1;

        let mut ctx = Context {
            header: [0x80 | (action_id as u8), 0xA0, 0], // END|actionId, READY, SUCCESS
            object_type: object_type.to_string(),
            payload: payload.clone(),
            result_value: JsValue::UNDEFINED,
        };

        // find handler
        let result = match self.handlers[obj][action_id].as_ref() {
            Some(HandlerKind::RustEcho) => {
                // Expect first 4 bytes of payload => little-endian u32
                if let Some(u8arr) = payload.dyn_ref::<js_sys::Uint8Array>() {
                    if u8arr.length() >= 4 {
                        let b0 = u8arr.get_index(0);
                        let b1 = u8arr.get_index(1);
                        let b2 = u8arr.get_index(2);
                        let b3 = u8arr.get_index(3);
                        let val = (b0 as u32) | ((b1 as u32) << 8) | ((b2 as u32) << 16) | ((b3 as u32) << 24);
                        ctx.result_value = JsValue::from_f64(val as f64);
                        Ok(ctx.result_value.clone())
                    } else {
                        ctx.header[2] = 60; // FAILURE
                        self.metrics.errors += 1;
                        Ok(JsValue::from_f64(0.0))
                    }
                } else {
                    ctx.header[2] = 60;
                    self.metrics.errors += 1;
                    Ok(JsValue::from_f64(0.0))
                }
            }
            Some(HandlerKind::Js(func)) => {
                // Pass a JS "contextFrame" object similar to splice.html
                let frame = ctx.to_js();
                match func.call1(&JsValue::NULL, &frame) {
                    Ok(v) => {
                        ctx.result_value = v.clone();
                        Ok(v)
                    }
                    Err(e) => {
                        ctx.header[2] = 60; // FAILURE
                        self.metrics.errors += 1;
                        Err(e)
                    }
                }
            }
            None => {
                if let Some(fb) = &self.fallback {
                    let frame = ctx.to_js();
                    match fb.call1(&JsValue::NULL, &frame) {
                        Ok(v) => {
                            ctx.result_value = v.clone();
                            Ok(v)
                        }
                        Err(e) => {
                            ctx.header[2] = 60;
                            self.metrics.errors += 1;
                            Err(e)
                        }
                    }
                } else {
                    ctx.header[2] = 60;
                    self.metrics.errors += 1;
                    Ok(JsValue::UNDEFINED)
                }
            }
        };

        // Notify subscribers
        if let Some(list) = self.subs.get(&((action_id as u8))) {
            let frame = ctx.to_js();
            for cb in list {
                let _ = cb.call1(&JsValue::NULL, &frame);
            }
        }

        self.metrics.dispatched += 1;
        if let Some(level) = &self.logger_level {
            if level == "info" {
                log(&JsValue::from_str("dispatch done"));
            }
        }
        result
    }
    pub fn metrics(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.metrics).unwrap()
    }
    pub fn get_summary(&self) -> String {
        let handlers_count: usize = self.handlers.iter().map(|row| row.iter().filter(|h| h.is_some()).count()).sum();
        format!("{} handlers, {} signals, {} frames, {} dispatched, {} errors",
            handlers_count, self.metrics.signals, self.metrics.frames, self.metrics.dispatched, self.metrics.errors)
    }
    pub fn on_signal(&mut self, action_name: &str, cb: Function) -> Result<(), JsValue> {
        self.subscribe(JsValue::from_str(action_name), cb)
    }
    pub fn emit_signal_by_name(&self, action_name: &str, data: JsValue) -> Result<(), JsValue> {
        self.emit_signal(JsValue::from_str(action_name), data)
    }
}
