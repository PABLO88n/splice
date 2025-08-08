#[derive(Default)]
pub struct Context {
    pub ticks: u64,
    pub frame_header: [u8; 3],
    pub frame_payload_len: u32,
}

impl Context {
    pub fn tick(&mut self) { self.ticks += 1; }
    pub fn reset(&mut self) {
        self.frame_header = [0; 3];
        self.frame_payload_len = 0;
        self.ticks = 0;
    }
}
