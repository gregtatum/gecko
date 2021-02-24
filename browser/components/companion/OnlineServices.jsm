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
