/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const PREF_STORE = "onlineservices.config";

XPCOMUtils.defineLazyModuleGetters(this, {
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

Cu.importGlobalProperties(["fetch"]);

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
  constructor(config) {
    this.app = config.type;

    let scopes = [
      "https://www.googleapis.com/auth/gmail.metadata",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ];

    this.auth = new OAuth2(
      this.getPref("endpoint"),
      this.getPref("tokenEndpoint"),
      scopes.join(" "),
      this.getPref("clientId"),
      this.getPref("clientSecret"),
      config?.auth
    );
  }

  getPref(name, deflt = undefined) {
    return Services.prefs.getCharPref(
      `onlineservices.${this.app}.${name}`,
      deflt
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

    apiTarget.searchParams.set("maxResults", 1);
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
      type: this.app,
      auth: this.auth,
    };
  }
}

const ServiceInstances = new Set();

function persist() {
  let config = JSON.stringify(Array.from(ServiceInstances));
  Services.prefs.setCharPref(PREF_STORE, config);
}

let loaded = false;
function load() {
  if (loaded) {
    return;
  }
  loaded = true;

  let config = JSON.parse(Services.prefs.getCharPref(PREF_STORE, "[]"));

  for (let service of config) {
    ServiceInstances.add(new GoogleService(service));
  }
}

const OnlineServices = {
  async createService(type) {
    load();

    let service = new GoogleService({ type });
    ServiceInstances.add(service);
    await service.connect();

    persist();
  },

  deleteService(service) {
    ServiceInstances.delete(service);
    persist();
  },

  getServices() {
    load();

    return [...ServiceInstances];
  },
};
