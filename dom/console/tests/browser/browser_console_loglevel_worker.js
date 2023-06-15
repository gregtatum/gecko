/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_console_loglevel_worker() {
  await SpecialPowers.pushPrefEnv({ set: [["pref.test.console", "log"]] });

  const workerScript = /* js */ `
    dump("!!! Inside of worker\\n");
    console
      .createInstance({ maxLogLevelPref: "pref.test.console" })
      .log("Hello world!");

    self.postMessage('msg from worker');
  `;
  const worker = new ChromeWorker(
    URL.createObjectURL(new Blob([workerScript], { type: "text/javascript" }))
  );

  const messagePromise = new Promise(resolve => {
    worker.onmessage = function (e) {
      dump("!!! Received: " + e.data + "\n");
      ok(true, "Message received.");
      resolve();
    };
  });

  worker.postMessage("hello"); // Start the worker.

  await messagePromise;

  await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
});
