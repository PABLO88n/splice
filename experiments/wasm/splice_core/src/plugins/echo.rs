use crate::context::Context;
use crate::runtime::Handler;

#[derive(Clone)]
pub struct Echo;

impl Handler for Echo {
    fn handle(&self, ctx: &mut Context, payload: &[u8]) -> u32 {
        ctx.tick();
        if payload.len() >= 4 {
            let mut arr = [0u8; 4];
            arr.copy_from_slice(&payload[..4]);
            u32::from_le_bytes(arr)
        } else {
            0
        }
    }
}
