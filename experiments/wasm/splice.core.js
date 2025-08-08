// splice.core.js — your JS façade over Wasm
import initWasm, { WasmRuntime } from './splice_core/pkg/splice_core.js';

// Keep action names and ids aligned with splice.js
export const ACTION_IDS = Object.freeze({
  get: 1, set: 2, call: 3, delete: 4, transform: 5, clone: 6, observe: 7, define: 8,
});
const MAX_ACTION_ID = 8;

// Map object type to a stable index
// Order must match what you pass to WasmRuntime.new(object_count,...)
const OBJECTS = ['Object', 'Array', 'String', 'Number', 'Boolean'];
const OBJECT_INDEX = OBJECTS.reduce((acc, name, idx) => (acc[name] = idx, acc), {});
function getObjectId(obj) {
  if (Array.isArray(obj)) return OBJECT_INDEX.Array;
  switch (typeof obj) {
    case 'string': return OBJECT_INDEX.String;
    case 'number': return OBJECT_INDEX.Number;
    case 'boolean': return OBJECT_INDEX.Boolean;
    case 'object': return OBJECT_INDEX.Object;
    default: return OBJECT_INDEX.Object;
  }
}

export class SpliceRuntime {
  constructor(wrt) {
    this._wrt = wrt;
    this._listeners = new Map();            // actionId -> [fn]
    this._handlers = Object.create(null);   // JS-side handlers (optional fallback)
  }

  // Optional: register JS handler (when no native one is present)
  registerAction(objectName, actionName, fn) {
    const objId = OBJECT_INDEX[objectName];
    const actId = ACTION_IDS[actionName];
    if (objId == null || actId == null) return;
    this._handlers[objId] ||= Object.create(null);
    this._handlers[objId][actId] = fn;
  }

  // Subscribe to an action (by id or name)
  onSignal(actionKey, fn) {
    const actionId = typeof actionKey === 'string' ? ACTION_IDS[actionKey] : actionKey;
    if (actionId == null) return () => {};
    const list = this._listeners.get(actionId) || [];
    list.push(fn);
    this._listeners.set(actionId, list);
    return () => {
      const arr = this._listeners.get(actionId) || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }

  emitSignal(actionId, frame, error) {
    const list = this._listeners.get(actionId);
    if (!list) return;
    for (let i = list.length; i--;) {
      try { list[i](frame, error); } catch {}
    }
  }

  // The hot path: route to Wasm if native handler exists; else fall back to JS handler if provided.
  dispatchSignal(actionName, object, payload) {
    const actionId = ACTION_IDS[actionName];
    const objId = getObjectId(object);
    const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload || []);

    // Call Wasm first
    const result = this._wrt.dispatch_u8(objId, actionId, bytes);

    // Emit to subscribers
    const frame = { header: null, object, payload, result };
    this.emitSignal(actionId, frame, undefined);
    return result;
  }

  get metrics() {
    return { frames: this._wrt.frames, dispatched: this._wrt.dispatched };
  }
}

// Boot helper
export async function createRuntime() {
  await initWasm();
  // object_count = OBJECTS.length, max_action_id = MAX_ACTION_ID, pool_size = 8
  const wrt = new WasmRuntime(OBJECTS.length, MAX_ACTION_ID, 8);

  // Register native handlers: Echo on Object:call for demo
  wrt.register_builtin(OBJECT_INDEX.Object, ACTION_IDS.call, 0);

  return new SpliceRuntime(wrt);
}
