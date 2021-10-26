/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { DeferredTask } = ChromeUtils.import(
  "resource://gre/modules/DeferredTask.jsm"
);
const {
  parseGoogleCalendarResult,
  parseMicrosoftCalendarResult,
} = ChromeUtils.import("resource:///modules/OnlineServicesHelper.jsm");

const PREF_STORE = "onlineservices.config";

XPCOMUtils.defineLazyModuleGetters(this, {
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
  setInterval: "resource://gre/modules/Timer.jsm",
});

XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "OnlineServices.jsm",
    // tip: set maxLogLevel to "debug" and use log.debug() to create detailed
    // messages during development. See LOG_LEVELS in Console.jsm for details.
    maxLogLevel: "error",
    maxLogLevelPref: PREF_LOGLEVEL,
  });
});

Cu.importGlobalProperties(["fetch"]);

const PREF_LOGLEVEL = "browser.companion.loglevel";

// Fetch calendar events every five minutes.
const CALENDAR_FETCH_TIME = 5 * 60 * 1000; // 5 minutes

var nextServiceId = 0;

class GoogleService {
  constructor(config) {
    this.name = "Google";
    this.app = config.type;
    this.id = ++nextServiceId;

    let scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ];

    this.auth = new OAuth2(
      kIssuers[this.app].endpoint,
      kIssuers[this.app].tokenEndpoint,
      scopes.join(" "),
      kIssuers[this.app].clientId,
      kIssuers[this.app].clientSecret,
      config?.auth
    );
    this.getUnreadCountAtom();
    this.mailCountTimer = setInterval(
      this.getUnreadCountAtom.bind(this),
      60 * 1000
    );
  }

  async connect() {
    // This will force a new OAuth login if not logged in or the token
    // has expired.
    let token = await this.getToken();
    return token;
  }

  async disconnect() {
    let token = await this.getToken();

    // Revoke access for the currently stored token.
    let apiTarget = new URL(
      `https://oauth2.googleapis.com/revoke?token=${token}`
    );
    let headers = {
      "Content-type": "application/x-www-form-urlencoded",
    };

    let response = await fetch(apiTarget, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  async getAccountAddress() {
    return this.emailAddress;
  }

  async getNextMeetings() {
    let token = await this.getToken();

    let apiTarget = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let calendarList = [];

    if (!response.ok) {
      calendarList.push({
        id: "primary",
      });
    } else {
      let results = await response.json();
      log.debug(JSON.stringify(results));
      for (let result of results.items) {
        if (result.hidden || !result.selected) {
          continue;
        }
        let calendar = {};
        calendar.id = result.primary ? "primary" : result.id;
        // The ID of the primary calendar is the user's email
        // address. By storing it here, we don't need extra
        // auth scopes.
        if (result.primary) {
          this.emailAddress = result.id;
        }
        calendar.backgroundColor = result.backgroundColor;
        calendar.foregroundColor = result.foregroundColor;
        calendarList.push(calendar);
      }
    }

    let allEvents = new Map();
    await Promise.allSettled(
      calendarList.map(async calendar => {
        apiTarget = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendar.id
          )}/events`
        );

        apiTarget.searchParams.set("orderBy", "startTime");
        apiTarget.searchParams.set("singleEvents", "true");
        let dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        apiTarget.searchParams.set("timeMin", dayStart.toISOString());
        // If we want to reduce the window, we can just make
        // timeMax an hour from now.
        let midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        apiTarget.searchParams.set("timeMax", midnight.toISOString());

        headers = {
          Authorization: `Bearer ${token}`,
        };

        response = await fetch(apiTarget, {
          headers,
        });

        if (!response.ok) {
          log.debug(response.statusText);
          return;
        }

        let results = await response.json();

        log.debug(JSON.stringify(results));

        for (let result of results.items) {
          try {
            // Ignore all day events
            if (!result.start?.dateTime || !result.end?.dateTime) {
              continue;
            }
            if (
              calendar.id == "primary" &&
              result.attendees &&
              !result.attendees.filter(
                attendee =>
                  attendee.self === true &&
                  attendee.responseStatus !== "declined"
              ).length
            ) {
              continue;
            }
            let event = parseGoogleCalendarResult(result, this.emailAddress);
            event.calendar = {
              id: calendar.id,
            };
            event.serviceId = this.id;
            if (allEvents.has(result.id)) {
              // If an event is duplicated, use
              // the primary calendar
              if (calendar.id == "primary") {
                allEvents.set(result.id, event);
              }
            } else {
              allEvents.set(result.id, event);
            }
          } catch (e) {
            log.error(e);
          }
        }
      })
    );
    return Array.from(allEvents.values()).sort((a, b) => {
      if (a.startDate.getTime() == b.startDate.getTime()) {
        return a.endDate - a.startDate - (b.endDate - b.startDate);
      }
      return a.startDate - b.startDate;
    });
  }

  async getUnreadCountAtom() {
    let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

    if (!response.ok) {
      this.mailCount = 0;
      return;
    }

    let results = await response.text();

    let doc = new DOMParser().parseFromString(results, "text/xml");

    this.mailCount = parseInt(doc.querySelector("fullcount").textContent);
  }

  async getDocumentTitle(url) {
    url = new URL(url);
    if (!url.hostname.endsWith(".google.com")) {
      return null;
    }
    let id = url.href.split("/")[5];
    let type = url.href.split("/")[3];
    if (!id || !type) {
      return null;
    }
    let apiTarget;
    switch (type) {
      case "document":
        apiTarget = new URL(`https://docs.googleapis.com/v1/documents/${id}`);
        break;
      case "spreadsheets":
        apiTarget = new URL(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}`
        );
        break;
      case "presentation":
        apiTarget = new URL(
          `https://slides.googleapis.com/v1/presentations/${id}`
        );
        break;
      case "drive":
      case "file":
        apiTarget = new URL(`https://www.googleapis.com/drive/v2/files/${id}`);
        break;
      default:
        return null;
    }
    let token = await this.getToken();
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();

    if (results.error) {
      return null;
    }

    log.debug(JSON.stringify(results));

    if (type == "spreadsheets") {
      return results.properties.title;
    }

    return results.title;
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
    };
  }
}

class MicrosoftService {
  constructor(config) {
    this.name = "Microsoft";
    this.app = config.type;
    this.id = ++nextServiceId;

    let scopes = [
      // This is required or we don't get a refreshToken
      "offline_access",
      "https://graph.microsoft.com/Calendars.Read",
      "https://graph.microsoft.com/Mail.Read",
    ];

    this.auth = new OAuth2(
      kIssuers[this.app].endpoint,
      kIssuers[this.app].tokenEndpoint,
      scopes.join(" "),
      kIssuers[this.app].clientId,
      kIssuers[this.app].clientSecret,
      config?.auth
    );
    this.getUnreadCount();
    this.mailCountTimer = setInterval(
      this.getUnreadCount.bind(this),
      60 * 1000
    );
    this.getInboxURL();
  }

  async connect() {
    // This will force a new OAuth login if not logged in or the token
    // has expired.
    let token = await this.getToken();
    return token;
  }

  async disconnect() {
    // Unfortunately none of the documented methods for revoking tokens are
    // working with Microsoft. Docs appear to be here if someone wants to try.
    // https://docs.microsoft.com/en-us/graph/api/user-revokesigninsessions?view=graph-rest-1.0&tabs=http
    //
    // There was some sample code here before, check the log if you want it.
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  async getNextMeetings() {
    let token = await this.getToken();

    let apiTarget = new URL("https://graph.microsoft.com/v1.0/me/calendars");

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    log.debug(JSON.stringify(results));

    if (results.error) {
      log.error(results.error.message);
      return [];
    }

    let calendarList = [];
    for (let result of results.value) {
      let calendar = {};
      calendar.id = result.id;
      calendarList.push(calendar);
    }

    let dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    // If we want to reduce the window, we can just make
    // timeMax an hour from now.
    let midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    let allEvents = new Map();
    await Promise.allSettled(
      calendarList.map(async calendar => {
        apiTarget = new URL(
          `https://graph.microsoft.com/v1.0/me/calendars/${
            calendar.id
          }/events?orderby=start/dateTime&$filter=start/dateTime ge '${dayStart.toISOString()}' AND start/dateTime le '${midnight.toISOString()}'`
        );

        response = await fetch(apiTarget, {
          headers,
        });

        results = await response.json();
        log.debug(JSON.stringify(results));

        if (results.error) {
          log.error(results.error.message);
          return;
        }

        for (let result of results.value) {
          try {
            // Ignore all day events
            if (result.isAllDay) {
              continue;
            }
            let event = parseMicrosoftCalendarResult(result);
            event.calendar = {
              id: calendar.id,
            };
            event.serviceId = this.id;
            allEvents.set(result.id, event);
          } catch (e) {
            log.error(e);
          }
        }
      })
    );
    return Array.from(allEvents.values()).sort(
      (a, b) => a.startDate - b.startDate
    );
  }

  async getInboxURL() {
    // Hacky, buy I can't find anyway to get the inbox URL
    // without looking at an email.
    if (!this.inboxURL) {
      let token = await this.getToken();

      let apiTarget = new URL(
        "https://graph.microsoft.com/v1.0/me/messages?$top=1&$select=webLink"
      );

      let headers = {
        Authorization: `Bearer ${token}`,
      };

      let response = await fetch(apiTarget, {
        headers,
      });

      let results = await response.json();
      log.debug(JSON.stringify(results));

      if (results.error) {
        log.error(results.error.message);
      }
      if (results.error || !results.value?.length) {
        this.inboxURL = "https://outlook.com";
      } else {
        this.inboxURL = results.value[0].webLink.split("?")[0];
      }
    }
  }

  async getUnreadCount() {
    let token = await this.getToken();

    // By just selecting the ID, we're getting as little data as we need.
    // I couldn't find a way to just get the count.
    let apiTarget = new URL(
      "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead ne true&$count=true&$select=id"
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    log.debug(JSON.stringify(results));

    if (results.error) {
      log.error(results.error.message);
      this.mailCount = 0;
    }
    this.mailCount = results["@odata.count"];
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
    };
  }
}

const ServiceInstances = new Set();

let loaded = false;
function load() {
  if (loaded) {
    return;
  }
  loaded = true;

  let config = JSON.parse(Services.prefs.getCharPref(PREF_STORE, "[]"));

  for (let service of config) {
    // In the past, services could have null auth due to a bug.
    if (!service.auth) {
      continue;
    }
    // For now, we don't allow more than one of the same service
    if ([...ServiceInstances].filter(item => item.app == service.type).length) {
      log.error(`Service ${service.type} already exists`);
      continue;
    }

    if (service.type.startsWith("google")) {
      ServiceInstances.add(new GoogleService(service));
    } else if (service.type.startsWith("microsoft")) {
      ServiceInstances.add(new MicrosoftService(service));
    }
  }
}

const kIssuers = {
  google: {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "290111995646-hrdpn27kp4jl0r6gej8540cg3cc4i0g6.apps.googleusercontent.com",
    clientSecret: "mjlcpD5iiSNABCq_3PRtUglS",
  },
  "google-mozilla": {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "913967847322-m8ij544g2i23pssvchhru1hceg08irud.apps.googleusercontent.com",
    clientSecret: "G7bg5a1bahnVWxd6GKQcO4Ro",
  },
  "google-mozilla-test": {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "1008059134576-ki9j8bfsrdho6ot9aun1mjljoegch6pn.apps.googleusercontent.com",
    clientSecret: "jraQ3WNSCLK6g7uVKQd3PwUX",
  },
  microsoft: {
    endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: "66d9891f-d284-4158-a9b3-27aebf6b0f8c",
    clientSecret: "P8_.eMal60dY1VFEU1K6N_-22o4cA6vo.d",
  },
  "microsoft-test": {
    endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: "2d165c7b-a525-45c6-b4dc-3039db1e7f85",
  },
};

const OnlineServices = {
  lastAccess: 0,
  data: [],

  get isFresh() {
    let now = new Date();
    return now - this.lastAccess < CALENDAR_FETCH_TIME;
  },

  getCalendarEventQuery(filterConfig = {}) {
    return {
      kind: "calendar",
      filter: {
        tag: "",
        event: {
          type: "now",
          durationBeforeInMinutes: 60,
        },
        ...filterConfig,
      },
    };
  },

  async createService(type) {
    load();

    // For now, we don't allow more than one of the same service
    if ([...ServiceInstances].filter(item => item.app == type).length) {
      log.error(`Service ${type} already exists`);
      return null;
    }

    let service;
    if (type.startsWith("google")) {
      service = new GoogleService({ type });
    } else if (type.startsWith("microsoft")) {
      service = new MicrosoftService({ type });
    } else if (Cu.isInAutomation) {
      Services.obs.notifyObservers(
        null,
        "pinebuild-test-connect-service",
        type
      );
      return null;
    } else {
      throw new Error(`Unknown service "${type}"`);
    }
    let token = await service.connect();
    if (!token) {
      return null;
    }
    ServiceInstances.add(service);
    this.persist();
    // grab events for this service and put them in the cache
    let meetingResults = await service.getNextMeetings();
    this.data = this.data.concat(meetingResults);
    Services.obs.notifyObservers(this.data, "companion-services-refresh");
    Services.obs.notifyObservers(null, "companion-signin", service.app);
    return service;
  },

  findServiceById(id) {
    for (let service of ServiceInstances) {
      if (service.id == id) {
        return service;
      }
    }
    return null;
  },

  async deleteService(service) {
    // Delete events specific to this service from the cache
    this.data = this.data.filter(e => e.serviceId != service.id);
    await service.disconnect();
    ServiceInstances.delete(service);
    this.persist();
    Services.obs.notifyObservers(this.data, "companion-services-refresh");
    Services.obs.notifyObservers(null, "companion-signout", service.app);
  },

  getServices(type) {
    return [...ServiceInstances].filter(service =>
      service.app.startsWith(type)
    );
  },

  get connectedServiceTypes() {
    return [...new Set(OnlineServices.getAllServices().map(s => s.app))];
  },

  hasService(type) {
    return !!this.getServices(type).length;
  },

  getInboxURL(type) {
    return this.getServices(type).find(service => service.inboxURL)?.inboxURL;
  },

  getMailCount(type) {
    let mailCount = 0;
    for (let service of this.getServices(type)) {
      mailCount += service.mailCount;
    }
    return mailCount;
  },

  async getDocumentTitle(url) {
    if (
      url.startsWith("https://docs.google.com") ||
      url.startsWith("https://drive.google.com")
    ) {
      let documentNamePromises = await Promise.allSettled(
        this.getServices("google").map(service => service.getDocumentTitle(url))
      );
      for (let promise of documentNamePromises) {
        if (promise.value) {
          return promise.value;
        }
      }
    }
    return null;
  },

  getAllServices() {
    load();

    return [...ServiceInstances];
  },

  persist() {
    let config = JSON.stringify(Array.from(ServiceInstances));
    Services.prefs.setCharPref(PREF_STORE, config);
  },

  setCache(data) {
    this.data = data;
    this.lastAccess = new Date();
  },

  getCache() {
    return this.data;
  },

  // This task will be armed after the events are retrieved for the first time.
  refreshEventsTask: new DeferredTask(async () => {
    try {
      // We're only awaiting here so we can catch errors.
      await OnlineServices.fetchEvents();
    } catch (e) {
      Cu.reportError(e);
    } finally {
      // Just don't throw, fetchEvents() will have re-armed the task.
    }
  }, CALENDAR_FETCH_TIME),

  getEventsFromCache() {
    if (!this.isFresh) {
      // If we don't have fresh events, we kick off the process
      // to get new events. The refresh will happen later via
      // an observer notification.
      this.fetchEvents();
    }
    return this.getCache();
  },

  alreadyFetching: false,

  async fetchEvents() {
    let servicesData = this.getAllServices();
    if (!servicesData.length || this.alreadyFetching) {
      return;
    }
    this.alreadyFetching = true;

    let meetingResults = new Array(servicesData.length);
    let i = 0;
    for (let service of servicesData) {
      meetingResults[i] = service.getNextMeetings();
      i++;
    }

    let eventResults = await Promise.allSettled(meetingResults);
    let events = eventResults.flatMap(r => r.value || []);

    this.setCache(events);
    Services.obs.notifyObservers(events, "companion-services-refresh");

    // Reset the auto refresh task to its full refresh time. This will also
    // queue the first auto-refresh if this is the first time we load events.
    this.refreshEventsTask.disarm();
    this.refreshEventsTask.arm();
    this.alreadyFetching = false;
  },
};
