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
 * @typedef {Object} CalIdentity
 * @property {String} email
 * @property {String} displayName
 * @property {Boolean} [isSelf=false]
 *
 * @param {CalIdentity} raw
 * @returns {CalIdentity}
 */
export function makeIdentityInfo(raw) {
  return {
    email: raw.email,
    displayName: raw.displayName,
    isSelf: raw.isSelf || false,
  };
}

/**
 *
 * @typedef {CalIdentity} AttendeeInfo
 * @property {Boolean} [isOrganizer=false]
 * @property {Boolean} [isResource=false]
 * @property {"needsAction"|"declined"|"tentative"|"accepted"} responseStatus
 * @property {String|null} comment
 * @property {Boolean} [isOptional=false]
 */
export function makeAttendeeInfo(raw) {
  return {
    email: raw.email,
    displayName: raw.displayName,
    isSelf: raw.isSelf || false,
    isOrganizer: raw.isOrganizer || false,
    isResource: raw.isResource || false,
    responseStatus: raw.responseStatus,
    comment: raw.comment || null,
    isOptional: raw.isOptional || false,
  };
}

/**
 * This is a first attempt at a variation of `makeMessageInfo` for calendar
 * events.  Whereas `makeMessageInfo` is paired with `MailMessage` in the client
 * API, this representation is provided to `CalEvent`.
 *
 * There are some fields for which we require overlap for either important
 * invariants (ex: date ordering) or for cases where it (may eventually)
 * simplify logic.  For example, for now we encode the `attendees` in the wire
 * rep as the `to` list, but we take the argument here as `attendees` and expose
 * it on the `CalEvent` as `attendees` as well.
 *
 * ## Open Semantic Issues
 *
 * - organizer versus creator
 *
 * ## Types
 *
 * @typedef {Object} ConferenceInfo
 * @property {URLString} icon
 * @property {String} name
 * @property {URLString} url
 *
 * @typedef {Object} LinkInfo
 * @property {URLString} url
 * @property {'conferencing'|null} type
 * @property {String} text
 *   Label for the link.
 *
 * @typedef {Object} CalEventInfoBase
 * @property {MessageId} id
 * @property {String} location
 * @property {DateMS} startDate
 *   Stopgap use of DateMS (JS millis since epoch), but this should potentially
 *   be something richer like an `ICAL.Time` JSON rep.
 * @property {DateMS} endDate
 * @property {Boolean} isAllDay
 * @property {CalIdentity} creator
 * @property {CalIdentity} organizer
 * @property {AttendeeInfo[]} attendees
 *   Do startDate/endDate correspond to an all-day event, also implying that the
 *   `startDate` and `endDate` are intended to represent a single day.
 * @property {ConferenceInfo} [conference]
 * @property {LinkInfo[]} links
 *
 * @typedef {CalEventInfoBase} CalEventInfoArgs
 * @property {String} summary
 *
 * @typedef {CalEventInfoBase} CalEventInfo
 * @property {String} subject
 *
 * ## Args / Rval
 * @param {CalEventInfoArgs} raw
 * @returns {CalEventInfo}
 */
export function makeCalendarEventInfo(raw) {
  return {
    id: raw.id,
    type: "cal",
    date: raw.date,
    //dateModified: raw.dateModified || raw.date,
    startDate: raw.startDate,
    endDate: raw.endDate,
    isAllDay: raw.isAllDay,
    creator: raw.creator,
    organizer: raw.organizer,
    attendees: raw.attendees || null,
    flags: raw.flags || [],
    folderIds: raw.folderIds || new Set(),
    subject: raw.summary ?? null,
    snippet: raw.snippet ?? null,
    bodyReps: raw.bodyReps,
    authoredBodySize: raw.authoredBodySize || 0,
    conference: raw.conference || null,
    links: raw.links || [],
  };
}
