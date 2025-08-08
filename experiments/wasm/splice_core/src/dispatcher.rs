use crate::{frame::Frame, runtime::SignalRuntime};

pub struct Dispatcher<'a> {
    rt: &'a SignalRuntime,
}

impl<'a> Dispatcher<'a> {
    pub fn new(rt: &'a SignalRuntime) -> Self {
        Self { rt }
    }

    pub fn dispatch(&self, frame: &Frame) -> Option<u32> {
        self.rt.dispatch(frame.id, &frame.payload)
    }
}
