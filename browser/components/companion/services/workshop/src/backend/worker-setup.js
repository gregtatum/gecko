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
 * This is the actual root module
 **/

import logic from "logic";

import * as $router from "./worker-router";
import MailBridge from "./mailbridge";
import MailUniverse from "./mailuniverse";

import appExtensions from "app_logic/worker_extensions";

const routerBridgeMaker = $router.registerInstanceType("bridge");

let bridgeUniqueIdentifier = 0;
function createBridgePair(universe, usePort) {
  var uid = bridgeUniqueIdentifier++;

  var TMB = new MailBridge(universe, universe.db, uid);
  var routerInfo = routerBridgeMaker.register(function(data) {
    TMB.__receiveMessage(data.msg);
  }, usePort);
  var sendMessage = routerInfo.sendMessage;

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
  source
) {
  var args = data.args;
  switch (data.cmd) {
    case "hello": {
      if (!universe) {
        universe = new MailUniverse({
          online: args[0],
          appExtensions,
        });
        universePromise = universe.init();
      }
      await universePromise;
      createBridgePair(universe, source);
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
sendControl("hello");
