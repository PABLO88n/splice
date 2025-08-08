use crate::context::Context;

pub trait Handler: HandlerClone {
    fn handle(&self, ctx: &mut Context, payload: &[u8]) -> u32;
}

pub trait HandlerClone {
    fn clone_box(&self) -> Box<dyn Handler>;
}

impl<T> HandlerClone for T
where
    T: 'static + Handler + Clone,
{
    fn clone_box(&self) -> Box<dyn Handler> {
        Box::new(self.clone())
    }
}

impl Clone for Box<dyn Handler> {
    fn clone(&self) -> Box<dyn Handler> {
        self.clone_box()
    }
}

pub enum BuiltinKind {
    Echo,
    Logger,
}

pub struct Runtime {
    pub handlers: Vec<Vec<Option<Box<dyn Handler>>>>,
    pub frames: u64,
    pub dispatched: u64,
}

impl Runtime {
    pub fn new(object_count: usize, max_action_id: usize, _pool_size: usize) -> Self {
        let mut handlers = Vec::with_capacity(object_count);
        for _ in 0..object_count {
            let row = vec![None; max_action_id + 1];
            handlers.push(row);
        }

        Runtime {
            handlers,
            frames: 0,
            dispatched: 0,
        }
    }

    pub fn register_builtin(&mut self, obj_id: usize, action_id: usize, kind: BuiltinKind) {
        let handler: Box<dyn Handler> = match kind {
            BuiltinKind::Echo => Box::new(crate::plugins::echo::Echo),
            BuiltinKind::Logger => todo!(), // Stub or custom implementation
        };
        self.handlers[obj_id][action_id] = Some(handler);
    }

    pub fn dispatch(&mut self, obj_id: usize, action_id: usize, payload: &[u8]) -> u32 {
        self.frames += 1;
        self.dispatched += 1;

        if let Some(Some(handler)) = self.handlers.get(obj_id).and_then(|row| row.get(action_id)) {
            let mut ctx = Context::default();
            handler.handle(&mut ctx, payload)
        } else {
        }
    }

    pub fn metrics_frames(&self) -> u64 {
        self.frames
    }

    pub fn metrics_dispatched(&self) -> u64 {
        self.dispatched
    }
}
