pub struct Frame {
    pub id: u32,
    pub payload: Vec<u8>,
}

impl Frame {
    pub fn new(id: u32, payload: Vec<u8>) -> Self {
        Self { id, payload }
    }
}
