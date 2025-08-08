#/bin/bash
cd splice_core || { echo "Directory splice_core not found"; exit 1; }
wasm-pack build --target web --release
python3 -m http.server 8080