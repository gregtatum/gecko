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

import * as mailRep from "../../db/mail_rep";
import { processEventContent } from "../../bodies/mailchew";
import { EVENT_OUTSIDE_SYNC_RANGE } from "shared/date";
import { makeMessageId } from "shared/id_conversions";
import {
  makeAttendeeInfo,
  makeCalendarEventInfo,
  makeIdentityInfo,
} from "backend/db/cal_event_rep";
import logic from "logic";

/**
 * Process events as provided by the `cal_sync_refresh` task (which may be new,
 * modified, or deleted) along with already known events for the given
 * set of events stemming from the same root recurring event.  This also
 * includes handling chnages to the sync window as given by `rangeOldestTS` and
 * `rangeNewestTS`.
 */
export class GapiCalEventChewer {
  constructor({
    ctx,
    convId,
    folderId,
    rangeOldestTS,
    rangeNewestTS,
    eventMap,
    oldConvInfo,
    oldEvents,
    foldersTOC,
  }) {
    this.ctx = ctx;
    this.convId = convId;
    this.folderId = folderId;
    this.rangeOldestTS = rangeOldestTS;
    this.rangeNewestTS = rangeNewestTS;
    this.eventMap = eventMap;

    this.oldConvInfo = oldConvInfo;
    this.oldEvents = oldEvents;
    this.foldersTOC = foldersTOC;

    // This is a mapping from the event id we synthesize.  Populated during
    // `chewEventBundle` where we first identify events outside the specified
    // sync window.
    this.oldById = new Map();

    this.unifiedEvents = [];

    this.modifiedEventMap = new Map();
    this.newEvents = [];
    this.allEvents = [];
  }

  _chewCalIdentity(raw) {
    return makeIdentityInfo({
      displayName: raw.displayName,
      email: raw.email,
      isSelf: raw.self,
    });
  }

  /**
   * Helper to map the GAPI attendee and creator/organizer reps to our
   * `AttendeeInfo` rep.  Technically creator/organizer should have a different
   * path,
   */
  _chewCalAttendee(raw) {
    return makeAttendeeInfo({
      displayName: raw.displayName,
      email: raw.email,
      isSelf: raw.self,
      isOrganizer: raw.organizer,
      isResource: raw.resource,
      responseStatus: raw.responseStatus,
      comment: raw.comment,
      isOptional: raw.optional,
    });
  }

  async chewEventBundle() {
    // ## Remove any old messages that no longer fit within the sync window.
    const oldById = this.oldById;
    for (const oldInfo of this.oldEvents) {
      if (EVENT_OUTSIDE_SYNC_RANGE(oldInfo, this)) {
        // Mark the event for deletion.
        this.modifiedEventMap.set(oldInfo.id, null);
      } else {
        // We're keeping the event.  Hooray!
        oldById.set(oldInfo.id, oldInfo);
        this.allEvents.push(oldInfo);
      }
    }

    // ## Process the new/modified/deleted events
    for (const gapiEvent of this.eventMap.values()) {
      try {
        const eventId = makeMessageId(this.convId, gapiEvent.id);
        if (gapiEvent.status === "cancelled") {
          // The event is now deleted!
          this.modifiedEventMap.set(eventId, null);
          logic(this.ctx, "cancelled", { _event: gapiEvent });
          continue;
        }

        logic(this.ctx, "event", { _event: gapiEvent });

        let contentBlob, snippet, authoredBodySize, links, conference;
        const bodyReps = [];

        // ## Generate an HTML body part for the description
        let description = gapiEvent.description;
        if (description) {
          description = description
            .trim()
            .replace(/&amp;/g, "&")
            .replace(/&nbsp;/g, " ")
            .replace(/<wbr>/g, "");
          ({
            contentBlob,
            snippet,
            authoredBodySize,
            links,
            conference,
          } = await processEventContent({
            data: gapiEvent,
            content: description,
            type: "html",
            processAsText: true,
          }));

          bodyReps.push(
            mailRep.makeBodyPart({
              type: "html",
              part: null,
              sizeEstimate: description.length,
              amountDownloaded: description.length,
              isDownloaded: true,
              _partInfo: null,
              contentBlob,
              authoredBodySize,
            })
          );
        }

        let startDate, endDate, isAllDay;
        if (!gapiEvent.start?.dateTime || !gapiEvent.end?.dateTime) {
          isAllDay = true;
          startDate = new Date(gapiEvent.start.date).valueOf();
          endDate = new Date(gapiEvent.end.date).valueOf();
        } else {
          isAllDay = false;
          startDate = new Date(gapiEvent.start.dateTime).valueOf();
          endDate = new Date(gapiEvent.end.dateTime).valueOf();
        }

        const summary = gapiEvent.summary;
        const creator = this._chewCalIdentity(gapiEvent.creator);
        const organizer = this._chewCalIdentity(gapiEvent.organizer);
        const location = gapiEvent.location || "";

        const attendees = (gapiEvent.attendees || []).map(who =>
          this._chewCalAttendee(who)
        );

        const oldInfo = this.oldById.get(eventId);

        const eventInfo = makeCalendarEventInfo({
          id: eventId,
          date: startDate,
          startDate,
          endDate,
          isAllDay,
          creator,
          organizer,
          attendees,
          location,
          // Propagate the flags which is currently the only thing that can have
          // been mutated locally and for which we don't have a way of stashing
          // it on the server.
          flags: oldInfo?.flags,
          folderIds: new Set([this.folderId]),
          summary,
          snippet,
          bodyReps,
          authoredBodySize,
          links,
          conference,
        });

        this.allEvents.push(eventInfo);
        if (oldInfo) {
          this.modifiedEventMap.set(eventId, eventInfo);
        } else {
          this.newEvents.push(eventInfo);
        }
      } catch (ex) {
        logic(this.ctx, "eventChewingError", { ex });
      }
    }
  }
}
