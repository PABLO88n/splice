pub struct ContextPool<T> {
    pool: Vec<T>,
    index: usize,
}

impl<T: Default + Clone> ContextPool<T> {
    pub fn new(size: usize) -> Self {
        Self {
            pool: vec![T::default(); size],
            index: 0,
        }
    }

    pub fn next(&mut self) -> &mut T {
        let idx = self.index;
        self.index = (self.index + 1) % self.pool.len();
        &mut self.pool[idx]
    }

}
