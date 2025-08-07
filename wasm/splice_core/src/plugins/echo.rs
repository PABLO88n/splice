use crate::runtime::SignalHandler;

pub struct EchoPlugin;

impl SignalHandler for EchoPlugin {
    fn handle(&self, payload: &[u8]) -> u32 {
        payload.len() as u32 // Just return payload length
    }
}
