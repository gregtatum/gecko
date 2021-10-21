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
 * This is the actual root module for the worker.
 **/

import logic from "logic";
logic.tid = "worker";
logic.bc = new BroadcastChannel("logic");

const SCOPE = {};
logic.defineScope(SCOPE, "WorkerSetup");

import * as $router from "./worker-router";
import MailBridge from "./mailbridge";
import MailUniverse from "./mailuniverse";

import appExtensions from "app_logic/worker_extensions";

const routerBridgeMaker = $router.registerInstanceType("bridge");

let nextBridgeUid = 0;
function createBridgePair(universe, usePort, uid, cleanupPromise) {
  const TMB = new MailBridge(universe, universe.db, uid);
  // When the port tells us it's going away, we need to shutdown the bridge.
  cleanupPromise.then(() => {
    TMB.shutdown();
  });
  const routerInfo = routerBridgeMaker.register(function(data) {
    TMB.__receiveMessage(data.msg);
  }, usePort);
  const sendMessage = routerInfo.sendMessage;

  TMB.__sendMessage = function(msg) {
    logic(TMB, "send", { type: msg.type, msg });
    sendMessage(null, msg);
  };

  // Let's say hello to the main thread in order to generate a
  // corresponding mailAPI.
  TMB.__sendMessage({
    type: "hello",
    config: universe.exposeConfigForClient(),
  });
}

let universe = null;
let universePromise = null;

var sendControl = $router.registerSimple("control", async function(
  data,
  source,
  cleanupPromise
) {
  var args = data.args;
  switch (data.cmd) {
    case "hello": {
      const bridgeUid = nextBridgeUid++;
      logic(SCOPE, "gotHello", { bridgeUid });
      if (!universe) {
        logic(SCOPE, "creatingUniverse");
        universe = new MailUniverse({
          online: args[0],
          appExtensions,
        });
        universePromise = universe.init();
      }
      logic(SCOPE, "awaitingUniverse", { bridgeUid });
      await universePromise;
      logic(SCOPE, "gotUniverse", { bridgeUid });
      createBridgePair(universe, source, bridgeUid, cleanupPromise);
      break;
    }
    case "online":
    case "offline":
      universe._onConnectionChange(args[0]);
      break;
    default:
      break;
  }
});
$router.runOnConnect(port => {
  sendControl("worker-exists", undefined, port);
});
