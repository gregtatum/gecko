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

import evt from "evt";

import { showBlobInImg } from "./blob_helpers";

/**
 * See `identities.md`.
 */
export default function MailPeep(name, address, contactId, thumbnailBlob) {
  evt.Emitter.call(this);

  this.name = name;
  this.address = address;
  this.contactId = contactId;
  this._thumbnailBlob = thumbnailBlob;

  // peeps are usually one of: from, to, cc, bcc
  this.type = null;
}
MailPeep.prototype = evt.mix({
  get isContact() {
    return this.contactId !== null;
  },

  toString() {
    return "[MailPeep: " + this.address + "]";
  },
  toJSON() {
    return {
      name: this.name,
      address: this.address,
      contactId: this.contactId,
    };
  },
  toWireRep() {
    return {
      name: this.name,
      address: this.address,
    };
  },

  get hasPicture() {
    return this._thumbnailBlob !== null;
  },
  /**
   * Display the contact's thumbnail on the given image node, abstracting away
   * the issue of Blob URL life-cycle management.
   */
  displayPictureInImageTag(imgNode) {
    if (this._thumbnailBlob) {
      showBlobInImg(imgNode, this._thumbnailBlob);
    }
  },
});
