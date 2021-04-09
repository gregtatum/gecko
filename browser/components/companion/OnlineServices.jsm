/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const PREF_STORE = "onlineservices.config";

const NUM_EVENTS = 1;

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
  UtilityOverlay: "resource:///modules/UtilityOverlay.jsm",
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
      "https://www.googleapis.com/auth/gmail.readonly",
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
    let token = this.auth.getToken();
    OnlineServices.persist();
    return token;
  }

  async getAccountAddress() {
    let token = await this.auth.getToken();
    OnlineServices.persist();

    let apiTarget = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile"
    );

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
    return results.emailAddress;
  }

  async openLink(target) {
    let account = await this.getAccountAddress();

    let url = `https://accounts.google.com/AccountChooser?Email=${account}&continue=${target}`;

    for (let window of BrowserWindowTracker.orderedWindows) {
      for (let browser of window.gBrowser.browsers) {
        try {
          if (browser.currentURI.hostPort == target.host) {
            window.gBrowser.selectedTab = window.gBrowser.getTabForBrowser(
              browser
            );
            browser.loadURI(url, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            return;
          }
        } catch (e) {
          // Bad hostPort.
        }
      }
    }

    let win = BrowserWindowTracker.getTopWindow({
      allowPopups: false,
    });

    if (win) {
      win.switchToTabHavingURI(url, true, {
        ignoreFragment: true,
      });
    }

    UtilityOverlay.openTrustedLinkIn(url, "tab");
  }

  openCalendar(year, month, day) {
    this.openLink(
      new URL(
        `https://calendar.google.com/calendar/r/day/${year}/${month}/${day}`
      )
    );
  }

  async getNextMeetings() {
    let token = await this.auth.getToken();
    OnlineServices.persist();

    let apiTarget = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    );

    apiTarget.searchParams.set("maxResults", 4);
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
    let events = results.items.map(result => ({
      summary: result.summary,
      start: new Date(result.start.dateTime),
      end: new Date(result.end.dateTime),
      conference: getConferenceInfo(result),
    }));

    events.sort((a, b) => a.start - b.start);
    while (
      events.length > NUM_EVENTS &&
      events[events.length - NUM_EVENTS].start > events[0].start
    ) {
      events.pop();
    }
    events.sort((a, b) => a.summary.localeCompare(b.summary));

    return events;
  }

  openEmail(messageData) {
    if ("link" in messageData) {
      this.openLink(new URL(messageData.link));
    } else {
      this.openLink(
        new URL(`https://mail.google.com/mail/#inbox/${messageData.id}`)
      );
    }
  }

  async getEmailInfo(messageId) {
    let token = await this.auth.getToken();
    OnlineServices.persist();

    let apiTarget = new URL(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`
    );

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

    return {
      id: results.id,
      subject: results.payload.headers.find(
        header => header.name.toLowerCase() == "subject"
      )?.value,
      from: results.payload.headers.find(
        header => header.name.toLowerCase() == "from"
      )?.value,
      date: new Date(parseInt(results.internalDate)),
      snippet: results.snippet,
    };
  }

  async getUnreadEmail() {
    let token = await this.auth.getToken();

    let apiTarget = new URL(
      "https://www.googleapis.com/gmail/v1/users/me/messages"
    );

    apiTarget.searchParams.set("q", "is:unread in:inbox");
    apiTarget.searchParams.set("maxResults", 5);

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

    let messages = [];

    if ("messages" in results) {
      for (const message of results.messages) {
        let result = await this.getEmailInfo(message.id);
        messages.push(result);
      }
    }
    return messages;
  }

  async getUnreadEmailAtom() {
    let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

    if (!response.ok) {
      if (response.status == 403) {
        // Atom feed won't work unless we've navigated to the inbox
        UtilityOverlay.openTrustedLinkIn(
          "https://mail.google.com/mail/u/0/ =",
          "tab"
        );
        // Should set a timer to recheck mail
        return [];
      }
      throw new Error(response.statusText);
    }

    let results = await response.text();

    let doc = new DOMParser().parseFromString(results, "text/xml");

    let entries = doc.querySelectorAll("entry");

    let messages = [];

    for (let entry of entries) {
      let message = {};
      message.subject = entry.querySelector("title").textContent;
      message.from = `${entry.querySelector("author > name").textContent} <${
        entry.querySelector("author > email").textContent
      }>`;
      message.url = entry.querySelector("link").getAttribute("href");
      message.date = new Date(entry.querySelector("issued").textContent);
      messages.push(message);
    }

    return messages;
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
    ServiceInstances.add(new GoogleService(service));
  }
}

const OnlineServices = {
  async createService(type) {
    load();

    let service = new GoogleService({ type });
    ServiceInstances.add(service);
    await service.connect();

    this.persist();
  },

  deleteService(service) {
    ServiceInstances.delete(service);
    this.persist();
  },

  getServices() {
    load();

    return [...ServiceInstances];
  },

  persist() {
    let config = JSON.stringify(Array.from(ServiceInstances));
    Services.prefs.setCharPref(PREF_STORE, config);
  },
};
