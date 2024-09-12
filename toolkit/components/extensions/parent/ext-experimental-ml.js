/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  createEngine: "chrome://global/content/ml/EngineProcess.sys.mjs",
});

this.experimental_ml = class extends ExtensionAPI {
  #engines = null;

  async promiseToEngine(pipelineId, options) {
    if (!this.#engines) {
      this.#engines = new Map();
    }
    if (this.#engines.has(pipelineId)) {
      return this.#engines.get(pipelineId);
    }
    options.engineId = "webextension";
    const engine = await createEngine(options);
    this.#engines.set(pipelineId, engine);
    return engine;
  }

  getAPI(_context) {
    return {
      experimental: {
        ml: {
          createPipeline: async request => {
            await this.promiseToEngine("SOMEID", request);
            return "SOMEID";
          },
          runPipeline: async request => {
            const engine = this.#engines.get(request.pipelineId);

            const runOptions = {
              args: request.args,
              options: request.options || {},
            };

            const result = await engine.run(runOptions);
            return result;
          },
        },
      },
    };
  }
};
