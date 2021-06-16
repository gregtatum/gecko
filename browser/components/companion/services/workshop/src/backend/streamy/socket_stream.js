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

define(function(require) {
'use strict';

const streams = require('streams');
const util = require('util');

/**
 * A Stream built from a mozTCPSocket. Data arrives in chunks to the readable
 * side of the stream; to send data, write to the writable side.
 */
return function SocketStream(socket) {
  socket = util.makeEventTarget(socket);

  function maybeCloseSocket() {
    if (socket.readyState !== 'closing' && socket.readyState !== 'closed') {
      socket.close();
    }
  }

  this.readable = new streams.ReadableStream({
    start: function(c) {
      socket.addEventListener('data', (evt) => {
        c.enqueue(new Uint8Array(evt.data));
      });
      socket.addEventListener('close', () => {
        try {
          c.close();
        } catch(e) {
          // The stream has already been closed.
        }
      });
      socket.addEventListener('error', (evt) => c.error(evt.data || evt));
    },
    cancel: function() {
      maybeCloseSocket();
    }
  });

  this.writable = new streams.WritableStream({
    start: function(error) {
      socket.addEventListener('error', (evt) => error(evt.data || evt));
    },
    write: function(chunk) {
      socket.send(chunk);
      // We don't know when send completes, so this is synchronous.
    },
    close: function() {
      maybeCloseSocket();
    }
  });
};
});
