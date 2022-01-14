/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* eslint-disable no-unused-vars */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { FakeEventFactory } = ChromeUtils.import(
  "resource:///modules/WorkshopFakeEvents.jsm"
);

const { XPCShellContentUtils } = ChromeUtils.import(
  "resource://testing-common/XPCShellContentUtils.jsm"
);

const { GapiFakeServer, MapiFakeServer, FeedFakeServer } = ChromeUtils.import(
  "resource:///modules/WorkshopFakeServers.jsm"
);

Cu.importGlobalProperties(["fetch"]);

// Relevant subsystems like profile-after-change.
do_get_profile(true);

// Temporarily force Places to come into existence because under DEBUG builds
// test_feed_parsers.js can cause Places to be created asynchronously in a way
// that ends up racing the shutdown of xpcshell that induces assertions about
// the shutdown phase.
const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);
PlacesUtils.favicons;

function readFileData(path) {
  const file = do_get_file(path, false);
  return IOUtils.readUTF8(file.path);
}

/**
 * The default fixed date/time to use if not explicitly specified, currently
 * Monday, September 13th at 8:50am in the local timezone.
 */
const DEFAULT_FAKE_NOW_TS = new Date(2021, 8, 13, 8, 50).valueOf();
/**
 *
 * The time the first event should start at, currently 9am for the above day.
 * This impacts automatically assigned times for events/meetings that aren't
 * explicitly specified.
 */
const DEFAULT_FIRST_EVENT_TS = new Date(2021, 8, 13, 9).valueOf();

const redirectHook = "http-on-modify-request";
class Redirector {
  constructor() {
    Services.obs.addObserver(this, redirectHook, true);
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);

  observe(subject, topic, data) {
    if (topic == redirectHook) {
      if (!(subject instanceof Ci.nsIHttpChannel)) {
        do_throw(redirectHook + " observed a non-HTTP channel");
      }
      var channel = subject.QueryInterface(Ci.nsIHttpChannel);
      var target = null;
      if (channel.URI.scheme === "https") {
        target = channel.URI.spec.replace("https", "http");
      }
      // if we have a target, redirect there
      if (target) {
        var tURI = Services.io.newURI(target);
        try {
          channel.redirectTo(tURI);
        } catch (e) {
          do_throw("Exception in redirectTo " + e + "\n");
        }
      }
    }
  }
}

class WorkshopHelperClass {
  #apiContentPage;
  #logicLogger;
  #logicScopeBacklog;
  #logicLogBacklog;
  #redirector;

  constructor() {
    this.user = {
      email: "organizer-creator@organizer-creator.nul",
      displayName: "Test User",
    };

    this.eventFactory = new FakeEventFactory({
      firstEventTS: DEFAULT_FIRST_EVENT_TS,
    });

    XPCShellContentUtils.ensureInitialized(globalThis);

    this.#apiContentPage = null;

    this.#logicLogger = null;
    this.#logicScopeBacklog = [];
    this.#logicLogBacklog = [];

    this.#redirector = null;
  }

  #defineLoggerScope(...args) {
    if (this.#logicLogger) {
      this.#logicLogger.defineScope(...args);
    } else {
      this.#logicScopeBacklog.push(args);
    }
  }

  #gotLogicInstance(logic) {
    if (this.#logicLogger) {
      return;
    }

    this.#logicLogger = logic;

    for (const args of this.#logicScopeBacklog) {
      logic.defineScope(...args);
    }
    this.#logicScopeBacklog = null;

    for (const args of this.#logicLogBacklog) {
      logic(...args);
    }
    this.#logicLogBacklog = null;
  }

  #log(...args) {
    if (this.#logicLogger) {
      this.#logicLogger(...args);
    } else {
      this.#logicLogBacklog.push(args);
    }
  }

  /**
   * Given an ordered list of minimal event characteristics, fill in necessary
   * details to be a valid event and order the events sequentially.
   */
  deriveFullEvents({ eventSketches }) {
    return this.eventFactory.deriveFullEvents({
      eventSketches,
      creator: this.user,
      organizer: this.user,
    });
  }

  /**
   * Sort from the greater to the smaller startDate.
   * @param {Array<Object>} events - Array of events
   * @returns {integer}
   */
  sortByStartDate(events) {
    events = events.concat();
    events.sort(
      (e1, e2) => e2.startDate - e1.startDate || e2.endDate - e1.endDate
    );
    return events;
  }

  /**
   * Helper to compare events, with output being reported in terms of the
   * originally provided sketches rather than potentially verbose fully
   * populated events.
   *
   * XXX Need to at least address the link use-cases; see below for more.
   *
   * TODO: Do a more thorough field-level check on the events; right now we're
   * just mapping the synchronized data by summary which means we're not
   * validating the links, etc.  It could make sense to involve `logic` in this
   * process combined with leveraging its `toJSON` awareness, noting that
   * `CalEvent.toJSON` currently just provided identity info and will need to
   * instead provide a more extensive read-out if we go that way.  It's also
   * possible that logic could adopt an entirely custom `toVerboseJSON` approach
   * or something.
   *
   * Since events are happening in the time line, they're fundamentally ordered
   * by their starting/ending dates, so arrays are sorted by (startDate, endDate)
   * before being compared.
   */
  eventsEqual(actual, expected) {
    deepEqual(
      this.eventFactory.mapEventsToSketches(actual),
      this.eventFactory.mapEventsToSketches(this.sortByStartDate(expected)),
      "events arrays are equal (per sketches)"
    );
  }

  #createHttpServer({ hosts }) {
    const httpServer = XPCShellContentUtils.createHttpServer({ hosts });

    return httpServer;
  }

  async createFakeServer({ configurator, events }) {
    if (!this.#redirector) {
      this.#redirector = new Redirector();
    }

    // Make mail.google.com and few others accessible.
    // This domain is in security/manager/ssl/nsSTSPreloadList.inc.
    // See remote/marionette/cert.js
    Services.prefs.setBoolPref(
      "network.stricttransportsecurity.preloadlist",
      false
    );

    // Note: We could use XPCShellContentUtils.createHttpServer to create a
    // server and set up a proxy mapping so that we can have a more real-world
    // looking domain name.
    const httpServer = this.#createHttpServer({
      hosts: configurator.hosts /**/,
    });

    const serverScope = {};
    this.#defineLoggerScope(serverScope, `${configurator.name}FakeServer`, {});
    const fakeServer = configurator.createFakeServer({
      httpServer,
      logRequest: (logType, details) => {
        this.#log(serverScope, logType, details);
      },
    });

    fakeServer.start();

    fakeServer.defaultCalendar = fakeServer.populateCalendar({
      id: "default",
      name: "Default Calendar",
      events,
      // Note that this is a name I just made up, not from gapi/mapi.
      calendarOwner: this.user,
    });

    return fakeServer;
  }

  /**
   * Start up the backend and immediately perform a time-warp to the given
   * `fakeNow` (defaulting to DEFAULT_FAKE_NOW_TS).  Returns the created
   * WorkshopAPI after waiting for it to reach either "accountsLoaded" (default)
   * or "configLoaded" states.
   *
   * In theory this could be called multiple times to create multiple clients,
   * but if you do that, you should probably update the docs here.
   *
   * ## Implementation Note Re: Modules
   *
   * Because module loading can only happen inside a window right now and the
   * sandbox and backstagepass globals lack the necessary window global, we
   * create a chrome-privileged about:blank that we use.
   */
  async startBackend({
    fakeNow = DEFAULT_FAKE_NOW_TS,
    waitFor = "accountsLoaded",
  }) {
    if (this.#apiContentPage) {
      this.#apiContentPage.close();
      this.#apiContentPage = null;
    }

    const browser = (this.windowlessBrowser = Services.appShell.createWindowlessBrowser(
      true,
      0
    ));
    // Ensure that we clean up every browser we create, which we can create more
    // than one of.
    registerCleanupFunction(() => {
      browser.close();
    });

    let system = Services.scriptSecurityManager.getSystemPrincipal();

    this.chromeShell = this.windowlessBrowser.docShell.QueryInterface(
      Ci.nsIWebNavigation
    );

    this.chromeShell.createAboutBlankContentViewer(system, system);

    const doc = this.chromeShell.document;
    const scriptElem = doc.createElement("script");
    scriptElem.setAttribute("type", "module");
    // Previously the contents of this script were inline, but this ran afoul
    // of the checks in `nsContentSecurityUtils::ValidateScriptFilename`
    // (quite reasonably) not liking the inline / dynamic JS, so we now use a
    // resource URI which is explicitly allowed.
    scriptElem.setAttribute("src", "resource://test/bootstrap_workshop.js");
    doc.body.appendChild(scriptElem);
    const win = doc.defaultView;

    await new Promise(resolve => {
      win.addEventListener("apiLoaded", resolve, { once: true });
    });

    const workshopAPI = Cu.waiveXrays(win.WORKSHOP_API);

    // Note: This currently labels us as using the same "tid" as the API.  This
    // is pedantically correct under "t = thread", but it might be better for
    // the test itself to be further delineated.  This could be handled by
    // having the scopes just include extra meta-info though.

    await workshopAPI.modifyConfig({
      debugLogging: "realtime",
    });
    this.#gotLogicInstance(workshopAPI.logic);

    workshopAPI.TEST_timeWarp({ fakeNow });

    console.log("waiting for", waitFor);
    await workshopAPI.promisedLatestOnce(waitFor);
    console.log("done waiting for", waitFor);

    return workshopAPI;
  }
}

class GapiConfiguratorHelperClass {
  get name() {
    return "Gapi";
  }

  get hosts() {
    return [
      // Primary is the email domain.
      "gmail.com",
      "accounts.google.com",
      "docs.googleapis.com",
      "oauth2.googleapis.com",
      "gmail.googleapis.com",
      "sheets.googleapis.com",
      "slides.googleapis.com",
      "www.googleapis.com",
      "mail.google.com",
    ];
  }

  createFakeServer({ httpServer, logRequest }) {
    return new GapiFakeServer({ httpServer, logRequest });
  }
}

class MapiConfiguratorHelperClass {
  get name() {
    return "Mapi";
  }

  get hosts() {
    return ["graph.microsoft.com", "login.microsoftonline.com"];
  }

  createFakeServer({ httpServer, logRequest }) {
    return new MapiFakeServer({ httpServer, logRequest });
  }
}

class FeedConfiguratorHelperClass {
  get name() {
    return "Feed";
  }

  get hosts() {
    return ["www.allizom.org"];
  }

  createFakeServer({ httpServer, logRequest }) {
    return new FeedFakeServer({ httpServer, logRequest });
  }
}

const GapiConfigurator = new GapiConfiguratorHelperClass();
const MapiConfigurator = new MapiConfiguratorHelperClass();
const FeedConfigurator = new FeedConfiguratorHelperClass();
const WorkshopHelper = new WorkshopHelperClass();
