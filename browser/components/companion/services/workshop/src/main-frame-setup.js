/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The startup process (which can be improved) looks like this:
 *
 * Main: Initializes worker support logic
 * Main: Spawns worker
 * Worker: Loads core JS
 * Worker: 'hello' => main
 * Main: 'hello' => worker with online status and mozAlarms status
 * Worker: Creates MailUniverse
 * Worker 'mailbridge'.'hello' => main
 * Main: Creates MailAPI, sends event to UI
 * UI: can really do stuff
 *
 * Note: this file is not currently used by the GELAM unit tests;
 * mailapi/testhelper.js (in the worker) and
 * mailapi/worker-support/testhelper-main.js establish the (bounced) bridge.
 **/

import logic from "logic";
// This gets updated once we know a unique identifier issued to us by the
// backend.
window.LOGIC = logic;
logic.tid = "api?";
logic.bc = new BroadcastChannel("logic");

const SCOPE = {};
logic.defineScope(SCOPE, "MainFrameSetup");

// Pretty much everything could be dynamically loaded after we kickoff the
// worker thread.  We just would need to be sure to latch any received
// messages that we receive before we finish setup.
//
import * as $mailapi from "./clientapi/mailapi";
import * as $router from "./worker-support/main-router";
import $configparser from "./worker-support/configparser-main";
import $cronsync from "./worker-support/cronsync-main";
import $devicestorage from "./worker-support/devicestorage-main";
import $net from "./worker-support/net-main";
import $wakelocks from "./worker-support/wakelocks-main";

/**
 * Builder/loader/runtime specific mechanism for worker instantiation.
 */
import makeWorker from "app_logic/worker_maker";

const control = {
  name: "control",
  sendMessage: null,
  process(uid /*, cmd, args*/) {
    // This logic gets called by the worker sending us a "control" message with
    // command "worker-exists".
    var online = navigator.onLine;
    logic(SCOPE, "sendingHello");
    control.sendMessage(uid, "hello", [online]);

    window.addEventListener("online", function(evt) {
      control.sendMessage(uid, evt.type, [true]);
    });
    window.addEventListener("offline", function(evt) {
      control.sendMessage(uid, evt.type, [false]);
    });

    $router.unregister(control);
  },
};

// Wire up the worker to the router
/* If using require.js this module should look something like:

 */

export function MailAPIFactory(mainThreadService) {
  const MailAPI = new $mailapi.MailAPI();
  const worker = makeWorker();
  logic.defineScope(worker, "Worker");
  const workerPort = worker.port;

  const bridge = {
    name: "bridge",
    sendMessage: null,
    process(uid, cmd, args) {
      var msg = args;

      if (msg.type === "hello") {
        delete MailAPI._fake;
        logic.tid = `api${uid}`;
        logic(SCOPE, "gotHello", { uid, storedSends: MailAPI._storedSends });
        MailAPI.__bridgeSend = function(sendMsg) {
          logic(this, "send", { msg: sendMsg });
          try {
            workerPort.postMessage({
              uid,
              type: "bridge",
              msg: sendMsg,
            });
          } catch (ex) {
            console.error("Presumed DataCloneError on:", sendMsg, "ex:", ex);
          }
        };

        MailAPI.willDie = () => {
          workerPort.postMessage({
            type: "willDie",
          });
        };

        MailAPI.config = msg.config;

        // Send up all the queued messages to real backend now.
        MailAPI._storedSends.forEach(function(storedMsg) {
          MailAPI.__bridgeSend(storedMsg);
        });
        // XXX
        //MailAPI._storedSends = [];

        MailAPI.__universeAvailable();
      } else {
        MailAPI.__bridgeReceive(msg);
      }
    },
  };

  const mainThreadServiceModule = {
    name: "mainThreadService",
    process(uid, cmd, args) {
      if (!mainThreadService?.hasOwnProperty(cmd)) {
        this.sendMessage(
          uid,
          cmd,
          args,
          `No service ${cmd} in the main thread.`
        );
      }
      try {
        Promise.resolve(mainThreadService[cmd](...args))
          .then(res => this.sendMessage(uid, cmd, res, null))
          .catch(err =>
            this.sendMessage(
              uid,
              cmd,
              args,
              `Main thread service threw: ${err.message}`
            )
          );
      } catch (ex) {
        this.sendMessage(
          uid,
          cmd,
          args,
          `Main thread service threw: ${ex.message}`
        );
      }
    },
  };

  worker.onerror = event => {
    logic(worker, "workerError", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    });
    // we do not preventDefault the event, we want as many other helpful error
    // reporting mechanisms to fire, etc.
  };

  // Attach the listeners...
  $router.register(mainThreadServiceModule);
  $router.register(control);
  $router.register(bridge);
  $router.register($configparser);
  $router.register($cronsync);
  $router.register($devicestorage);
  $router.register($net);
  $router.register($wakelocks);

  // ... and then add the onmessage.
  $router.useWorker(worker);

  return MailAPI;
}
