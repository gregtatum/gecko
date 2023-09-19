/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

console.log(`!!! Inside of translations-hidden-window.js`);

/**
 * @type {Worker | undefined}
 */
let worker;

let messageId = 0;

addEventListener("message", event => {
  const data = event.data;
  switch (data.type) {
    case "intialize": {
      const {
        fromLanguage,
        toLanguage,
        enginePayload,
        innerWindowId,
        logLevel,
      } = data;

      const worker = new Worker(
        "chrome://global/content/translations/translations-engine-worker.js"
      );

      // Make sure the ArrayBuffers are transferred, not cloned.
      // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
      const transferables = [];
      if (enginePayload) {
        transferables.push(enginePayload.bergamotWasmArrayBuffer);
        for (const files of enginePayload.languageModelFiles) {
          for (const { buffer } of Object.values(files)) {
            transferables.push(buffer);
          }
        }
      }

      worker.postMessage(
        {
          type: "initialize",
          fromLanguage,
          toLanguage,
          enginePayload,
          innerWindowId,
          messageId: messageId++,
          logLevel: logLevel,
          port: channel.port2,
        },
        transferables
      );
      break;
    }
    default:
  }
});
