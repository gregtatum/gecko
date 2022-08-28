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
  DismissedEventStore,
} = ChromeUtils.import("resource:///modules/OnlineServicesHelper.jsm");

const PREF_STORE = "onlineservices.config";

const lazy = {};

XPCOMUtils.defineLazyModuleGetters(lazy, {
  OAuth2: "resource:///modules/OAuth2.jsm",
  setInterval: "resource://gre/modules/Timer.jsm",
});

XPCOMUtils.defineLazyGetter(lazy, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "OnlineServices.jsm",
    // tip: set maxLogLevel to "debug" and use log.debug() to create detailed
    // messages during development. See LOG_LEVELS in Console.jsm for details.
    maxLogLevel: "error",
    maxLogLevelPref: PREF_LOGLEVEL,
  });
});

const PREF_LOGLEVEL = "browser.companion.loglevel";

// Fetch calendar events every five minutes.
const CALENDAR_FETCH_TIME = 5 * 60 * 1000; // 5 minutes

var nextServiceId = 0;

class GoogleService {
  constructor(config) {
    this.name = "Google";
    this.app = config.type;
    this.id = ++nextServiceId;
    this.hasConnectionError = false;
    this.listeners = new Map([["status", new Set()]]);
    this.inboxURL = "https://mail.google.com/mail/";
    if (config.emailAddress) {
      this.emailAddress = config.emailAddress;
      this.inboxURL += `u/?authuser=${encodeURIComponent(config.emailAddress)}`;
    }

    let scopes = [
      // For getting the email address
      "https://www.googleapis.com/auth/userinfo.email",
      // For getting calendar events
      "https://www.googleapis.com/auth/calendar.events.readonly",
      // For getting the list of calendars
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      // For getting titles of documents
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ];

    this.auth = new lazy.OAuth2(
      kIssuers[this.app].endpoint,
      kIssuers[this.app].tokenEndpoint,
      scopes.join(" "),
      kIssuers[this.app].clientId,
      kIssuers[this.app].clientSecret,
      config?.auth,
      this.app
    );
    this.getUnreadCountAtom();
    this.mailCountTimer = lazy.setInterval(
      this.getUnreadCountAtom.bind(this),
      60 * 1000
    );
  }

  async connect() {
    // This will force a new OAuth login if not logged in or the token
    // has expired.
    let token = await this.auth.connect();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  async disconnect() {
    // For disconnect, we just want to grab the oAuth token directly.
    // It doesn't make sense to try to reauthenticate.
    let token = this.auth.accessToken;
    if (!token) {
      return;
    }

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
      let results = await response.json();
      if (results?.error != "invalid_token") {
        lazy.log.error("Disconnect error:", JSON.stringify(results));
      }
    }
  }

  addListener(eventName, fn) {
    this.listeners.get(eventName).add(fn);
  }

  removeListener(eventName, fn) {
    this.listeners.get(eventName).delete(fn);
  }

  notifyListeners(eventName, data) {
    for (let listener of this.listeners.get(eventName)) {
      try {
        listener(data);
      } catch (ex) {
        Cu.report(ex);
      }
    }
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    } else if (this.auth.tokenError) {
      // A token error means we've lost access.
      this.authError(`${this.name} OAuth token invalid.`);
    }
    return token;
  }

  authError(error) {
    lazy.log.error(error, `Deleting ${this.name} service.`);
    OnlineServices.deleteService(this);
    Services.obs.notifyObservers(null, "oauth-access-grant-error", this.app);
  }

  getAccountAddress() {
    return this.emailAddress;
  }

  async getNextMeetings() {
    let token = await this.getToken();
    if (!token) {
      return [];
    }

    let apiTarget = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response;
    let hadError = this.hasConnectionError;
    try {
      response = await fetch(apiTarget, {
        headers,
      });
      this.hasConnectionError = false;
      if (hadError) {
        this.notifyListeners("status", { status: "connected" });
      }
    } catch (ex) {
      this.hasConnectionError = true;
      if (!hadError) {
        this.notifyListeners("status", { status: "error" });
      }
      // If we fail here, it's probably a network error.
      // Return null so we can detect this situation.
      return null;
    }

    let results = await response.json();

    if (!response.ok) {
      if (results?.error?.code == 401) {
        this.authError(results.error.message);
      } else {
        lazy.log.error(
          "Invalid calendar list response",
          JSON.stringify(results)
        );
      }
      return [];
    }

    lazy.log.debug(JSON.stringify(results));

    let calendarList = [];
    for (let result of results.items) {
      if (result.hidden || !result.selected) {
        continue;
      }
      let calendar = {};
      calendar.id = result.primary ? "primary" : result.id;
      calendar.backgroundColor = result.backgroundColor;
      calendar.foregroundColor = result.foregroundColor;
      calendarList.push(calendar);
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

        results = await response.json();

        if (!response.ok) {
          if (results?.error?.code == 401) {
            this.authError(results.error.message);
          } else {
            lazy.log.error(
              "Invalid calendar response",
              JSON.stringify(results)
            );
          }
          return;
        }

        lazy.log.debug(JSON.stringify(results));

        for (let result of results.items) {
          try {
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
            event.serviceType = this.app;
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
            lazy.log.error(e);
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

  async getEmailInfo() {
    let token = await this.getToken();
    if (!token) {
      return;
    }

    let apiTarget = new URL("https://www.googleapis.com/oauth2/v3/userinfo");

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    lazy.log.debug(JSON.stringify(results));

    if (results.error) {
      lazy.log.error(results.error.message);
    }

    if (results.email) {
      this.emailAddress = results.email;
      this.inboxURL = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(
        results.email
      )}`;
    }
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
    let apiTarget = new URL(
      `https://www.googleapis.com/drive/v2/files/${id}?fields=title`
    );
    let token = await this.getToken();
    if (!token) {
      return null;
    }
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();

    if (results.error) {
      // 404 just means the user doesn't have access,
      // so don't clutter up the console.
      if (results?.error?.code != 404) {
        lazy.log.error(JSON.stringify(results));
      }
      return null;
    }

    lazy.log.debug(JSON.stringify(results));

    return results.title;
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
      emailAddress: this.emailAddress,
    };
  }
}

class MicrosoftService {
  constructor(config) {
    this.name = "Microsoft";
    this.app = config.type;
    this.id = ++nextServiceId;
    this.hasConnectionError = false;
    this.listeners = new Map([["status", new Set()]]);
    this.inboxURL = config.inboxURL || "https://outlook.live.com/mail/";
    this.emailAddress = config.emailAddress;

    let scopes = [
      // This is required or we don't get a refreshToken
      "offline_access",
      // For calendars
      "https://graph.microsoft.com/Calendars.Read",
      // For unread count
      "https://graph.microsoft.com/Mail.Read",
      // For determining the type of account and email address
      "https://graph.microsoft.com/User.Read",
    ];

    this.auth = new lazy.OAuth2(
      kIssuers[this.app].endpoint,
      kIssuers[this.app].tokenEndpoint,
      scopes.join(" "),
      kIssuers[this.app].clientId,
      kIssuers[this.app].clientSecret,
      config?.auth,
      this.app
    );
    this.getUnreadCount();
    this.mailCountTimer = lazy.setInterval(
      this.getUnreadCount.bind(this),
      60 * 1000
    );
  }

  async connect() {
    // This will force a new OAuth login if not logged in or the token
    // has expired.
    let token = await this.auth.connect();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  async disconnect() {
    // Unfortunately none of the documented methods for revoking tokens are
    // working with Microsoft. Docs appear to be here if someone wants to try.
    // https://docs.microsoft.com/en-us/graph/api/user-revokesigninsessions?view=graph-rest-1.0&tabs=http
    //
    // There was some sample code here before, check the log if you want it.
  }

  addListener(eventName, fn) {
    this.listeners.get(eventName).add(fn);
  }

  removeListener(eventName, fn) {
    this.listeners.get(eventName).delete(fn);
  }

  notifyListeners(eventName, data) {
    for (let listener of this.listeners.get(eventName)) {
      try {
        listener(data);
      } catch (ex) {
        Cu.report(ex);
      }
    }
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    } else if (this.auth.tokenError) {
      // A token error means we've lost access.
      this.authError(`${this.name} OAuth token invalid.`);
    }
    return token;
  }

  authError(error) {
    lazy.log.error(error, `Deleting ${this.name} service.`);
    OnlineServices.deleteService(this);
    Services.obs.notifyObservers(null, "oauth-access-grant-error", this.app);
  }

  // For Microsoft, we don't have an email address
  getAccountAddress() {
    return null;
  }

  async getNextMeetings() {
    let token = await this.getToken();
    if (!token) {
      return [];
    }

    let apiTarget = new URL("https://graph.microsoft.com/v1.0/me/calendars");

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response;
    let hadError = this.hasConnectionError;
    try {
      response = await fetch(apiTarget, {
        headers,
      });
      this.hasConnectionError = false;
      if (hadError) {
        this.notifyListeners("status", { status: "connected" });
      }
    } catch (ex) {
      this.hasConnectionError = true;
      if (!hadError) {
        this.notifyListeners("status", { status: "error" });
      }
      // If we fail here, it's probably a network error.
      // Return null so we can detect this situation.
      return null;
    }

    let results = await response.json();
    lazy.log.debug(JSON.stringify(results));

    if (results.error) {
      lazy.log.error(results.error.message);
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
          }/calendarview?startdatetime=${dayStart.toISOString()}&enddatetime=${midnight.toISOString()}`
        );

        response = await fetch(apiTarget, {
          headers,
        });

        results = await response.json();
        lazy.log.debug(JSON.stringify(results));

        if (results.error) {
          lazy.log.error(results.error.message);
          return;
        }

        for (let result of results.value) {
          try {
            // Ignore cancelled events
            if (result.isCancelled) {
              continue;
            }
            let event = parseMicrosoftCalendarResult(result);
            event.calendar = {
              id: calendar.id,
            };
            event.serviceType = this.app;
            event.serviceId = this.id;
            allEvents.set(result.id, event);
          } catch (e) {
            lazy.log.error(e);
          }
        }
      })
    );
    return Array.from(allEvents.values()).sort(
      (a, b) => a.startDate - b.startDate
    );
  }

  async getEmailInfo() {
    let token = await this.getToken();
    if (!token) {
      return;
    }

    let apiTarget = new URL("https://graph.microsoft.com/v1.0/me");

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    lazy.log.debug(JSON.stringify(results));

    if (results.error) {
      lazy.log.error(results.error.message);
      return;
    }

    this.emailAddress = results.userPrincipalName;

    // Consumer accounts are a hexadecimal number;
    // Office365 accounts are a UUID.
    let accountType;
    if (`0x${results.id}` == parseInt(results.id, 16)) {
      accountType = "live";
    } else {
      accountType = "office";
    }
    this.inboxURL = `https://outlook.${accountType}.com/mail/?login_hint=${this.emailAddress}`;
  }

  async getUnreadCount() {
    let token = await this.getToken();
    if (!token) {
      return;
    }
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
    lazy.log.debug(JSON.stringify(results));

    if (results.error) {
      lazy.log.error(results.error.message);
      this.mailCount = 0;
    }
    this.mailCount = results["@odata.count"];
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
      inboxURL: this.inboxURL,
      emailAddress: this.emailAddress,
    };
  }
}

class TestService {
  constructor(config) {
    this.name = "Test";
    this.app = config.type;
    this.id = ++nextServiceId;
    this.hasConnectionError = false;
    if (this.app == "testservice") {
      let html = `
        <a href="http://example.net/login">Login</a>
        <script>
          document.querySelector("a").href = "https://localhost/oauth?state=".concat(
            new URL(window.location.href).searchParams.get("state")
          );
        </script>
      `.replace(new RegExp("\\n *", "g"), "");
      const url = `https://example.net/document-builder.sjs?html=${html}`;
      this.auth = new lazy.OAuth2(
        url,
        `data:application/json,${JSON.stringify({
          access_token: "testservice-token",
          refresh_token: "testservice-refresh",
        })}`,
        "all",
        "client-id",
        "client-secret",
        null,
        this.app
      );
    }
  }

  async connect() {
    if (this.auth) {
      await this.auth.connect();
      if (
        Services.prefs.getBoolPref(
          "pinebuild.testing.OAuthErrorAccessToken",
          false
        )
      ) {
        return null;
      }
    }
    return "test-token";
  }

  async disconnect() {}

  async getNextMeetings() {
    return [];
  }

  async getEmailInfo() {
    this.emailAddress = "user@example.com";
    this.inboxURL = "https://example.com";
  }

  async getUnreadCount() {
    return 0;
  }

  toJSON() {
    return { type: this.app };
  }

  getAccountAddress() {
    return "test-user@example.com";
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
      lazy.log.error(`Service ${service.type} already exists`);
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
      "944367438010-bgarfm35hotueofbpga27snubn0e3urs.apps.googleusercontent.com",
    clientSecret: "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",
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

  async createService(type) {
    load();

    // For now, we don't allow more than one of the same service
    if ([...ServiceInstances].filter(item => item.app == type).length) {
      lazy.log.error(`Service ${type} already exists`);
      return null;
    }

    let service;
    if (type.startsWith("google")) {
      service = new GoogleService({ type });
    } else if (type.startsWith("microsoft")) {
      service = new MicrosoftService({ type });
    } else if (Cu.isInAutomation && type.startsWith("testservice")) {
      service = new TestService({ type });
    } else {
      throw new Error(`Unknown service "${type}"`);
    }

    let token = await service.connect();
    if (!token) {
      return null;
    }

    // Since we just went out to the service for log in, that may have taken a
    // while and an account may have been created for this type already. If
    // there was another account created before this returned then abort.
    if ([...ServiceInstances].filter(item => item.app == type).length) {
      lazy.log.error(`Service ${type} already exists`);
      return null;
    }

    ServiceInstances.add(service);
    // We have a token, so we can get email specific information.
    // For Google, this is the email address.
    // For Microsoft, this is the inbox URL.
    try {
      await service.getEmailInfo();
    } catch (e) {
      lazy.log.error(`Unable to get email info for ${type}`);
    }
    this.persist();
    Glean.pinebuild.calendarServiceConnected[type].add(1);
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
    try {
      // Try to clean up our token, this could fail if the user already revoked
      // the credentials with the service.
      await service.disconnect();
    } catch (e) {
      Cu.reportError(e);
    }
    ServiceInstances.delete(service);
    this.persist();
    Services.obs.notifyObservers(this.data, "companion-services-refresh");
    Services.obs.notifyObservers(null, "companion-signout", service.app);
    Glean.pinebuild.calendarServiceDisconnected[service.app].add(1);
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
    // Reset the auto refresh task to its full refresh time. This will also
    // queue the first auto-refresh if this is the first time we load events.
    this.refreshEventsTask.disarm();
    this.refreshEventsTask.arm();

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

    // Only update the events if at least one service successfully responds.
    // If all services failed then there was likely a network error.
    if (eventResults.some(r => r.value != null)) {
      let events = eventResults.flatMap(r => r.value || []);
      this.setCache(events);
      Services.obs.notifyObservers(events, "companion-services-refresh");
    }

    this.alreadyFetching = false;
  },

  _dismissedEventStore: new DismissedEventStore(),
  storeDismissedEvent(serviceType, eventId) {
    this._dismissedEventStore.dismissEvent(serviceType, eventId);
  },
  getDismissedEvents() {
    return this._dismissedEventStore.store;
  },
  clearDismissedEvents(serviceType) {
    if (serviceType) {
      this._dismissedEventStore.clearService(serviceType);
    } else {
      this._dismissedEventStore.load([]);
    }
  },
};
