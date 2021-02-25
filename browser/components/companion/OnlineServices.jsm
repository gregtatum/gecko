/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

Cu.importGlobalProperties(["fetch"]);

const GOOGLE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CLIENT_ID =
  "913967847322-m8ij544g2i23pssvchhru1hceg08irud.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "G7bg5a1bahnVWxd6GKQcO4Ro";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

function getConferenceInfo(result) {
  if (!result.conferenceData?.conferenceSolution) {
    return null;
  }

  let base = {
    icon: result.conferenceData.conferenceSolution.iconUri,
    name: result.conferenceData.conferenceSolution.name,
  };

  for (let entry of result.conferenceData.entryPoints) {
    if (entry.uri.startsWith("https:")) {
      return {
        ...base,
        url: entry.uri,
      };
    }
  }

  return null;
}

class GoogleService {
  constructor(config = null) {
    this.auth = new OAuth2(
      GOOGLE_ENDPOINT,
      GOOGLE_TOKEN_ENDPOINT,
      GOOGLE_SCOPES.join(" "),
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      config?.auth
    );
  }

  connect() {
    // This will force login if not already logged in.
    return this.auth.getToken();
  }

  async getNextMeetings() {
    let token = await this.auth.getToken();

    let apiTarget = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    );

    apiTarget.searchParams.set("maxResults", 5);
    apiTarget.searchParams.set("orderBy", "startTime");
    apiTarget.searchParams.set("singleEvents", "true");
    apiTarget.searchParams.set("timeMin", new Date().toISOString());

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let results = await response.json();
    return results.items.map(result => ({
      summary: result.summary,
      start: new Date(result.start.dateTime),
      end: new Date(result.end.dateTime),
      conference: getConferenceInfo(result),
    }));
  }

  toJSON() {
    return {
      type: "google",
      auth: this.auth,
    };
  }
}

const ServiceInstances = new Set();

function persist() {
  let config = JSON.stringify(Array.from(ServiceInstances));
  Services.prefs.setCharPref("onlineservices.config", config);
}

let loaded = false;
function load() {
  if (loaded) {
    return;
  }
  loaded = true;

  let config = JSON.parse(
    Services.prefs.getCharPref("onlineservices.config", "[]")
  );

  for (let service of config) {
    if (service.type == "google") {
      ServiceInstances.add(new GoogleService(service));
    }
  }
}

const OnlineServices = {
  async createService(type) {
    load();

    if (type == "google") {
      let service = new GoogleService();
      ServiceInstances.add(service);
      await service.connect();
    } else {
      throw new Error("Unknown service type.");
    }

    persist();
  },

  getServices() {
    load();

    return [...ServiceInstances];
  },
};
