new Promise((resolve, reject) => {
    loadWasm((error, wasm) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(wasm);
    })
})

