//───\ Helpers \──────────────────────────────────────────────────────────────|
const _OF = obj => Object.freeze(obj);
const _MAP_FREEZE = map => {
    const arr = Array.from(map.values());
    const arrLen = arr.length;
    for (let i = arrLen; i--; ) {
        _OF(arr[i]);
    }
    return _OF(map);
};
const emitSystemMessage = (code = 0, ...params) => 
    window.postMessage({ type: 'msg', code, params }, '*');    
const runResultHook = (code, contextFrame) => {
    const meta = RESULT_META_MAP.get(code);
    if (!meta) return;
    const hook = RESULT_lifecycleHooks[meta.name];
    if (hook) hook(contextFrame);
}
//───\ Constants & Centralized Messages \─────────────────────────────────────|
const MSG_EN      = _OF({
    ACTION  : 'Action'  ,
    ALREADY : 'present' ,
    EMITTER : 'Emitter' ,
    ERROR   : ' ERROR ' ,
    FAILURE : 'Failure' ,
    HANDLER : 'Handler' ,
    HEADER  : 'Header'  ,
    LISTENER: 'Listener',
    METHOD  : 'Method'  ,
    MISSING : 'Missing' ,
    SUCCESS : 'SUCCESS' ,
    TIMEOUT : 'TIMEOUT' ,
    UNKNOWN : 'Unknown' ,
    WARNING : 'WARNING' ,
}); const MSG = MSG_EN;
const MSG_SET     = _OF({/*
    00 SUCCESS    
    10 WARNING  1 EMITTER
    20 ALREADY  2 LISTENER
    30 TIMEOUT  3 HANDLER
    40 MISSING  4 METHOD
    50 ERROR    5 FRAME
    60 FAILURE  6 HEADER 
                7 ACTION */
    SUCCESS         : 0,
    WARNING         : 10,
    ALREADY         : 20,
    ALREADY_HANDLER : 23 ,// ALREADY (2) + HANDLER  (3)
    ALREADY_METHOD  : 24 ,// ALREADY (2) + METHOD   (4)
    TIMEOUT         : 30,
    MISSING         : 40,
    MISSING_EMITTER : 41 ,// MISSING (4) + EMITTER  (1)
    MISSING_HANDLER : 43 ,// MISSING (4) + HANDLER  (3)
    MISSING_ACTION  : 47 ,
    ERROR           : 50,
    ERROR_EMITTER   : 51 ,// ERROR   (5) + EMITTER  (1)
    ERROR_LISTENER  : 52 ,// ERROR   (5) + LISTENER (2)
    ERROR_HEADER    : 56 ,// ERROR   (5) + HEADER   (6)
    ERROR_ACTION    : 57 ,// ERROR   (5) + ACTION   (7) 
    FAILURE         : 60,
});
const MSG_GET     = _OF({
0 : (...p) => `▪ ${MSG.SUCCESS}: ${p.join(' ') || MSG.UNKNOWN}`,
10 : (...p) => `▪ ${MSG.WARNING}: ${p.join(' ') || MSG.UNKNOWN}`,
20 : (...p) => `▪ ${MSG.ALREADY}: ${p.join(' ') || MSG.UNKNOWN}`,
23 : (...p) => `▪ ${MSG.WARNING} ${MSG.HANDLER} ${p.join(' ') || MSG.UNKNOWN} ${MSG.ALREADY}`,
24 : (...p) => `▪ ${MSG.WARNING} ${MSG.METHOD}  ${p.join(' ') || MSG.UNKNOWN} ${MSG.ALREADY}`,
30 : (...p) => `▪ ${MSG.TIMEOUT}: ${p.join(' ') || MSG.UNKNOWN}`,
40 : (...p) => `▪ ${MSG.MISSING}: ${p.join(' ') || MSG.UNKNOWN}`,
41 : (...p) => `▪ ${MSG.WARNING} ${MSG.MISSING} ${MSG.EMITTER}`,
43 : (...p) => `▪ ${MSG.WARNING} ${MSG.MISSING} ${MSG.HANDLER} 🡒 ${p.join(' ') || MSG.UNKNOWN}`,
47 : (...p) => `▪ ${MSG.ERROR  } ${MSG.MISSING} ${MSG.ACTION}: ${p.join(' ') || MSG.UNKNOWN}`,
50 : (...p) => `▪ ${MSG.ERROR  }: ${p.join(' ') || MSG.UNKNOWN}`,
51 : (...p) => `▪ ${MSG.ERROR  } ${MSG.EMITTER} 🡒 ${p.join(' ') || MSG.UNKNOWN}`,
52 : (...p) => `▪ ${MSG.ERROR  } ${MSG.LISTENER} 🡒 ${p.join(' ') || MSG.UNKNOWN}`,
56 : (...p) => `▪ ${MSG.ERROR  } ${MSG.HEADER} = Uint8Array ≥ 3 bytes`,
57 : (...p) => `▪ ${MSG.ERROR  } ${MSG.ACTION} 🡒 ${p.join(' ') || MSG.UNKNOWN}`,	
60 : (...p) => `▪ ${MSG.FAILURE}: ${p.join(' ') || MSG.UNKNOWN}`,
});
const BITMASK     = _OF({
    ORIGIN: 0b10000000, RETRYABLE: 0b01000000, VALUE_MASK: 0b00111111
});
const PHASE       = _OF({ START: 1, END: 2 });
const PHASE_SHIFT = 4;
const STATE_IDS   = _OF({ READY: 0xA0, VALID: 0xA1, PREPARED: 0xA2 });
const ACTION_MASK       = 0x0F;
const ACTION_IDS        = _OF({
    GET:       0x01,
    SET:       0x02,
    CALL:      0x03,
    DELETE:    0x04,
    TRANSFORM: 0x05,
    CLONE:     0x06,
    OBSERVE:   0x07,
    DEFINE:    0x08
});
const ACTION_NAMES      = _OF({
    0x01: "get", 0x02: "set", 0x03: "call", 0x04: "delete",
    0x05: "transform", 0x06: "clone", 0x07: "observe", 0x08: "define"
});
const ACTION_NAME_TO_ID = _OF({
        get: 1,
        set: 2,
        call: 3,
    delete: 4,
transform: 5,
    clone: 6,
    observe: 7,
    define: 8,
}); //Object.fromEntries(Object.entries(ACTION_NAMES).map(([id, name]) => [name, Number(id)]))
const RESULT_ORIGIN    = _OF({ USER: 0,  SYSTEM: 1 });
const RESULT_RETRYABLE = _OF({   NO: 0,     YES: 1 });
const RESULT_SEVERITY  = _OF({ INFO: 0, WARNING: 1, ERROR: 2});
const RESULT_IDS       = _OF({ SUCCESS :  0, WARNING : 10, 
                                TIMEOUT : 30, FAILURE : 60 });
const RESULT_CATEGORY  = _OF({
    GENERAL   : 0, NETWORK   : 1, VALIDATION: 2, INTERNAL  : 3, LOGIC     : 4 });
const RESULT_META_MAP  = _MAP_FREEZE(new Map([
    [ MSG.SUCCESS, { code: MSG.SUCCESS, name: MSG.SUCCESS, origin: RESULT_ORIGIN.USER  , retryable: RESULT_RETRYABLE.NO , category: RESULT_CATEGORY.GENERAL, severity: RESULT_SEVERITY.INFO    }],
    [ MSG.WARNING, { code: MSG.WARNING, name: MSG.WARNING, origin: RESULT_ORIGIN.USER  , retryable: RESULT_RETRYABLE.NO , category: RESULT_CATEGORY.GENERAL, severity: RESULT_SEVERITY.WARNING }],
    [ MSG.TIMEOUT, { code: MSG.TIMEOUT, name: MSG.TIMEOUT, origin: RESULT_ORIGIN.SYSTEM, retryable: RESULT_RETRYABLE.YES, category: RESULT_CATEGORY.NETWORK, severity: RESULT_SEVERITY.WARNING }],
    [ MSG.FAILURE, { code: MSG.FAILURE, name: MSG.FAILURE, origin: RESULT_ORIGIN.SYSTEM, retryable: RESULT_RETRYABLE.NO , category: RESULT_CATEGORY.GENERAL, severity: RESULT_SEVERITY.ERROR   }],
]));
const RESULT_lifecycleHooks = {};
//───\ Context Pool \─────────────────────────────────────────────────────────|
class ContextPool {
    constructor(maxSize = 4) {
        this.pool = Array.from({ length: maxSize }, () => ({
            actionId:    null,
            stateCode:   null,
            resultCode:  null,
            resultValue: null,
            frame: {
                header:  null,
                object:  null,
                payload: null
            }
        }));
        this.head  = 0;
        this.stats = {
            requests:  0,
            reused:    0,
            created:   maxSize,
            maxUsage:  0
        };
    }
    acquire() {
        const idx = this.head;
        this.head = idx + 1 === this.pool.length ? 0 : idx + 1;
        this.stats.requests++;
        this.stats.reused++;
        return this.pool[idx];
    }
}
//───\ Dispatcher \───────────────────────────────────────────────────────────|
class Dispatcher {
constructor({
    handlersMap,
    beforeFns = [],
    afterFns = [],
    objectList,
    maxActionId
}) {
    this.PHASE_END    = 0b1000_0000;
    this.ACTION_MASK  = 0x7F;
    this.MAX_ACTIONS = maxActionId + 1;
    this.objectIndexMap = {};
    objectList.forEach((name, idx) => {
        this.objectIndexMap[name] = idx;
    });
    this.OBJECT_COUNT = objectList.length;
    this.dispatchers = Array.from({ length: this.OBJECT_COUNT }, () =>
        new Array(this.MAX_ACTIONS)
    );
    for (const [objName, actionMap] of Object.entries(handlersMap)) {
        const objId = this.objectIndexMap[objName];
        for (let aid = 0; aid < this.MAX_ACTIONS; aid++) {
            const raw = actionMap[aid];
            const idx = objId * this.MAX_ACTIONS + aid;
            const dispatcher = typeof raw === 'function'
                ? contextFrame => {
                    let value, error;
                    try {
                        value = raw(contextFrame);
                    } catch (e) {
                        error = e;
                    }
                    contextFrame[3] = value;
                    return { value, error };
                }
                : () => ({ value: undefined, error: undefined });
            this.dispatchers[objId][aid] = dispatcher;
        }
    }
    this.lifecycleHooks = [
        ...beforeFns.map(fn => ({ phase: 0, fn })),
        ...afterFns.map(fn => ({ phase: 1, fn }))
    ];
    this.pool = new ContextPool(8);
    this.metrics = {
        frames:     { value: 0 },
        dispatched: { value: 0 }
    };
}
}
//───\ SignalRuntime Core & Safe \────────────────────────────────────────────|
class SignalRuntime {
    /// Setup & Exposure: Initialization and public API exposure
    constructor(poolSize = 4) {
        this._listeners = new Map();
        this.pool = new ContextPool(poolSize);
        this.handlers = { signalHandlers: Object.create(null) };
        this.subscribers = Object.create(null);
        this.beforelifecycleHooks = [];
        this.afterlifecycleHooks = [];
        this.plugins = new Map();
        this.metrics = {
                frames:{ value: 0 },
            dispatched:{ value: 0 },
                errors:{ value: 0 },
                signals:{ value: 0 }
        };
        this._headerTemplate = new Uint8Array(3);
        this._frameTemplate  = {
                header:  this._headerTemplate,
                object:  null,
            payload: null
        };
        this._actionMap   = ACTION_NAME_TO_ID;
        this.handlers = { signalHandlers: Object.create(null) };
        this._handlers = this.handlers;
        this._pool        = this.pool;
        this._hdrTpl      = this._headerTemplate;
        this._frmTpl      = this._frameTemplate;
        this.subscribers  = Object.create(null);
        this._subscribers = this.subscribers;
        this._metrics     = this.metrics;
        this._ENDFLAG     = PHASE.END << PHASE_SHIFT;
        this._READY       = STATE_IDS.READY;
        this._SUCCESS     = RESULT_IDS.SUCCESS;
        this._FAILURE     = RESULT_IDS.FAILURE;
        this._BEFORE      = this.beforelifecycleHooks;
        this._AFTER       = this.afterlifecycleHooks;
    }
    expose(name, fn) {
        this.api ||= Object.create(null);
        if (this.api[name]) {
            emitSystemMessage(ALREADY_METHOD,name);
            return {status:ALREADY_METHOD}
        }
        this.api[name] = fn;
    }
    /// Freezing & Locking: Internal state control and immutability enforcement
    freezeInternals() {
        _OF(this.beforelifecycleHooks);
        _OF(this.afterlifecycleHooks);
        _OF(this.plugins);
        _OF(this.metrics);
        return this;
    }
    freezeHandlers() {
        _OF(this.handlers);
        return this;
    }
    /// Plugins Lifecycle: registration, disposal, and integration
    /**
     * Registers a plugin and integrates its handlers and hooks.
     * @param {object} plugin - The plugin object.
     */
    use(plugin) {
        if (this.plugins.has(plugin.name)) return;
        const { handles = {}, subscribe = {}, onLoad, onDispose } = plugin;
        
        for (const actionName in handles) {
            const actionId = ACTION_NAME_TO_ID[actionName];
            const objectMap = handles[actionName];
            for (const objectName in objectMap) {
                this.registerAction(objectName, actionId, objectMap[objectName]);
            }
        }
        for (const actionName in subscribe) {
            const actionId = ACTION_NAME_TO_ID[actionName];
            this.onSignal(actionId, subscribe[actionName]);
        }
        if (typeof plugin.validate === "function") {
            this.onBefore((resultCode, stateCode, actionId, frame) => {
                plugin.validate(frame);
            });
        }
        if (typeof onLoad === "function") onLoad(this);
        this.plugins.set(plugin.name, plugin);
        plugin.onDispose = onDispose;
    }
    /**
     * Disposes all registered plugins.
     */
    dispose() {
        for (const { onDispose } of this.plugins.values()) {
            if (typeof onDispose === "function") onDispose(this);
        }
        this.plugins.clear();
    }
    /// Actions & Event Suscritions. 
    /**
     * Registers a handler for a specific object type and action.
     * @param {string} objectName - The name of the object type (e.g. "Object", "Array").
     * @param {number} actionId - The numeric ID of the action.
     * @param {(contextFrame: object) => any} handler - The function to handle the signal.
     * @returns {Function} A function to unregister the handler.
     */        
        registerAction(objectName, actionId, handler) {
        const map = this.handlers[objectName] ||= Object.create(null);
        if (map[actionId]) {
            emitSystemMessage(ALREADY_HANDLER,[objectName, actionId]);
            return {STATUS:ALREADY_HANDLER};
        }
        map[actionId] = handler;
        return () => { delete map[actionId]; };
    }
    /**
     * Subscribes to a signal by action ID.
     * @param {number} actionId - The numeric ID of the signal.
     * @param {(contextFrame: object, error?: any) => void} fn - The subscriber callback.
     * @returns {Function} A function to unsubscribe.
     */
    subscribe(actionId, fn) {
        const list = this.subscribers[actionId] ||= [];
        list.push(fn);
        return () => {
            const i = list.indexOf(fn);
            if (i !== -1) list.splice(i, 1);
        };
    }
    /// lifecycleHooks: Before/after tied to actions
    /**
     * Registers a lifecycle hook to run before dispatch.
     * @param {(resultCode: number, stateCode: number, actionId: number, frame: object) => void} fn
     */
    onBefore(fn) { this.beforelifecycleHooks.push(fn); }
    /**
     * Registers a lifecycle hook to run after dispatch.
     * @param {(error: any, contextFrame: object) => void} fn
     */
    onAfter(fn)  { this.afterlifecycleHooks.push(fn); }
    /// Execution: Signal dispatching and frame processing
    processFrame(frameWrapper) {
        const hdr = frameWrapper.header;
        this.metrics.frames.value++;
        const b0 = hdr[0];
        if ((b0 & this.PHASE_END) !== this.PHASE_END) return;
        const actionId   = b0 & this.ACTION_MASK;
        const stateCode  = hdr[1];
        const resultCode = hdr[2];
        const contextFrame = this.pool.acquire();
        contextFrame.actionId   = actionId;
        contextFrame.stateCode  = stateCode;
        contextFrame.resultCode = resultCode;
        contextFrame.resultValue= undefined;
        const f = contextFrame.frame;
        f.header  = hdr;
        f.object  = frameWrapper.object;
        f.payload = frameWrapper.payload;
        const objId = objectIndexMap[frameWrapper.object];
        const safeCall = this.dispatchers[objId]?.[actionId];
        if (!safeCall && globalThis.__DEV__) {
            emitSystemMessage(MISSING_HANDLER, [`objId=${objId}`, `actionId=${actionId}`]);
            return;
        }
        let called = false, result;
        for (let i = 0, L = this.lifecycleHooks.length; i < L; i++) {
            const hook = this.lifecycleHooks[i];
            if (hook.phase === 0) {
                hook.fn(resultCode, stateCode, actionId, frameWrapper);
            } else {
                if (!called) {
                    called     = true;
                    result     = safeCall(contextFrame);
                    contextFrame.resultValue = result.value;
                    this.emitSignalWithMeta(actionId, contextFrame, result.error);
                }
                hook.fn(result.error, contextFrame);
            }
        }
        if (!called) {
            result          = safeCall(contextFrame);
            contextFrame.resultValue = result.value;
            this.emitSignalWithMeta(actionId, contextFrame, result.error);
        }
        this.metrics.dispatched.value++;
    }
    /**
     * Dispatches a signal to the appropriate handler.
     * @param {string} actionName - The name of the action (e.g. "call").
     * @param {any} object - The target object.
     * @param {any} payload - The payload to send.
     * @returns {any} The result of the handler.
     */
    dispatchSignal(actionName, object, payload) {
        const {
            _actionMap, _handlers, _subscribers,
            _pool, _metrics, _hdrTpl: header,
            _frmTpl: frameTpl,
            _ENDFLAG, _READY, _SUCCESS, _FAILURE
        } = this;
        const id   = _actionMap[actionName];
        const type = Array.isArray(object) ? 'Array' : 'Object';
        const fn   = _handlers[type]?.[id];
        if (!fn) {
            emitSystemMessage(MISSING_HANDLER, [type, actionName]);
            return { status: MISSING_HANDLER };
        }
        const contextFrame           = _pool.acquire();
        contextFrame.actionId        = id;
        contextFrame.stateCode       = _READY;
        contextFrame.resultCode      = _SUCCESS;
        header[0] = _ENDFLAG | id;
        header[1] = _READY;
        header[2] = _SUCCESS;
        frameTpl.object  = object;
        frameTpl.payload = payload;
        contextFrame.frame        = frameTpl;
        let value, error;
        try {
            value = fn(contextFrame);
        } catch (err) {            
            contextFrame.resultCode = _FAILURE;
        }
        contextFrame.resultValue = value;
        const subs = _subscribers[id];
        if (subs) {
            for (let i = subs.length; i--; ) {
                try { subs[i](contextFrame, error); } catch {}
            }
        }
        _metrics.signals.value++;
        return value;
    }
    /// FastEmitter: Lightweight Event System
    /**
     * Registers a listener for a signal.
     * @param {string|number} signal - The signal name or ID.
     * @param {(data: any) => void} fn - The listener callback.
     * @returns {Function} A function to remove the listener.
     */
    onSignal(signal, fn){
        let list = this._listeners.get(signal);
        if (!list) {
            list = [];
            this._listeners.set(signal, list);
        }
        list.push(fn);
        return () => {
            const i = list.indexOf(fn);
            if (i !== -1) list.splice(i, 1);
        };
    };
    /**
     * Emits a signal to all listeners.
     * @param {string|number} signal - The signal name or ID.
     * @param {any} data - The payload to emit.
     */
    emitSignal(signal, data) {
        const list = this._listeners.get(signal);
        if (!list) return;
        for (let i = list.length; i--; ) {
            try { list[i](data); } catch {}
        }
    };
    /**
     * Emits a signal with metadata to all listeners.
     * @param {string|number} signal - The signal name or ID.
     * @param {any} data - The payload.
     * @param {any} meta - Additional metadata.
     */
    emitSignalWithMeta(signal, data, meta) {
        const list = this._listeners.get(signal);
        if (!list) return;
        for (let i = list.length; i--; ) {
            try { list[i](data, meta); } catch {}
        }
    };
    /// Instrospecting & Reporting: Diagnostics, metrics, and summaries
    /**
     * Returns a detailed diagnostic report of the runtime.
     * @param {boolean} [verbose=false] - Whether to include plugin hook details.
     * @returns {object}
     */
    getDiagnostics(verbose = false) {
        const handlers = Object.entries(this.handlers)
        .filter(([_, map]) => Object.keys(map).length > 0)
        .map(([obj, map]) => {
            const actions = Object.keys(map)
            .map(id => ACTION_NAMES?.[id] || `0x${(+id).toString(16)}`)
            .sort()
            .join(", ");
            return `${obj}: ${actions} (${Object.keys(map).length})`;
        });
        const plugins = [];
        for (const p of this.plugins.values()) {
            const descriptor = { name: p.name };
            const handles = p.handles;
            if (handles) {
                const actions = [];
                let idx = 0;
                for (const actionName in handles) {
                    const objectMap = handles[actionName];
                    for (const objectName in objectMap) {
                        actions[idx++] = objectName + ':' + actionName;
                    }
                }
                actions.length = idx;
                descriptor.actions = actions;
            } else {
                descriptor.actions = []; 
            }
            if (verbose) {
                const lifecycleHooks = [];
                let hidx = 0;
                for (const key in p) {
                    if (key.charCodeAt(0) === 111 &&
                        key.charCodeAt(1) === 110 &&
                        typeof p[key] === 'function') {
                        lifecycleHooks[hidx++] = key;
                    }
                }
                if (hidx) {
                    lifecycleHooks.length = hidx;
                    descriptor.lifecycleHooks = lifecycleHooks;
                }
            }
            plugins.push(descriptor);
        }
        return {
            metrics: {
                ...this.metrics,
                signalTypes: Object.keys(this.handlers.signalHandlers || {}).length
            },
            pool: this.pool.stats,
            handlers,
            plugins,
            version: this.version || "unknown",
            timestamp: Date.now()
        };
    }
    /**
     * Returns a summary string of the runtime state.
     * @returns {string}
     */
    getSummary() {
        const pluginCount = this.plugins.size;
        const handlerCount = Object.values(this.handlers)
        .reduce((sum, map) => sum + Object.keys(map).length, 0);
        const signalCount = this.metrics.signals.value;
        return `${handlerCount} handlers, ${signalCount} signals, ${pluginCount} plugins`;
    }
}
/// Safe Protocol
class SafeSignalRuntime extends SignalRuntime {
    /// Setup & Exposure: Initialization and public API exposure
    /**
     * @param {number} [poolSize=4] - The size of the context pool.
     */
    constructor(poolSize = 4) {
        super(poolSize);
        this.pool = new ContextPool(poolSize);
        this.handlers = Object.create(null);
        this.metrics = {
            signals: 0,
            errors: 0,
            fallback: 0,
            registered: 0
        };
        this.fallbackHandler = null;
        ["Object", "Array", "String", "Number", "Boolean"].forEach(type => {
            this.registerAction(type, "call", contextFrame => ({
                status: "default",
                type,
                payload: contextFrame.frame.payload
            }));
        });
    }
    /// Actions & Event Suscritions. 
    registerAction(type, action, fn) {
        const map = this.handlers[type] ||= Object.create(null);
        map[action] = fn;
        this.metrics.registered++;
    }
    /// Fallback Handling
    setFallbackHandler(fn) {
        this.fallbackHandler = fn;
    }
    /// Execution
    /**
     * Dispatches a signal safely, catching errors and returning a result object.
     * @param {string} actionName
     * @param {any} object
     * @param {any} payload
     * @returns {{ success: boolean, result?: any, error?: any }}
     */
    dispatchSignal(action, object, payload) {
        const type = Array.isArray(object)
        ? "Array"
        : object === null
        ? "Null"
        : typeof object === "object"
        ? "Object"
        : typeof object;
        const handler = this.handlers[type]?.[action] ?? this.fallbackHandler;
        const contextFrame = this.pool.acquire();
        contextFrame.frame = {
        object,
        action,
        payload
    };
        try {
            const result = handler
            ? handler(contextFrame)
            : (() => {
                this.metrics.errors++;
                emitSystemMessage(MISSING_HANDLER, [type, action]);
                return {status:MISSING_HANDLER}
            })();
            this.metrics.signals++;
            return result;
        } catch (err) {
            this.metrics.errors++;
            emitSystemMessage(ERROR_ACTION,[type,action,err]);
            return { status: ERROR_ACTION };
        }
    }
    /// Instrospecting & Reporting: Diagnostics, metrics, and summaries
    getDiagnostics() {
        return {
            metrics: this.metrics,
            types: Object.keys(this.handlers),
            timestamp: Date.now()
        };
    }
}
//───/ API /──────────────────────────────────────────────────────────────────|
class SpliceAPI {
    /**
     * @param {SignalRuntime} runtime - The signal runtime instance to bind to.
     */
    constructor(protocol) {
        this._protocol = protocol;
    }
    /**
     * Dispatches a signal using the underlying protocol.
     * @param {string} actionName
     * @param {any} object
     * @param {any} payload
     * @returns {any}
     */
    dispatchSignal(actionName, object, payload) {
        return this._protocol.dispatchSignal(actionName, object, payload);
    }
    /**
     * Registers a listener for a signal.
     * @param {string|number} signal
     * @param {(data: any) => void} fn
     * @returns {Function|{status: string}} Unsubscribe function or error status.
     */
    onSignal(signal, fn) {
        const onSignal = this._protocol.api?.onSignal;
        if (typeof onSignal !== 'function') {
            emitSystemMessage(MISSING_EMITTER);
            return {status:MISSING_EMITTER}
        }
        return onSignal(signal, fn);
    }
    /**
     * Emits a signal to listeners.
     * @param {string|number} signal
     * @param {any} data
     * @returns {any}
     */
    emitSignal(signal, payload) {
        const emitSignal = this._protocol.api?.emitSignal;
        if (typeof emitSignal !== 'function') {
            emitSystemMessage(MISSING_EMITTER);
            return {status:MISSING_EMITTER}
        }
        return emitSignal(signal, payload);
    }
    onSignal(signal, fn) {
        return this._protocol.onSignal(signal, fn);
    }
    emitSignal(signal, data) {
        return this._protocol.emitSignal(signal, data);
    }
    /**
     * Emits a signal with metadata.
     * @param {string|number} signal
     * @param {any} data
     * @param {any} meta
     * @returns {any}
     */
    emitSignalWithMeta(signal, data, meta) {
        return this._protocol.emitSignalWithMeta(signal, data, meta);
    }
    /**
     * Subscribes to a signal by action name or ID.
     * @param {string|number} actionKey - Action name or numeric ID.
     * @param {(frame: object, error?: any) => void} fn
     * @returns {Function|{status: string}} Unsubscribe function or error status.
     */
    subscribe(actionKey, fn) {
        const signal = typeof actionKey === 'string'
        ? ACTION_NAME_TO_ID[actionKey]
        : actionKey;
        if (!signal) {
            emitSystemMessage(MISSING_ACTION, [objectName, actionName]);
            return { status: MISSING_ACTION };
        }
        return this.onSignal(signal, fn);
    }
    /**
     * Registers a plugin.
     * @param {object} plugin
     */
    use(plugin) { return this._protocol.use(plugin); }
    /**
     * Disposes all plugins and listeners.
     */
    dispose() { return this._protocol.dispose(); }
    /**
     * Returns diagnostic information.
     * @param {boolean} [verbose=false]
     * @returns {object}
     */
    getDiagnostics(verbose = false) { return this._protocol.describe(verbose); }
    /**
     * Returns a summary string of the runtime.
     * @returns {string}
     */
    getSummary() { return this._protocol.getSummary(); }
    /** @returns {object} */
    get metrics() { return this._protocol.metrics; }
    /** @returns {object} */
    get poolStats() { return this._protocol.pool.stats; }
    /** @returns {Map<string, object>} */
    get plugins() { return this._protocol.plugins; }
    /** @returns {object} */
    get handlers() { return this._protocol.handlers; }
    /**
     * Returns metadata for a result code.
     * @param {number} code
     * @returns {object|undefined}
     */
    getResultMeta(code) { return RESULT_META_MAP.get(code); }
    /**
     * Runs a result hook manually.
     * @param {number} code
     * @param {object} [contextFrame={}]
     */
    runResultHook(code, contextFrame = {}) {runResultHook(code, contextFrame);}
}
