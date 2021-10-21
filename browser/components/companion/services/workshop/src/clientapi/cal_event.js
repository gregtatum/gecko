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

import { Emitter } from "evt";

import { keyedListHelper } from "./keyed_list_helper";

import { CalAttendee } from "./cal_attendee";

function filterOutBuiltinFlags(flags) {
  // so, we could mutate in-place if we were sure the wire rep actually came
  // over the wire.  Right now there is de facto rep sharing, so let's not
  // mutate and screw ourselves over.
  const outFlags = [];
  for (let i = flags.length - 1; i >= 0; i--) {
    if (flags[i][0] !== "\\") {
      outFlags.push(flags[i]);
    }
  }
  return outFlags;
}

/**
 * First attempt at a calendar-event specific variant of MailMessage.
 */
export class CalEvent extends Emitter {
  constructor(api, wireRep, overlays, matchInfo, slice) {
    super();
    this._api = api;
    this._slice = slice;

    // Note: The _wireRep is currently maintained for debugging / inspection but
    // is a candidate for removal in the future.  Previously it was retained
    // so the fast startup layer could cache all visible objects.
    this._wireRep = wireRep;

    this.id = wireRep.id;

    this.attendees = [];
    this.creator = wireRep.creator;
    this.organizer = wireRep.organizer;

    this.bodyReps = wireRep.bodyReps;

    this.__update(wireRep);
    this.__updateOverlays(overlays);

    this.matchInfo = matchInfo;
    this.type = "cal";
  }

  toString() {
    return "[CalEvent: " + this.id + "]";
  }

  toJSON() {
    return {
      type: "CalEvent",
      id: this.id,
    };
  }

  __update(wireRep) {
    this._wireRep = wireRep;
    if (wireRep.snippet !== null) {
      this.snippet = wireRep.snippet;
    }

    this.date = new Date(wireRep.date);
    this.startDate = new Date(wireRep.startDate);
    this.endDate = new Date(wireRep.endDate);
    this.isAllDay = wireRep.isAllDay;
    this.isRecurring = wireRep.isRecurring;

    this.summary = wireRep.subject;
    this.snippet = wireRep.snippet;

    // Note: Leaving these around for now as they're extensible, but I've
    // removed the more mail specific `isRead`/etc. states as those were all
    // based on IMAP standard flags which can perhaps be moot now if we're
    // abandoning IMAP.
    this.tags = filterOutBuiltinFlags(wireRep.flags);
    this.labels = this._api._mapLabels(this.id, wireRep.folderIds);

    this.bodyReps = wireRep.bodyReps;

    this.attendees = keyedListHelper({
      wireReps: wireRep.attendees,
      existingRichReps: this.attendees,
      constructor: CalAttendee,
      owner: this,
      idKey: "email",
      addEvent: "attendee:add",
      changeEvent: "attendee:change",
      removeEvent: "attendee:remove",
    });
  }

  __updateOverlays(overlays) {
    // Nothing to do at this time; MailMessage did this for attachment download
    // states.
  }

  /**
   * Release subscriptions associated with this event.  Currently nothing, but
   * the `CalAttendee` instances may soon be live.
   */
  release() {
    // nop.
  }

  /**
   * Add and/or remove tags/flags from this message.
   *
   * @param {String[]} [args.addTags]
   * @param {String[]} [args.removeTags]
   */
  modifyTags(args) {
    return this._api.modifyTags([this], args);
  }
}
