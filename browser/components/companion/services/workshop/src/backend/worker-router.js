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

let nextMessageUid = 0;
let onConnectHandler = null;
const allPorts = new Set();
const callbackSenders = new Map();

/**
 * Some APIs live in the main thread and consequently they cannot
 * be used directly in the worker.
 * In order to use them:
 *   - choose a port in the list of open ports.
 *   - send a message which will be treated on the main thread and it'll send back
 *     a response with whatever. So in order to achieve that, for each sent message
 *     we store the pair (resolve, reject) in order to call the resolve on the response
 *     (or the reject if any errors).
 *     But if the window at the other side (connected to the used port) is closing
 *     then the message will never be treated and the promise will never be resolved.
 *     So when the window is dying, it must send a willDie message in order to send
 *     again the message using another port.
 */

const listeners = new Map([
  [
    "willDie",
    (data, port) => {
      allPorts.remove(port);
      for (const { message, resolve, reject } of port._messages.values()) {
        _eventuallySendToDefaultHelper(message, resolve, reject);
      }
    },
  ],
]);

onconnect = connectionEvent => {
  const port = connectionEvent.ports[0];

  // Track all the available ports
  allPorts.add(port);

  // This map contains the messages which don't care about
  // the port itself: in case the port is closed (using "willDie" type)
  // then all messages are re-sent using another port.
  const portMessages = (port._messages = new Map());

  port.onmessage = messageEvent => {
    // TODO: maybe it's useless and can never happen.
    // so check if we can safely remove that stuff.
    if (!allPorts.has(port)) {
      return;
    }

    const { data } = messageEvent;
    if (portMessages.has(data.uid)) {
      const { uid, cmd, args, error } = data;
      const { resolve, reject } = portMessages.get(uid);
      portMessages.delete(uid);

      if (error) {
        reject(new Error(error));
      } else {
        resolve({ cmd, args });
      }
    } else {
      listeners.get(data.type)?.(data, port);
    }
  };

  onConnectHandler?.(port);
};

export function runOnConnect(handler) {
  onConnectHandler = handler;
}

function getFirstPort() {
  return allPorts.values().next().value;
}

function _eventuallySendToDefaultHelper(message, resolve, reject) {
  const port = getFirstPort();
  if (!port) {
    reject(new Error("No default route to the main thread."));
    return;
  }

  const uid = (message.uid = nextMessageUid++);
  port._messages.set(uid, { message, resolve, reject });
  port.postMessage(message);
}

/**
 * Send a message in using an available port.
 * It must be used only when the port doesn't matter
 * (for example to call a function which must live on the main thread).
 */
async function eventuallySendToDefault(message) {
  return new Promise((resolve, reject) => {
    _eventuallySendToDefaultHelper(message, resolve, reject);
  });
}

export function unregister(type) {
  listeners.delete(type);
}

export function registerSimple(type, callback) {
  listeners.set(type, callback);

  return function sendSimpleMessage(cmd, args, explicitPort) {
    const msg = { type, uid: null, cmd, args };
    if (explicitPort) {
      explicitPort.postMessage(msg);
    } else {
      eventuallySendToDefault(msg).then(callback);
    }
  };
}

/**
 * Register a message type that allows sending messages that expect a return
 * message which should resolve the returned Promise.
 */
export function registerCallbackType(type) {
  let sender = callbackSenders.get(type);
  if (!sender) {
    sender = function sendCallbackMessage(cmd, args) {
      return eventuallySendToDefault({ type, cmd, args });
    };
    callbackSenders.set(type, sender);
  }
  return sender;
}

/**
 * Register a message type that gets associated with a specific set of callbacks
 * keyed by 'cmd' for received messages.
 */
export function registerInstanceType(type) {
  const instanceMap = new Map();
  listeners.set(type, function receiveInstanceMessage(data) {
    instanceMap.get(data.uid)?.(data);
  });

  return {
    register(instanceListener, usePort) {
      const uid = nextMessageUid++;
      instanceMap.set(uid, instanceListener);

      return {
        sendMessage: function sendInstanceMessage(cmd, args) {
          usePort.postMessage({ type, uid, cmd, args });
        },
        unregister: function unregisterInstance() {
          instanceMap.delete(uid);
        },
      };
    },
  };
}

export function shutdown() {
  allPorts.clear();
  listeners.clear();
  callbackSenders.clear();
}

export async function callOnMainThread({ cmd, args }) {
  const { args: result } = await eventuallySendToDefault({
    type: "mainThreadService",
    cmd,
    args,
  });
  return result;
}
