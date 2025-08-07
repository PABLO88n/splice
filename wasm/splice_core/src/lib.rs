mod context;
mod runtime;
mod frame;
mod plugins;

use wasm_bindgen::prelude::*;
use runtime::{SignalRuntime};
use plugins::echo::EchoPlugin;
use std::sync::OnceLock;

static RUNTIME: OnceLock<SignalRuntime> = OnceLock::new();

#[wasm_bindgen]
pub fn init_runtime() {
    let mut rt = SignalRuntime::new();
    rt.register(300, Box::new(EchoPlugin));
    RUNTIME.set(rt).ok();
}

#[wasm_bindgen]
pub fn process_frame_wasm(frame: &[u8]) -> u32 {
    let runtime = RUNTIME.get().expect("Runtime not initialized");
    frame::process_frame(frame, runtime).unwrap_or(0)
}
