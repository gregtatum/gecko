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

const modules = [];
const listeners = new Map();
let workerPort = null;

export function register(module) {
  modules.push(module);

  let action;
  if (module.process) {
    action = msg => {
      module.process(msg.uid, msg.cmd, msg.args);
    };
  } else if (module.dispatch) {
    action = msg => {
      if (module.dispatch[msg.cmd]) {
        module.dispatch[msg.cmd].apply(module.dispatch, msg.args);
      }
    };
  }

  const name = module.name;
  if (action) {
    listeners.set(name, action);
  }

  module.sendMessage = (uid, cmd, args, error = null) => {
    //dump('\x1b[34mM => w: send: ' + name + ' ' + uid + ' ' + cmd + '\x1b[0m\n');
    //debug('onmessage: ' + name + ": " + uid + " - " + cmd);
    try {
      workerPort.postMessage({
        type: name,
        uid,
        cmd,
        args,
        error,
      });
    } catch (ex) {
      console.error("Presumed DataCloneError on:", args, "ex:", ex);
    }
  };
}

export function unregister(module) {
  listeners.delete(module.name);
}

export function shutdown() {
  modules.forEach(module => {
    if (module.shutdown) {
      module.shutdown();
    }
  });
}

export function useWorker(worker) {
  // Currently we're assuming SharedWorker, but try and also handle being run
  // under a Worker as well.
  workerPort = worker.port || worker;

  workerPort.onmessage = function dispatchToListener(evt) {
    const { data } = evt;
    listeners.get(data.type)?.(data);
  };
}
