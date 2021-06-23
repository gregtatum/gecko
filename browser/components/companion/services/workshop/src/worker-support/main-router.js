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

let listeners = {};
let modules = [];
let worker = null;
let workerPort = null;

export function register(module) {
  var action,
    name = module.name;

  modules.push(module);

  if (module.process) {
    action = function(msg) {
      module.process(msg.uid, msg.cmd, msg.args);
    };
  } else if (module.dispatch) {
    action = function(msg) {
      if (module.dispatch[msg.cmd]) {
        module.dispatch[msg.cmd].apply(module.dispatch, msg.args);
      }
    };
  }

  listeners[name] = action;

  module.sendMessage = function(uid, cmd, args, transferArgs) {
    //dump('\x1b[34mM => w: send: ' + name + ' ' + uid + ' ' + cmd + '\x1b[0m\n');
    //debug('onmessage: ' + name + ": " + uid + " - " + cmd);
    try {
      workerPort.postMessage(
        {
          type: name,
          uid,
          cmd,
          args,
        },
        transferArgs
      );
    } catch (ex) {
      console.error(
        "Presumed DataCloneError on:",
        args,
        "with transfer args",
        transferArgs,
        "ex:",
        ex
      );
    }
  };
}

export function unregister(module) {
  delete listeners["on" + module.name];
}

export function shutdown() {
  modules.forEach(function(module) {
    if (module.shutdown) {
      module.shutdown();
    }
  });
}

export function useWorker(_worker) {
  worker = _worker;
  // Currently we're assuming SharedWorker, but try and also handle being run
  // under a Worker as well.
  if (worker.port) {
    workerPort = worker.port;
  } else {
    workerPort = worker;
  }
  workerPort.onmessage = function dispatchToListener(evt) {
    var data = evt.data;
    var listener = listeners[data.type];
    if (listener) {
      listener(data);
    }
  };
}
