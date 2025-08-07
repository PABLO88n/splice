use crate::runtime::SignalRuntime;

pub fn process_frame(frame: &[u8], runtime: &SignalRuntime) -> Option<u32> {
    if frame.len() < 4 {
        return None;
    }

    let signal_id = ((frame[0] as u32) << 24)
                  | ((frame[1] as u32) << 16)
                  | ((frame[2] as u32) << 8)
                  | (frame[3] as u32);

    let payload = &frame[4..];
    runtime.dispatch(signal_id, payload)
}
