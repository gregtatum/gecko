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

import evt from 'evt';

export default function RawItem(api, wireRep, overlays, matchInfo) {
  evt.Emitter.call(this);

  // TODO: have the keying id be parameterized, easiest is probably just to have
  // caller pass the id in since in the windowed case it already knows the id
  // since that's how the naming/mapping occurs.
  this.id = wireRep.id || wireRep._id;

  this.__update(wireRep);
  this.__updateOverlays(overlays);
  this.matchInfo = matchInfo;
}
RawItem.prototype = evt.mix({
  toString: function() {
    return '[RawItem]';
  },
  toJSON: function() {
    return {
      data: this.data
    };
  },

  /**
   * Loads the current unread message count as reported by the FolderStorage
   * backend. this.unread is the current number of unread messages that are
   * stored within the FolderStorage object for this folder. Thus, it only
   * accounts for messages which the user has loaded from the server.
   */
  __update: function(wireRep) {
    this.data = wireRep;
  },

  __updateOverlays: function(/*overlays*/) {
  },

  release: function() {
    // currently nothing to clean up
  }
});
