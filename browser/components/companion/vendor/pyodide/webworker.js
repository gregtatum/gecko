importScripts("./pyodide.js");

onmessage = async function(e) {
  try {
    const data = e.data;
    for (let key of Object.keys(data)) {
      if (key !== "python") {
        // Keys other than python must be arguments for the python script.
        // Set them on self, so that `from js import key` works.
        self[key] = data[key];
      }
    }

    if (!loadPyodide.inProgress) {
      self.pyodide = await loadPyodide({ indexURL: "./" });
      await self.pyodide.loadPackage(["numpy", "pandas", "scikit-learn", "scipy"]);
    }
    await self.pyodide.loadPackagesFromImports(data.python);

    let results = await self.pyodide.runPythonAsync(data.python);
    if(self.pyodide.isPyProxy(results)){ 
      results = results.toJs();
    }
    self.postMessage({ results });
  } catch (e) {
    self.postMessage({ error: e.message + "\n" + e.stack });
  }
};
