use std::collections::HashMap;

pub trait SignalHandler: Send + Sync {
    fn handle(&self, payload: &[u8]) -> u32;
}

pub struct SignalRuntime {
    handlers: HashMap<u32, Box<dyn SignalHandler>>,
}

impl SignalRuntime {
    pub fn new() -> Self {
        Self { handlers: HashMap::new() }
    }

    pub fn register(&mut self, id: u32, handler: Box<dyn SignalHandler>) {
        self.handlers.insert(id, handler);
    }

    pub fn dispatch(&self, id: u32, payload: &[u8]) -> Option<u32> {
        self.handlers.get(&id).map(|h| h.handle(payload))
    }
}
