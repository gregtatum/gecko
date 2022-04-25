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

// eslint-disable-next-line no-unused-vars
const EXPORTED_SYMBOLS = ["GapiFakeServer", "MapiFakeServer", "FeedFakeServer"];

const { HttpError } = ChromeUtils.import("resource://testing-common/httpd.js");

function backdate(date, { days }) {
  return date.valueOf() - days * 24 * 60 * 60 * 1000;
}

function nowTs() {
  return new Date().valueOf();
}

function backdatedISOString(date, delta) {
  return new Date(backdate(date, delta)).toISOString();
}

const DURATIONS = new Map([
  ["minute", 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["2-weeks", 2 * 7 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
]);

class FakeCalendar {
  constructor(
    serverOwner,
    isMapi,
    { id, name, events, calendarOwner, accessRole, owner }
  ) {
    this.serverOwner = serverOwner;
    this.id = id;
    this.name = name;
    this.events = this.#convertEvents(events || []);
    this.calendarOwner = calendarOwner;
    this.serial = 0;
    this.isMapi = isMapi;
    this.selected = true;
    this.accessRole = accessRole;
    this.owner = owner;
  }

  /**
   * Convert a "full" event rep produced by the `FakeEventFactory` into our
   * internal representation.  Which right now means adding:
   * - id: A server-internal unique identifier.
   * - icalUID: A ical-standard unique identifier which is decoupled from the
   *   server-internal identifier.
   * - serial: Mutation sequence number for sync purposes.
   * - alterationTs: a timestamp corresponding to the last alteration (it'll be
   *   used to compare with timestamp in the syncToken when getting some
   *   events).
   * - recurringId: base id to identify the main event and its derivated.
   */
  #convertEvents(events) {
    let previousSummary = "";
    let recurringId;
    return events.map(rawEvent => {
      const { serverId, icalId } = this.serverOwner.issueEventIds(rawEvent);
      const result = Object.assign(
        {
          // gapi: base32 constraint: 0-9, a-v
          id: serverId,
          iCalUID: icalId,
          serial: this.serial,
          alterationTs: nowTs(),
        },
        rawEvent
      );
      if (rawEvent.every) {
        result.recurrenceRules = [rawEvent.every];
        if (previousSummary !== rawEvent.summary) {
          recurringId = serverId;
          previousSummary = rawEvent.summary;
        }
        result.recurringId = recurringId;
      }
      return result;
    });
  }

  addEvents(events) {
    const newEvents = this.#convertEvents(events);
    this.events.push(...newEvents);
  }

  /**
   * Change events in using their summary as an uid.
   * @param events
   */
  changeEvents(events) {
    for (const event of events) {
      const e = this.events.find(x => x.summary === event.summary);
      for (const [key, value] of Object.entries(event)) {
        e[key] = value;
      }
    }
  }

  /**
   * Cancel the event with the given summary starting at the given dates or all
   * the event if no dates.
   * @param {string} summary
   * @param {Array<Date>|undefined} nths
   * @param {boolean} removeRecurrentId
   */
  cancelEvent(summary, startDates, removeRecurrentId) {
    const event = this.events.find(x => x.summary === summary);
    if (!event.every || !startDates || startDates.length === 0) {
      event.cancelled = true;
      event.alterationTs = nowTs();
      return;
    }

    const eventDuration = event.endDate - event.startDate;
    for (const startDate of startDates) {
      const id = `${event.recurringId}-${startDate.valueOf()}`;
      const newEvent = Object.assign({}, event);
      newEvent.startDate = startDate;
      newEvent.endDate = new Date(startDate.valueOf() + eventDuration);
      delete newEvent.every;
      delete newEvent.recurrenceRules;
      Object.assign(newEvent, {
        id,
        iCalUID: id,
        serial: this.serial,
        recurringId: removeRecurrentId ? undefined : event.recurringId,
        cancelled: true,
        alterationTs: nowTs(),
      });

      // Add these fake events (fake because they've been cancelled).
      this.events.push(newEvent);

      if (this.isMapi) {
        // When an instance of a recurring event is cancelled then we must
        // push all the instances except the cancelled one in the next update.
        event.alterationTs = nowTs();
      }
    }
  }

  changeSecondInstAndFollowing(summary, newSummary) {
    const event = this.events.find(x => x.summary === summary);
    const duration = DURATIONS.get(event.every);
    const secondStartDate = new Date(event.startDate.valueOf() + duration);

    const eventDuration = event.endDate - event.startDate;
    const { serverId } = this.serverOwner.issueEventIds();

    const newEvent = Object.assign({}, event, {
      summary: newSummary,
      serial: this.serial,
      id: serverId,
      recurringId: serverId,
      alterationTs: nowTs(),
      baseId: event.recurringId,
      startDate: secondStartDate,
      endDate: new Date(secondStartDate.valueOf() + eventDuration),
    });

    this.events.push(newEvent);

    delete event.every;
    delete event.recurrenceRules;
    delete event.recurringId;
    event.alterationTs = nowTs();
  }

  changeStartingDate(summary, isMapi) {
    const event = this.events.find(x => x.summary === summary);
    event.alterationTs = nowTs();
    if (isMapi || !event.every) {
      event.startDate + 1000;
      return;
    }

    const { serverId } = this.serverOwner.issueEventIds();
    Object.assign(event, {
      serial: this.serial,
      id: serverId,
      startDate: event.startDate + 1000,
    });
  }

  getEventWithId(id) {
    const event = this.events.find(x => x.id === id);
    return Object.assign({}, event, { recurringId: undefined });
  }

  getEventsInRange({ start, end, token }) {
    let lastGetTs, serial;
    if (token) {
      [start, end, lastGetTs, serial] = token.split(":").map(x => parseInt(x));
      [start, end] = [start, end].map(x => new Date(x));
      if (serial !== this.serial) {
        // serial has changed, so consider all events whatever their
        // alterationTs are.
        lastGetTs = 0;
      }
    } else {
      serial = this.serial;
      lastGetTs = 0;
      start = new Date(start);
      end = new Date(end);
    }

    const events = [];
    for (const event of this.events) {
      if (event.alterationTs <= lastGetTs) {
        continue;
      }

      if (!event.every) {
        if (start <= event.startDate && event.startDate <= end) {
          events.push(event);
        }
        continue;
      }

      // Look for the number (n) of cycles to have an event in the range.
      const { startDate, endDate } = event;
      const eventDuration = endDate - startDate;
      const duration = DURATIONS.get(event.every);
      const lowerN = Math.max(0, Math.ceil((start - startDate) / duration));
      const upperN = Math.floor((end - startDate) / duration);

      for (let n = lowerN; n <= upperN; n++) {
        const newEvent = Object.assign({}, event);
        delete newEvent.recurrenceRules;
        newEvent.startDate = new Date(startDate.valueOf() + n * duration);
        newEvent.endDate = new Date(
          newEvent.startDate.valueOf() + eventDuration
        );
        const baseId = event.baseId || event.recurringId;
        const id = `${baseId}-${newEvent.startDate.valueOf()}`;
        const index = this.events.findIndex(x => x.id === id);
        if (!this.isMapi || index === -1) {
          // In MAPI case if the event exist in the list it means that it
          // has been cancelled and so we don't push it.

          Object.assign(newEvent, {
            id,
            iCalUID: id,
            serial: this.serial,
            recurringId: event.recurringId,
          });
          events.push(newEvent);
        }
      }
    }

    lastGetTs = nowTs();
    const syncToken = `${start.valueOf()}:${end.valueOf()}:${lastGetTs}:${
      this.serial
    }`;
    return { syncToken, events };
  }
}

class BaseFakeServer {
  #nextEventId;

  constructor({ httpServer, logRequest }) {
    this.server = httpServer;

    this.oauthTokens = "access-token";

    this.calendars = [];
    this.pagedStateByPageToken = new Map();
    this.#nextEventId = 0;

    this.logRequest = logRequest;

    this.pageSize = 10;
    this.useNowTS = nowTs();
    this.errorQueue = [];
    this.isMapi = false;
  }

  /**
   * Increment the serial of each calendar: next get will return all the events.
   * It's helpful to test that the backend won't have any doubloons in case of
   * server issues.
   */
  invalidateCalendarTokens() {
    // Update calendar serial in order to have all the events in the next call
    // to getEventsInRange.
    for (const calendar of this.calendars) {
      calendar.serial++;
    }
  }

  /**
   *
   * @typedef {Object} FakeServerError
   * @property {number} code - Code of the error.
   * @property {string} message - Message for the error.
   */

  /**
   * Until the error queue (fifo) is empty, the server will return those errors.
   * @param {Array<FakeServerError>} errors - The errors to push in the queue.
   */
  addErrors(errors) {
    this.errorQueue.push(...errors);
  }

  getCalendarById(id) {
    return this.calendars.find(x => x.id === id);
  }

  resetCalendars() {
    this.calendars = [];
  }

  /**
   * Set the feed to use if any.
   * @param {string} feedStr - A string representation of the xml/html to serve.
   */
  setFeed(feedStr) {
    this.feed = feedStr;
  }

  // old, maybe reuse
  _makeNowDate() {
    if (this._useNowTimestamp) {
      var ts = this._useNowTimestamp;
      this._useNowTimestamp += 1000;
      return new Date(ts);
    }
    return new Date();
  }

  issueEventIds(rawEvent) {
    const useEventId = rawEvent?.id || this.#nextEventId++;
    return {
      serverId: `srv${useEventId}`,
      icalId: `${useEventId}@${this.domain}`,
    };
  }

  issueRecurringEventId() {
    return `recurring${this.#nextEventId++}`;
  }

  populateCalendar(calendarArgs) {
    const fakeCalendar = new FakeCalendar(this, this.isMapi, calendarArgs);
    this.calendars.push(fakeCalendar);
    return fakeCalendar;
  }

  paged(handlerMethod) {
    handlerMethod.paged = true;
    return handlerMethod;
  }

  unpaged(handlerMethod) {
    handlerMethod.paged = false;
    return handlerMethod;
  }

  registerAPIHandlers(handlers) {
    for (const handlerInfo of handlers) {
      if (handlerInfo.prefix) {
        this.server.registerPrefixHandler(
          handlerInfo.prefix,
          this.apiWrapper.bind(this, handlerInfo, handlerInfo.prefix)
        );
      } else if (handlerInfo.path) {
        this.server.registerPathHandler(
          handlerInfo.path,
          this.apiWrapper.bind(this, handlerInfo, handlerInfo.path)
        );
      } else {
        console.error("Bad API handler definition:", handlerInfo);
        throw new Error("Bad API_HANDLER definition!");
      }
    }
  }

  htmlLinkForEvent(cal, event) {
    return `${this.origin}/blah/${cal.id}/${event.id}`;
  }

  wrapResults(results, isPaged, args) {
    return {
      results,
      strResults: JSON.stringify(results),
      mimeType: "application/json",
    };
  }

  /**
   * Support wrapper for API calls that can return paged sets of results.  This
   * wrapper calls the underlying `paged_FOO` method whenever a fresh and
   * complete set of results should be retrieved and then paged.
   */
  apiWrapper(handlerInfo, pathOrPrefix, req, resp) {
    if (this.errorQueue.length) {
      const error = this.errorQueue.shift();
      this.logRequest("requestError on purpose", { error });
      resp.setStatusLine(null, error.code, "Fake Server Error");
      resp.setHeader("Content-Type", "application/json");
      resp.write(JSON.stringify({ error }));
      return;
    }

    try {
      this.logRequest("request", { path: req.path });
      const args = {};
      const extraPath = req.path.substring(pathOrPrefix.length);
      let methodName = null;
      if (handlerInfo.extraPathSegments) {
        const pieces = extraPath.split("/");
        for (let iPiece = 0; iPiece < pieces.length; iPiece++) {
          const desc = handlerInfo.extraPathSegments[iPiece];
          if (desc) {
            if (desc === "*METHOD*") {
              methodName = pieces[iPiece];
            }
            args[desc] = pieces[iPiece];
          }
        }
      }

      const handler =
        handlerInfo.methodHandlers?.[methodName] || handlerInfo.handler;

      try {
        // XXX for now, don't do any paging yet, we just wrap.
        const isPaged = handler.paged;
        const { strResults, results, mimeType } = this.wrapResults(
          handler.call(this, args, req),
          isPaged,
          args
        );

        this.logRequest(req.path, { results });

        resp.setStatusLine(null, 200, "OK");
        resp.setHeader("Content-Type", mimeType);
        resp.write(strResults);
      } catch (ex) {
        this.logRequest(req.path, { error: `${ex}`, stack: ex.stack });
        if (ex instanceof HttpError) {
          resp.setStatusLine(null, ex.code, ex.description);
        } else {
          resp.setStatusLine(null, 500, `handler threw: ${ex}`);
        }
      }
    } catch (ex) {
      this.logRequest("requestError", { ex: ex.toString() });
    }
  }
}

// eslint-disable-next-line no-unused-vars
class GapiFakeServer extends BaseFakeServer {
  /**
   * Start the server on the first available port.  Port information will be
   * made available on the `domain`, `origin`, and `domainInfo` properties.
   */
  start() {
    const API_HANDLERS = [
      // ## OAuth support
      {
        path: "/o/oauth2/v2/auth",
        handler: this.unpaged(this.unpaged_oauth_endpoint),
      },
      {
        path: "/token",
        handler: this.unpaged(this.unpaged_oauth_token),
      },
      // `https://gmail.googleapis.com/gmail/v1/users/${userId}/METHOD`
      {
        prefix: "/gmail/v1/users/",
        extraPathSegments: ["userId", "*METHOD*"],
        methodHandlers: {
          profile: this.unpaged(this.unpaged_userProfile),
        },
      },
      // `/calendar/v3/users/${userId}/METHOD`
      {
        path: "/calendar/v3/users/me/calendarList",
        handler: this.paged(this.paged_calendarList),
      },
      {
        // prefix for `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/METHOD/${eventId}`
        prefix: "/calendar/v3/calendars/",
        extraPathSegments: ["calendarId", "*METHOD*", "eventId"],
        methodHandlers: {
          events: this.paged(this.paged_calendarEvents),
        },
      },
      {
        path: "/mail/u/0/feed/atom",
        handler: this.unpaged(this.unpaged_gmail_feed),
      },
      {
        // prefix for `https://docs.googleapis.com/v1/documents/${id}`
        prefix: "/v1/documents/",
        extraPathSegments: ["id"],
        handler: this.unpaged(this.unpaged_document),
      },
      {
        // prefix for `https://sheets.googleapis.com/v4/spreadsheets/${id}`
        prefix: "/v4/spreadsheets/",
        extraPathSegments: ["id"],
        handler: this.unpaged(this.unpaged_spreadsheets),
      },
      {
        // prefix for https://www.googleapis.com/drive/v3/files/${id}
        prefix: "/drive/v3/files/",
        extraPathSegments: ["id"],
        handler: this.unpaged(this.unpaged_drive),
      },
    ];

    this.registerAPIHandlers(API_HANDLERS);

    const ident = this.server.identity;
    this.domain = `${ident.primaryHost}:${ident.primaryPort}`;
    this.origin = `${ident.primaryScheme}://${this.domain}`;
    this.specialTitle = "special-0";

    this.testUserEmail = `test-user@${ident.primaryHost}`;

    // Since we are the server that validates this info, we currently don't care
    // about most of these values.
    this.domainInfo = {
      type: "gapi",
      oauth2Settings: {
        // we're now using proxy magic so we can use the real domains.
        authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        scope: "scope1 scope2 scope3 scope4",
      },
      oauth2Secrets: {
        clientId: "imaClient",
        clientSecret: "imaSecret",
      },
      oauth2Tokens: {
        refreshToken: "refreshing-token",
        accessToken: "valid0",
        tokenExpires: this.useNowTS + 24 * 60 * 60 * 1000,
      },
    };
  }

  changeSpecialTitle(title) {
    this.specialTitle = title;
  }

  wrapResults(results, isPaged, args) {
    if (results.strResults && results.mimeType) {
      // Already wrapped so nothing to do.
      return results;
    }
    if (isPaged) {
      if (Array.isArray(results)) {
        return super.wrapResults(
          {
            kind: "not-a-real-type",
            etag: "not-a-real-etag",
            items: results,
            nextSyncToken: args.syncToken || "not-a-real-sync-token-yet",
          },
          isPaged,
          args
        );
      }
      return super.wrapResults(
        {
          kind: "not-a-real-type",
          etag: "not-a-real-etag",
          ...results,
          nextSyncToken: args.syncToken || "not-a-real-sync-token-yet",
        },
        isPaged,
        args
      );
    }
    return super.wrapResults(results, isPaged, args);
  }

  unpaged_gmail_feed() {
    return {
      results: this.feed,
      strResults: this.feed,
      mimeType: "application/xml",
    };
  }

  /**
   * Eh, we don't need the auth endpoint quite yet.  It's expected that the
   * front-end is responsible for hitting the auth endpoint and performing
   * the initial redemption to get the refresh token.  When we start doing
   * more full-fledged integration tests we'll need this.
   */
  unpaged_oauth_endpoint() {
    throw new HttpError(400, "OAuth Endpoint Not Implemented Yet");
  }

  /**
   * The token endpoint.  Currently this assumes the caller is providing a
   * valid refresh token.
   */
  unpaged_oauth_token() {
    var nextAccessToken;
    if (typeof this.oauthTokens === "string") {
      nextAccessToken = this.oauthTokens;
    } else {
      nextAccessToken = this.oauthTokens.shift();
    }

    return {
      access_token: nextAccessToken,
      expires_in: 60 * 60,
      token_type: "Bearer",
    };
  }

  unpaged_userProfile({ userId }) {
    if (userId === "me") {
      return {
        emailAddress: this.testUserEmail,
        messagesTotal: 0,
        threadsTotal: 0,
        hsitoryId: "nope",
      };
    }

    throw new HttpError(400, "Only 'me' is implemented.");
  }

  unpaged_document({ id }) {
    if (id === "invalid") {
      return {
        error: "Invalid id",
        title: "why not having a title if I want",
      };
    }

    if (id === "special") {
      id = this.specialTitle;
    }
    return {
      title: `document: id is ${id}`,
    };
  }

  unpaged_spreadsheets({ id }) {
    return {
      properties: { title: `spreadsheets: id is ${id}` },
    };
  }

  unpaged_drive({ id }) {
    return {
      name: `drive: id is ${id}`,
    };
  }

  etagFromEvent(event) {
    // In the future this will to include
    return `Etag-#{event.id}-${event.serial}`;
  }

  paged_calendarList(args, req) {
    return this.calendars.map(cal => {
      return {
        id: cal.id,
        summary: cal.name,
        description: `This is the ${cal.name} for sure.`,
        kind: "calendar#calendar",
        // TODO: add the timeZone here for fidelity purposes, etc.
        // Currently all known calendars will be of interest for sync purposes.
        selected: cal.selected,
        accessRole: cal.accessRole || "owner",
      };
    });
  }

  paged_calendarEvents(args, req) {
    const params = new URLSearchParams(req._queryString);
    const cal = this.getCalendarById(args.calendarId);

    let allEvents;
    let isSingle = false;
    if (args.eventId) {
      // We're getting a particular event.
      allEvents = [cal.getEventWithId(args.eventId)];
      isSingle = true;
    } else {
      // The first time events are got, singleEvents (set to true), timeMin and
      // timeMax are provided to get all the events with the the time range.
      // Then a syncToken is issued with the events in order to be able to get
      // only the "new" events in the next calls.
      const { syncToken, events } = !params.get("syncToken")
        ? cal.getEventsInRange({
            start: params.get("timeMin"),
            end: params.get("timeMax"),
          })
        : cal.getEventsInRange({ token: params.get("syncToken") });
      args.syncToken = syncToken;
      allEvents = events;
    }

    const result = allEvents.map(event => {
      const mapPeep = peep => {
        return {
          email: peep.email,
          displayName: peep.displayName || peep.name,
          organizer: peep.email === event.organizer.email,
          self: peep.isSelf || false,
          responseStatus: peep.responseStatus || "accepted",
        };
      };

      return {
        attachments: [],
        // XXX more fidelity on organizer/creator here too, with decision of
        // whether the FakeEventFactory should be making inclusion decisions too.
        // (The factory probably should be, yeah.  Which then leaves the question
        // of whether we standardize the organizer/self booleans or just key off
        // of the emails... probably again yeah.)
        attendees: event.attendees.map(mapPeep),
        created: backdatedISOString(event.startDate, { days: 7 }),
        creator: event.creator ? mapPeep(event.creator) : null,
        description: event.description,
        end: {
          dateTime: event.endDate.toISOString(),
          // XXX timeZone fidelity
        },
        etag: this.etagFromEvent(event),
        eventType: "default",
        extendedProperties: {},
        htmlLink: event.url || this.htmlLinkForEvent(cal, event),
        iCalUID: event.iCalUID,
        id: event.id,
        kind: "calendar#event",
        location: event.location,
        organizer: mapPeep(event.organizer),
        // XXX recurrences:
        // - originalStartTime object
        // - recurrence array
        recurringEventId: event.recurringId || "",
        reminders: {},
        // XXX iCal sequence mapping (which is distinct from our serial concept)
        sequence: 0,
        // XXX source is maybe interesting to include
        start: !event.cancelled
          ? {
              dateTime: event.startDate.toISOString(),
              // XXX timeZone fidelity
            }
          : undefined,
        // XXX handle tentative
        status: event.cancelled ? "cancelled" : "confirmed",
        summary: event.summary,
        transparency: "opaque",
        updated: backdatedISOString(event.startDate, { days: 6 }),
        visibility: "default",
        recurrence: event.recurrenceRules,
      };
    });

    if (isSingle) {
      return result[0];
    }
    return result;
  }
}

// eslint-disable-next-line no-unused-vars
class MapiFakeServer extends BaseFakeServer {
  constructor(data) {
    super(data);
    this.isMapi = true;
  }

  /**
   * Start the server on the first available port.  Port information will be
   * made available on the `domain`, `origin`, and `domainInfo` properties.
   */
  start() {
    const API_HANDLERS = [
      // ## OAuth support
      // https://login.microsoftonline.com/common/oauth2/v2.0/authorize
      {
        path: "/common/oauth2/v2.0/authorize/",
        handler: this.unpaged(this.unpaged_oauth_endpoint),
      },
      // https://login.microsoftonline.com/common/oauth2/v2.0/token
      {
        path: "/common/oauth2/v2.0/token/",
        handler: this.unpaged(this.unpaged_oauth_token),
      },
      // https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/METHOD
      {
        path: "/v1.0/me",
        handler: this.unpaged(this.unpaged_me),
      },
      // https://graph.microsoft.com/v1.0/me/calendars
      {
        path: "/v1.0/me/calendars",
        handler: this.unpaged(this.unpaged_calendars),
      },
      // https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/METHOD
      {
        prefix: "/v1.0/me/calendars/",
        extraPathSegments: ["calendarId", "calendarView", "*METHOD*"],
        methodHandlers: {
          delta: this.paged(this.paged_delta),
        },
      },
      // https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead ne true&$count=true&$select=id&top=1
      {
        path: "/v1.0/me/mailFolders/Inbox/messages",
        handler: this.unpaged(this.unpaged_messages),
      },
      // https://graph.microsoft.com/v1.0/shares/{$id}
      {
        prefix: "/v1.0/shares/",
        extraPathSegments: ["id"],
        handler: this.unpaged(this.unpaged_shares),
      },
    ];

    this.registerAPIHandlers(API_HANDLERS);

    const ident = this.server.identity;
    this.domain = `${ident.primaryHost}:${ident.primaryPort}`;
    this.origin = `${ident.primaryScheme}://${this.domain}`;

    this.testDisplayName = `test-user`;
    this.testUserEmail = `${this.testDisplayName}@${ident.primaryHost}`;

    // Since we are the server that validates this info, we currently don't care
    // about most of these values.
    this.domainInfo = {
      type: "mapi",
      oauth2Settings: {
        // we're now using proxy magic so we can use the real domains.
        authEndpoint:
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenEndpoint:
          "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "scope1 scope2 scope3 scope4",
      },
      oauth2Secrets: {
        clientId: "imaClient",
        clientSecret: "imaSecret",
      },
      oauth2Tokens: {
        refreshToken: "refreshing-token",
        accessToken: "valid0",
        tokenExpires: this.useNowTS + 24 * 60 * 60 * 1000,
      },
    };
  }

  /**
   * Set the number of unread messages to return throw the mail api.
   * @param {number} num
   */
  setUnreadMessageCount(num) {
    this.unreadMessageCount = num;
  }

  /**
   * Set the webLink url.
   * @param {String} url
   */
  setWeblink(url) {
    this.webLink = url;
  }

  wrapResults(results, isPaged, args) {
    if ("value" in results) {
      return super.wrapResults(results);
    }
    return super.wrapResults(
      {
        value: results,
        "@odata.deltaLink": args.deltaLink || "",
      },
      isPaged,
      args
    );
  }

  /**
   * Eh, we don't need the auth endpoint quite yet.  It's expected that the
   * front-end is responsible for hitting the auth endpoint and performing
   * the initial redemption to get the refresh token.  When we start doing
   * more full-fledged integration tests we'll need this.
   */
  unpaged_oauth_endpoint() {
    throw new HttpError(400, "OAuth Endpoint Not Implemented Yet");
  }

  /**
   * The token endpoint.  Currently this assumes the caller is providing a
   * valid refresh token.
   */
  unpaged_oauth_token() {
    var nextAccessToken;
    if (typeof this.oauthTokens === "string") {
      nextAccessToken = this.oauthTokens;
    } else {
      nextAccessToken = this.oauthTokens.shift();
    }

    return {
      access_token: nextAccessToken,
      expires_in: 60 * 60,
      token_type: "Bearer",
    };
  }

  unpaged_shares({ id }) {
    const encoded = id.slice("u!".length);
    const base64Url = encoded.replace(
      /(_)|(-)/g,
      (_, p1) => (p1 && "/") || "+"
    );
    const url = new URL(decodeURI(atob(base64Url)));
    if (url.hostname === "onedrive.live.com") {
      const resid = url.searchParams.get("resid");
      const authkey = url.searchParams.get("authkey");
      return { value: null, name: `${resid}.${authkey}` };
    }
    const name = url.pathname.slice("/".length);
    return { value: null, name };
  }

  unpaged_messages() {
    // For now search params are supposed to be:
    // ?$filter=isRead ne true&$count=true&$select=id&top=1
    // It's used to get the number of unread emails.
    return {
      "@odata.count": this.unreadMessageCount,
      value: [{ webLink: this.webLink }],
    };
  }

  unpaged_me() {
    return {
      userPrincipalName: this.testUserEmail,
      displayName: this.testDisplayName,
      value: null,
    };
  }

  unpaged_calendars() {
    return this.calendars.map(cal => {
      return {
        id: cal.id,
        name: cal.name,
        owner: {
          name: cal.owner?.name || this.testDisplayName,
          address: cal.owner?.address || this.testUserEmail,
        },
      };
    });
  }

  paged_delta(args, req) {
    const params = new URLSearchParams(req._queryString);
    const cal = this.getCalendarById(args.calendarId);

    // The first time events are got, startDateTime and endDateTime are provided
    // and an url for the next call is provided.
    const { syncToken, events } = !params.has("mozTestSyncToken")
      ? cal.getEventsInRange({
          start: params.get("startDateTime"),
          end: params.get("endDateTime"),
        })
      : cal.getEventsInRange({ token: params.get("mozTestSyncToken") });
    args.deltaLink = `https://graph.microsoft.com/v1.0/me/calendars/${args.calendarId}/calendarView/delta?mozTestSyncToken=${syncToken}`;

    return events.map(event => {
      const mapPeep = peep => {
        return {
          emailAddress: {
            address: peep.email,
            name: peep.displayName,
          },
          status: {
            response: peep.responseStatus,
          },
        };
      };

      return {
        // XXX more fidelity on organizer/creator here too, with decision of
        // whether the FakeEventFactory should be making inclusion decisions too.
        // (The factory probably should be, yeah.  Which then leaves the question
        // of whether we standardize the organizer/self booleans or just key off
        // of the emails... probably again yeah.)
        attendees: event.attendees.map(mapPeep),
        body: {
          content: event.description,
          contentType: event.descriptionType,
        },
        bodyPreview: event.description,
        cancelledOccurrences: [],
        categories: [],
        changeKey: "",
        createdDateTime: backdatedISOString(event.startDate, { days: 7 }),
        end: {
          dateTime: event.endDate.toISOString().replace("Z", ""),
          // XXX timeZone fidelity
        },
        exceptionOccurrences: [],
        hasAttachments: false,
        hideAttendees: false,
        iCalUId: event.iCalUID,
        id: event.id,
        importance: "low",
        isAllDay: false,
        isCancelled: event.cancelled,
        isDraft: false,
        isOnlineMeeting: false,
        isOrganizer: !!event.organizer.isSelf,
        isReminderOn: false,
        lastModifiedDateTime: backdatedISOString(event.startDate, { days: 7 }),
        location: event.location || {
          address: "",
          coordinates: null,
          displayName: "",
          locationEmailAddress: "",
          locationUri: "",
          locationType: "default",
        },
        locations: event.locations || null,
        occurrenceId: "",
        onlineMeeting: event.onlineMeeting || null,
        onlineMeetingProvider: "unknown",
        onlineMeetingUrl: event.onlineMeetingUrl || null,
        organizer: mapPeep(event.organizer),
        originalEndTimeZone: "",
        originalStart: "",
        originalStartTimeZone: "",
        recurrence: null,
        reminderMinutesBeforeStart: 0,
        responseRequested: true,
        responseStatus: null,
        sensitivity: "normal",
        seriesMasterId: event.recurringId || "",
        showAs: "unknown",
        start: !event.cancelled
          ? {
              dateTime: event.startDate.toISOString().replace("Z", ""),
              // XXX timeZone fidelity
            }
          : undefined,
        subject: event.summary,
        status: "confirmed",
        summary: event.summary,
        transactionId: "",
        type: "singleInstance",
        uid: event.iCalUID,
        webLink: event.url || this.htmlLinkForEvent(cal, event),
      };
    });
  }
}

// eslint-disable-next-line no-unused-vars
class FeedFakeServer extends BaseFakeServer {
  /**
   * Start the server on the first available port.  Port information will be
   * made available on the `domain`, `origin`, and `domainInfo` properties.
   */
  start() {
    const API_HANDLERS = [
      {
        prefix: "/feed/",
        extraPathSegments: ["calendarId", "*METHOD*"],
        methodHandlers: {
          rss: this.unpaged(this.unpaged_rss),
          atom: this.unpaged(this.unpaged_atom),
          jsonfeed: this.unpaged(this.unpaged_jsonfeed),
          hfeed: this.unpaged(this.unpaged_hfeed),
        },
      },
    ];

    this.registerAPIHandlers(API_HANDLERS);

    const ident = this.server.identity;
    this.domain = `${ident.primaryHost}:${ident.primaryPort}`;
    this.origin = `${ident.primaryScheme}://${this.domain}`;

    this.testDisplayName = `test-user`;
    this.testUserEmail = `${this.testDisplayName}@${ident.primaryHost}`;

    // Since we are the server that validates this info, we currently don't care
    // about most of these values.
    this.domainInfo = {
      type: "feed",
    };
  }

  wrapResults(results, isPaged, args) {
    let mimeType;
    let strResults = results;
    switch (args["*METHOD*"]) {
      case "atom":
      case "rss":
        mimeType = "application/xml";
        break;
      case "jsonfeed":
        mimeType = "application/json";
        strResults = JSON.stringify(results);
        break;
      case "hfeed":
        mimeType = "text/html";
        break;
    }

    return {
      results,
      strResults,
      mimeType,
    };
  }

  #toXMLAttrs(attributes) {
    return attributes
      ? " " +
          Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ")
      : "";
  }

  #toXMLHelper(data, parentKey, attributes, buf) {
    if (Array.isArray(data)) {
      for (const val of data) {
        this.#toXMLHelper(val, parentKey, attributes || val._attributes, buf);
      }
      return;
    }

    buf.push(`<${parentKey}${this.#toXMLAttrs(attributes)}>`);
    if (typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith("_")) {
          this.#toXMLHelper(value, key, value._attributes, buf);
        }
      }
      if (data._content) {
        buf.push(`${data._content}`);
      }
    } else {
      buf.push(`${data}`);
    }
    buf.push(`</${parentKey}>`);
  }

  toXML(data, isHTML = false) {
    const mainKey = Object.keys(data)[0];
    data = data[mainKey];
    const buffer = isHTML ? [] : ['<?xml version="1.0"?>'];
    this.#toXMLHelper(data, mainKey, data._attributes, buffer);
    return buffer.join("\n");
  }

  unpaged_rss(args, req) {
    const cal = this.getCalendarById(args.calendarId);
    const xml = {
      rss: {
        _attributes: {
          version: "2.0",
        },
        channel: {
          title: "Allizom news",
          link: "https://allizom.org",
          description: "Mozilla RSS feed",
          language: "en-uS",
          pubDate: "Sun, 14 Mar 2021 01:59:26 GMT",
          item: cal.events.map(event => {
            return {
              title: event.summary,
              description: event.description,
              author: event.creator.email,
              category: event.location || "",
              pubDate: event.startDate.toISOString(),
              guid: event.id,
            };
          }),
        },
      },
    };

    return this.toXML(xml);
  }

  unpaged_atom(args, req) {
    const cal = this.getCalendarById(args.calendarId);
    const xml = {
      feed: {
        _attributes: {
          xmlns: "http://www.w3.org/2005/Atom",
        },
        title: "Allizom news",
        link: "https://allizom.org",
        id: "https://alizom.org/atom",
        subtitle: "Mozilla Atom feed",
        updated: "Sun, 14 Mar 2021 01:59:26 GMT",
        entry: cal.events.map(event => {
          return {
            title: {
              _attributes: {
                lang: "en-US",
              },
              _content: event.summary,
            },
            content: {
              _attributes: {
                type: "text",
              },
              _content: event.description,
            },
            author: {
              name: event.creator.displayName,
              email: event.creator.email,
            },
            category: {
              _attributes: {
                term: event.location || "",
              },
            },
            published: event.startDate.toISOString(),
            updated: event.endDate.toISOString(),
            id: event.id,
          };
        }),
      },
    };

    return this.toXML(xml);
  }

  unpaged_jsonfeed(args, req) {
    const cal = this.getCalendarById(args.calendarId);
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Allizom news",
      home_page_url: "https://allizom.org",
      feed_url: "https://allizom.org/feed/default/jsonfeed",
      description: "Mozilla JSON feed",
      items: cal.events.map(event => {
        return {
          id: event.id,
          title: event.summary,
          content_text: event.description,
          author: {
            name: event.creator.displayName,
            url: event.creator.email,
          },
          tags: event.location || "",
          date_published: event.startDate.toISOString(),
          date_modified: event.endDate.toISOString(),
        };
      }),
    };
  }

  unpaged_hfeed(args, req) {
    const cal = this.getCalendarById(args.calendarId);
    const makeNode = (key, value) => ({
      _attributes: {
        class: key,
      },
      _content: value,
    });
    const html = {
      div: {
        _attributes: {
          class: "h-feed",
        },
        span: [
          makeNode("p-name", "Allizom news"),
          makeNode("u-url", "https://allizom.org"),
          makeNode("p-author", "Alli Zom"),
        ],
        div: cal.events.map(event => ({
          div: {
            _attributes: {
              class: "h-entry",
            },
            span: [
              makeNode("p-summary", event.summary),
              makeNode("e-content", event.description),
              makeNode("p-author", event.creator.displayName),
              makeNode("p-category", event.location || ""),
              makeNode("dt-published", event.startDate.toISOString()),
              makeNode("dt-updated", event.endDate.toISOString()),
              makeNode("u-uid", `https://allizom.org/${event.id}`),
            ],
          },
        })),
      },
    };

    return this.toXML(html, true);
  }
}
