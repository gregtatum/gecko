/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* globals browser */

browser.menus.create({
  title: "Generate ML description",
  documentUrlPatterns: ["*://*/*"],
  contexts: ["image"],
  onclick(info, tab) {
    browser.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      code: `(${async function contentScript(targetElementId) {
        try {
          // two-phase process.

          // 1. create the pipeline, may trigger downloads.
          // XXX check how to add a progress callback so the webextension gets download info
          const pipelineId = await browser.experimental.ml.createPipeline({
            taskName: "image-to-text",
            modelId: "mozilla/distilvit",
            modelRevision: "v0.5.0",
            device: "wasm",
            dtype: "q8",
            numThreads: 4,
          });

          // 2. run the inference
          const imageUrl = browser.menus.getTargetElement(targetElementId).src;
          const res = await browser.experimental.ml.runPipeline({
            pipelineId,
            args: [imageUrl],
          });

          window.alert(res[0].generated_text);
        } catch (err) {
          window.alert(`${err}`);
        }
      }})(${info.targetElementId});`,
    });
  },
});
