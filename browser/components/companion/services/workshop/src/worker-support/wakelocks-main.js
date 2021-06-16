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
 * The docs for this can be found in `mailapi/wakelocks.js`.
 *
 * This file runs on the main thread, receiving messages sent from a
 * SmartWakeLock instance -> through the router -> to this file.
 */
let nextId = 1;
let locks = new Map();

function requestWakeLock(type) {
  var lock;
  if (navigator.requestWakeLock) {
    lock = navigator.requestWakeLock(type);
  }
  var id = nextId++;
  locks.set(id, lock);
  return id;
}

var me = {
  name: 'wakelocks',
  sendMessage: null,
  process: function(uid, cmd, args) {
    switch (cmd) {
      case 'requestWakeLock':
        var type = args[0];
        me.sendMessage(uid, cmd, [requestWakeLock(type)]);
        break;
      case 'unlock':
        var id = args[0];
        var lock = locks.get(id);
        if (lock) {
          lock.unlock();
          locks.delete(id);
        }
        me.sendMessage(uid, cmd, []);
        break;
      default:
        break;
    }
  },

  // Expose the request method locally so that cronsync-main can acquire a
  // wake-lock to hand off to the back-end.
  requestWakeLock
};

export default me;