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

/* eslint-disable no-prototype-builtins */
var listeners = {};

export function receiveMessage(evt) {
  var data = evt.data;
  var listener = listeners[data.type];
  if (listener) {
    listener(data, evt.source);
  }
}

function receiveConnect(evt) {
  const port = evt.ports[0];
  if (!defaultPort) {
    defaultPort = port;
  }

  port.onmessage = receiveMessage;
}

const inSharedWorker = "onconnect" in globalThis;

let defaultPort;
if (!inSharedWorker) {
  defaultPort = globalThis;
  globalThis.addEventListener("message", receiveMessage);
} else {
  globalThis.addEventListener("connect", receiveConnect);
}

export function unregister(type) {
  delete listeners[type];
}

export function registerSimple(type, callback) {
  listeners[type] = callback;

  return function sendSimpleMessage(cmd, args) {
    globalThis.postMessage({ type, uid: null, cmd, args });
  };
}

var callbackSenders = {};

/**
 * Register a message type that allows sending messages that expect a return
 * message which should resolve the returned Promise.
 */
export function registerCallbackType(type) {
  if (callbackSenders.hasOwnProperty(type)) {
    return callbackSenders[type];
  }
  var callbacks = {};
  var uid = 0;
  listeners[type] = function receiveCallbackMessage(data) {
    var callback = callbacks[data.uid];
    if (!callback) {
      return;
    }
    delete callbacks[data.uid];

    callback(data.args);
  };

  var sender = function sendCallbackMessage(cmd, args) {
    return new Promise(resolve => {
      callbacks[uid] = resolve;

      globalThis.postMessage({ type, uid: uid++, cmd, args });
    });
  };
  callbackSenders[type] = sender;
  return sender;
}

/**
 * Register a message type that gets associated with a specific set of callbacks
 * keyed by 'cmd' for received messages.
 */
export function registerInstanceType(type) {
  var uid = 0;
  var instanceMap = {};
  listeners[type] = function receiveInstanceMessage(data) {
    var instanceListener = instanceMap[data.uid];
    if (!instanceListener) {
      return;
    }

    instanceListener(data);
  };

  return {
    register(instanceListener, explicitPort) {
      const usePort = explicitPort || defaultPort;
      var thisUid = uid++;
      instanceMap[thisUid] = instanceListener;

      return {
        sendMessage: function sendInstanceMessage(cmd, args, transferArgs) {
          usePort.postMessage({ type, uid: thisUid, cmd, args }, transferArgs);
        },
        unregister: function unregisterInstance() {
          delete instanceMap[thisUid];
        },
      };
    },
  };
}

export function shutdown() {
  globalThis.removeEventListener("message", receiveMessage);
  listeners = {};
  callbackSenders = {};
}
