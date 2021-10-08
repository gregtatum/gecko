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
import { makeMapiCalEventId } from "./mapi_id_helpers";
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
export class MapiCalEventChewer {
  constructor({
    ctx,
    convId,
    recurringId,
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
    this.recurringId = recurringId;
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
    const email = raw.emailAddress;
    return makeIdentityInfo({
      displayName: email.name,
      email: email.address,
      isSelf: false,
    });
  }

  /**
   * Helper to map the MAPI attendee and creator/organizer reps to our
   * `AttendeeInfo` rep.  Technically creator/organizer should have a different
   * path,
   */
  _chewCalAttendee(raw, organizer) {
    const email = raw.emailAddress;
    const type = raw.type;
    return makeAttendeeInfo({
      displayName: email.name,
      email: email.address,
      isSelf: false,
      isOrganizer:
        email.address === organizer.email &&
        email.name === organizer.displayName,
      isResource: type === "resource",
      responseStatus: raw.status,
      comment: "",
      isOptional: type === "optional",
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

    let mainEvent = null;
    if (this.eventMap.size > 1) {
      // The main event is a dummy event which contains main info.
      mainEvent = this.eventMap.get(this.recurringId);
      this.eventMap.delete(this.recurringId);
    }

    // ## Process the new/modified/deleted events
    for (const mapiEvent of this.eventMap.values()) {
      try {
        const eventId = makeMapiCalEventId(this.convId, mapiEvent.id);
        if (mainEvent && mapiEvent !== mainEvent) {
          // The main event can contain some fields (like organizer) that
          // the occurences haven't.
          for (const [key, value] of Object.entries(mainEvent)) {
            if (!(key in mapiEvent)) {
              mapiEvent[key] = value;
            }
          }
        }

        if (mapiEvent.isCancelled) {
          // The event is now deleted!
          this.modifiedEventMap.set(eventId, null);
          logic(this.ctx, "cancelled", { _event: mapiEvent });
          return;
        }

        logic(this.ctx, "event", { _event: mapiEvent });

        let contentBlob, snippet, authoredBodySize, links, conference;
        const bodyReps = [];

        // ## Generate an HTML body part for the description
        const body = mapiEvent.body;
        if (body?.content) {
          const { content, contentType: type } = body;
          ({
            contentBlob,
            snippet,
            authoredBodySize,
            links,
            conference,
          } = await processEventContent({
            data: mapiEvent,
            content,
            type,
          }));

          bodyReps.push(
            mailRep.makeBodyPart({
              type,
              part: null,
              sizeEstimate: content.length,
              amountDownloaded: content.length,
              isDownloaded: true,
              _partInfo: null,
              contentBlob,
              authoredBodySize,
            })
          );
        }

        const isAllDay = mapiEvent.isAllDay;

        // TODO: use the timeZone field to set the correct timezone.
        // For now, consider that all dates are UTC.
        const startDate = new Date(mapiEvent.start.dateTime + "Z").valueOf();
        const endDate = new Date(mapiEvent.end.dateTime + "Z").valueOf();

        const summary = mapiEvent.subject;

        const organizer = this._chewCalIdentity(mapiEvent.organizer);
        const creator = organizer;
        const eventLocation = mapiEvent.location;
        const location = `${eventLocation.displayName}@${eventLocation.address}`;

        const attendees = (mapiEvent.attendees || []).map(who => {
          return this._chewCalAttendee(who, organizer);
        });

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
