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

/**
 * Represents a calendar attendee, wrapping both the mutable RVSP information
 * (are they attending, possibly how they are attending, any comment) plus
 * any identity information and realtime presence/busy-ness information we
 * acquire.
 *
 * Originally in the mail-only implementation we had `MailPeep` which overrode
 * the in-email display name information with local-addressbook information via
 * the mozContacts API.  For now, CalAttendee will monolithically combine both
 * the attendance information with the attendance information, but in the
 * future it might make sense to extract the identity information out into a
 * common `Peep` (or better named) class.  Or this could just subclass that.
 */
export default function CalAttendee(_event, wireRep) {
  evt.Emitter.call(this);

  this._event = _event;

  this.__update(wireRep);
}
CalAttendee.prototype = evt.mix({
  toString() {
    return '[CalAttendee: "' + this.email + '"]';
  },
  toJSON() {
    return {
      type: "CalAttendee",
      filename: this.filename,
    };
  },

  __update(wireRep) {
    // Identity aspects
    this.email = wireRep.email;
    this.displayName = wireRep.displayName;

    this.isSelf = wireRep.isSelf; // "self" as exposed by gapi
    this.isOrganizer = wireRep.isOrganizer; // "organizer" as exposed by gapi
    this.isResource = wireRep.isResource;

    // Attendance aspects
    this.responseStatus = wireRep.responseStatus;
    this.comment = wireRep.comment;
    this.isOptional = wireRep.isOptional;
  },
});
