/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { XPCShellContentUtils } = ChromeUtils.import(
  "resource://testing-common/XPCShellContentUtils.jsm"
);

const { GapiFakeServer, MapiFakeServer } = ChromeUtils.import(
  "resource:///modules/WorkshopFakeServers.jsm"
);

const { FakeEventFactory } = ChromeUtils.import(
  "resource:///modules/WorkshopFakeEvents.jsm"
);

const { LoginHelper } = ChromeUtils.import(
  "resource://gre/modules/LoginHelper.jsm"
);

const { isAllDayEvent } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

let nsLoginInfo = new Components.Constructor(
  "@mozilla.org/login-manager/loginInfo;1",
  Ci.nsILoginInfo,
  "init"
);

// Facilitates creating a server using XPCShellContentUtils.createHttpServer
XPCShellContentUtils.initMochitest(this);

XPCOMUtils.defineLazyModuleGetters(this, {
  OnlineServices: "resource:///modules/OnlineServices.jsm",
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  Snapshots: "resource:///modules/Snapshots.jsm",
});

registerCleanupFunction(async () => {
  // Reload the companion in the main window, in case tests have been using that.
  let helper = new CompanionHelper(window);
  await helper.reload();

  // Make sure that no tests have accidentally left the Page Action Menu
  // panel open
  let avm = document.querySelector("active-view-manager");
  let testingAPI = avm.getTestingAPI();
  let pageActionMenuPanel = testingAPI.getPageActionPanel();
  if (pageActionMenuPanel.state == "open") {
    await PinebuildTestUtils.closePageActionMenu(pageActionMenuPanel);
  }

  // No matter what happens, blow away window history after tests run
  // in this directory to avoid leaking state between tests.
  gStageManager.reset();

  // Cleanup the Workshop object used in the tests.
  sharedWorkshopAPI?.willDie();

  // Move the cursor out of the companion area to avoid messing with other tests.
  EventUtils.synthesizeMouse(gNavToolbox, 0, 0, { type: "mousemove" });
});

const redirectHosts = [
  "accounts.google.com",
  "docs.googleapis.com",
  "gmail.com",
  "gmail.googleapis.com",
  "mail.google.com",
  "oauth2.googleapis.com",
  "sheets.googleapis.com",
  "slides.googleapis.com",
  "www.googleapis.com",
];
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
        throw new Error(redirectHook + " observed a non-HTTP channel");
      }

      // Only redirect requests for specific host we care about for Workshop.
      let host = new URL(subject.URI.spec)?.host;
      if (!redirectHosts.includes(host)) {
        return;
      }

      let channel = subject.QueryInterface(Ci.nsIHttpChannel);
      let target = null;
      if (channel.URI.scheme === "https") {
        target = channel.URI.spec.replace("https", "http");
      }
      // if we have a target, redirect there
      if (target) {
        let tURI = Services.io.newURI(target);
        try {
          channel.redirectTo(tURI);
        } catch (e) {
          throw new Error("Exception in redirectTo " + e + "\n");
        }
      }
    }
  }
}

/**
 * The time the first event should start at, set to the current time in ms.
 * The UI only shows events starting within the next hour, so we want to ensure
 * any events we create start within that range.
 */
const DEFAULT_FIRST_EVENT_TS = new Date().valueOf();

/**
 * We want to share our server and Workshop object between tests in a suite.
 * Spinning up a new server per test eventually leads to the fake server path handlers
 * returning data created for a prior test. This is likely due to the fact that the
 * httpd servers don't get stopped until all tests in a suite have been run.
 *
 * Deleting accounts and clearing calendars on the server between tests seems to
 * give us a clean slate for events, but is definitely a bit of a workaround.
 * We may run into issues with this when we need to support different fake server types.
 */
let sharedWorkshopAPI;
let sharedRedirector;
let sharedServer;

class WorkshopHelper {
  #apiContentPage;
  #logicLogger;
  #logicScopeBacklog;
  #logicLogBacklog;

  constructor() {
    this.#apiContentPage = null;
    this.#logicLogger = null;
    this.#logicScopeBacklog = [];
    this.#logicLogBacklog = [];

    this.user = {
      email: "organizer@example.com",
      displayName: "Test User",
    };

    this.eventFactory = new FakeEventFactory({
      firstEventTS: DEFAULT_FIRST_EVENT_TS,
    });
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

  #createHttpServer({ hosts }) {
    const httpServer = XPCShellContentUtils.createHttpServer({ hosts });

    return httpServer;
  }

  createFakeServer({ hosts }) {
    if (!sharedRedirector) {
      sharedRedirector = new Redirector();
    }

    if (!sharedServer) {
      // We use XPCShellContentUtils.createHttpServer to create a
      // server and set up a proxy mapping so that we can have a more real-world
      // looking domain name.
      const httpServer = this.#createHttpServer({
        hosts,
      });

      // Hardcoding the server type for now.
      // In the future we will need to make this work with any server type.
      const serverScope = {};
      this.#defineLoggerScope(serverScope, "GapiFakeServer", {});
      sharedServer = new GapiFakeServer({
        httpServer,
        logRequest: (logType, details) => {
          this.#log(serverScope, logType, details);
        },
      });

      this.fakeServer = sharedServer;
      this.fakeServer.start();
    }

    this.fakeServer = sharedServer;
  }

  async createAccount() {
    if (!this.account) {
      const { account } = await this.workshopAPI.tryToCreateAccount(
        {},
        this.fakeServer.domainInfo
      );
      this.account = account;
    }
    return this.account;
  }

  async addCalendarEvents(eventsData) {
    if (!this.account) {
      await this.createAccount();
    }

    let standardizedEvents = this.deriveFullEvents({
      eventSketches: eventsData,
    });

    this.fakeServer.populateCalendar({
      // This might be overkill, but want to ensure unique cal IDs
      // so that Workshop can differentiate between the calendars.
      id: Services.uuid.generateUUID().number.slice(1, -1),
      name: "Default Calendar",
      events: standardizedEvents,
      // Note that this is a name I just made up, not from gapi/mapi.
      calendarOwner: this.user,
    });

    await this.account.syncFolderList();
  }

  async clearAccountAndCalendars() {
    if (this.account) {
      await this.account.deleteAccount();
      this.account = null;
    }
    this.fakeServer.resetCalendars();
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
   * Start up the Workshop backend. Returns the created
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
  async startBackend({ waitFor = "accountsLoaded" }) {
    if (sharedWorkshopAPI) {
      this.workshopAPI = sharedWorkshopAPI;
      return;
    }

    if (this.#apiContentPage) {
      this.#apiContentPage.close();
      this.#apiContentPage = null;
    }

    this.windowlessBrowser = Services.appShell.createWindowlessBrowser(true, 0);

    let system = Services.scriptSecurityManager.getSystemPrincipal();

    this.chromeShell = this.windowlessBrowser.docShell.QueryInterface(
      Ci.nsIWebNavigation
    );

    this.chromeShell.createAboutBlankContentViewer(system, system);

    const scriptUrl =
      "chrome://browser/content/companion/workshop-api-built.js";
    const scriptModule = `
      import { MailAPIFactory } from "${scriptUrl}";
      const OnlineServicesHelper = ChromeUtils.import(
        "resource:///modules/OnlineServicesHelper.jsm"
      );
      const mainThreadServices = OnlineServicesHelper.MainThreadServices(window);
      const workshopAPI = (window.WORKSHOP_API = MailAPIFactory({
        mainThreadServices,
        isHiddenWindow: false,
        isLoggingEnabled: true,
      }));
      window.dispatchEvent(new CustomEvent("apiLoaded"));
`.replace(/\n/g, "");
    const doc = this.chromeShell.document;
    const scriptElem = doc.createElement("script");
    scriptElem.setAttribute("type", "module");
    scriptElem.textContent = scriptModule;
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

    console.log("waiting for", waitFor);
    await workshopAPI.promisedLatestOnce(waitFor);
    console.log("done waiting for", waitFor);

    sharedWorkshopAPI = workshopAPI;
    this.workshopAPI = sharedWorkshopAPI;
  }
}

class CompanionHelper {
  static async whenReady(taskFn, browserWindow = window) {
    let helper;

    const workshopEnabled = Services.prefs.getBoolPref(
      "browser.pinebuild.workshop.enabled",
      false
    );

    if (workshopEnabled) {
      let workshopHelper = new WorkshopHelper();

      // Start the Workshop server before the tests run.
      // For now we're hardcoding the supported Google hosts.
      workshopHelper.createFakeServer({
        hosts: [
          "gmail.com",
          "accounts.google.com",
          "docs.googleapis.com",
          "oauth2.googleapis.com",
          "gmail.googleapis.com",
          "sheets.googleapis.com",
          "slides.googleapis.com",
          "www.googleapis.com",
        ],
      });
      await workshopHelper.startBackend({});

      helper = new CompanionHelper(
        browserWindow,
        workshopEnabled,
        workshopHelper
      );
    } else {
      helper = new CompanionHelper(browserWindow);
    }

    helper.openCompanion();
    await helper.companionReady;

    await taskFn(helper);

    // Ensure we are clearing the account and calendars between tests.
    // This enables us to start fresh with events.
    if (workshopEnabled) {
      await helper.clearWorkshopData();
    }

    helper.closeCompanion();
  }

  constructor(
    browserWindow = window,
    workshopEnabled = false,
    workshopHelper = {}
  ) {
    this.browserWindow = browserWindow;
    this.workshopEnabled = workshopEnabled;
    this.workshopHelper = workshopHelper;
  }

  openCompanion() {
    let companionBox = this.companionBox;
    if (companionBox.isOpen) {
      return;
    }

    // We intentionally click the button here rather than call
    // companionBox.toggleVisible. This is so that we can test that the button
    // is working properly.
    this.browserWindow.document
      .getElementById("companion-sidebar-button")
      .click();
  }

  closeCompanion() {
    let companionBox = this.companionBox;
    if (!companionBox.isOpen) {
      return;
    }

    // We intentionally click the button here rather than call
    // companionBox.toggleVisible. This is so that we can test that the button
    // is working properly.
    this.browserWindow.document
      .getElementById("companion-sidebar-button")
      .click();
  }

  async reload() {
    this.browser.reload();
    await BrowserTestUtils.browserLoaded(
      this.browser,
      false,
      "chrome://browser/content/companion/companion.xhtml"
    );
    await this.companionReady;
  }

  async selectCompanionTab(name) {
    if (name != "now" && name != "browse") {
      throw new Error("Must select 'now' or 'browse' tab");
    }

    await this.runCompanionTask(
      async _name => {
        let deck = content.document.getElementById("companion-deck");
        let tabBtn = content.document.querySelector(`[name="${_name}"]`);
        let tabShown = ContentTaskUtils.waitForEvent(deck, "view-changed");
        tabBtn.click();
        await tabShown;
      },
      [name]
    );
  }

  runCompanionTask(taskFn, args = []) {
    return SpecialPowers.spawn(this.browser, args, taskFn);
  }

  catchNextOpenedUrl() {
    return this.runCompanionTask(async () => {
      let oldOpenUrl = content.openUrl;
      try {
        return await new Promise(resolve => {
          content.openUrl = url => resolve(url);
        });
      } finally {
        content.openUrl = oldOpenUrl;
      }
    });
  }

  overrideRelativeTime(start, diff) {
    return this.runCompanionTask(
      async (startTime, timeDiff) => {
        content.RelativeTime.getNow = () => {
          return new Date(new Date(startTime).getTime() + timeDiff);
        };
      },
      [start, diff]
    );
  }

  async clearWorkshopData() {
    await this.workshopHelper.clearAccountAndCalendars();
  }

  get companionReady() {
    return this.runCompanionTask(async () => {
      if (content.gInitialized) {
        await content.gInitialized;
      } else {
        await ContentTaskUtils.waitForEvent(content, "CompanionInitialized");
      }
    });
  }

  get browser() {
    return this.browserWindow.document.getElementById("companion-browser");
  }

  get companionBox() {
    return this.browserWindow.document.getElementsByTagName(
      "companion-manager"
    )[0];
  }

  get companionToggleButton() {
    return this.browserWindow.document.getElementById(
      "companion-sidebar-button"
    );
  }
  /**
   * @typedef {Object} SetCalendarEventOptions
   *   Various options that can be passed to modify setCalendarEvents.
   * @property {number} [expectedEventCount]
   *   Number of the supplied events expected to be returned from the backend.
   *   Specified in cases where events should get filtered.
   * @property {string} [listType]
   *   Used to specify whether we are targeting the calendar list in the
   *   "now" or "browse" section to ensure we listen for "calendar-events-updated"
   *   on the correct element.
   */

  /**
   * Sets up events needed for a given test and waits for any resulting UI
   * updates to finish before proceeding.
   *
   * @param {Object[]} eventsData Array of events for the current test run.
   * @param {SetCalendarEventOptions} options
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once the events have been received and the DOM has been updated.
   */
  async setCalendarEvents(eventsData, { expectedEventCount, listType } = {}) {
    if (this.workshopEnabled) {
      await this.workshopHelper.addCalendarEvents(eventsData);
      await this.runCompanionTask(
        async (events, options) => {
          content.document.dispatchEvent(
            new content.CustomEvent("refresh-events", {})
          );
          // Checking the event list based on the assumption that we're testing
          // the calendar UI whenever we set events, which seems reasonable for now.
          const selector = options.listType
            ? "#browse-event-list"
            : "calendar-event-list";
          let calendarEventList = content.document.querySelector(selector);

          await ContentTaskUtils.waitForEvent(
            calendarEventList,
            "calendar-events-updated",
            false,
            e => {
              if (options.expectedEventCount != undefined) {
                return e.detail.eventCount === options.expectedEventCount;
              }
              return e.detail.eventCount === events.length;
            }
          );
        },
        [eventsData, { expectedEventCount, listType }]
      );
    } else {
      let oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

      let now = new Date();
      let today = new Date(now);
      let todayTS = today.setHours(0, 0, 0, 0);

      let tomorrow = new Date(todayTS);
      let tomorrowTS = tomorrow.setDate(today.getDate() + 1);

      let standardizedEvents = eventsData
        .filter(
          event =>
            !event.startDate ||
            !event.endDate ||
            (new Date(event.startDate).valueOf() <= tomorrowTS &&
              new Date(event.endDate).valueOf() >= todayTS)
        )
        .map(event => {
          let startDate = event.startDate || new Date();
          let endDate = event.endDate || oneHourFromNow;

          // TODO: We should remove this once workshop is enabled.
          let isAllDay = isAllDayEvent(startDate, endDate);

          return {
            id: new Date(), // guarantee a unique id for this event
            startDate,
            endDate,
            links: [],
            conference: {},
            calendar: { id: "primary" },
            attendees: [],
            organizer: { email: "organizer@example.com", isSelf: false },
            creator: { email: "creator@example.com", isSelf: false },
            serviceId: 0,
            isAllDay,
            ...event,
          };
        })
        .sort((a, b) => a.startDate - b.startDate);
      await this.runCompanionTask(
        async events => {
          content.document.dispatchEvent(
            new content.CustomEvent("refresh-events", {
              detail: { events },
            })
          );
          let calendarEventList = content.document.querySelector(
            "calendar-event-list"
          );
          await calendarEventList.updateComplete;
        },
        [standardizedEvents]
      );
    }
  }

  async loginToTestService(serviceType) {
    const clickLoginLink = () =>
      SpecialPowers.spawn(
        this.browserWindow.gBrowser.selectedBrowser,
        [],
        async () => {
          let link = await ContentTaskUtils.waitForCondition(() =>
            content.document.querySelector("a")
          );
          link.click();
        }
      );
    const authStarted = BrowserTestUtils.waitForNewTab(
      this.browserWindow.gBrowser
    );

    if (this.workshopEnabled) {
      const companionActor = this.browserWindow.document
        .getElementById("companion-browser")
        .browsingContext.currentWindowGlobal.getActor("Companion");
      companionActor.sendAsyncMessage("Companion:TestCreateAccount", {
        type: serviceType,
      });
      let authenticated = TestUtils.topicObserved(
        "companion-signin",
        (_, data) => data == serviceType
      );
      await authStarted;
      await clickLoginLink();
      await authenticated;
    } else {
      let created = OnlineServices.createService(serviceType);
      await authStarted;
      await clickLoginLink();
      await created;
    }
  }

  async logoutFromTestService(serviceType) {
    if (this.workshopEnabled) {
      const companionActor = this.browserWindow.document
        .getElementById("companion-browser")
        .browsingContext.currentWindowGlobal.getActor("Companion");
      companionActor.sendAsyncMessage("Companion:TestDeleteAccount", {
        type: serviceType,
      });
      await TestUtils.topicObserved(
        "companion-signout",
        (_, data) => data == serviceType
      );
    } else {
      await Promise.all(
        OnlineServices.getServices(serviceType).map(service =>
          OnlineServices.deleteService(service)
        )
      );
    }
  }

  async createAccount() {
    if (this.workshopEnabled) {
      const account = await this.workshopHelper.createAccount();
      return account;
    }

    const MOCK_SERVICE = "testservice";
    if (!OnlineServices.hasService(MOCK_SERVICE)) {
      await this.loginToTestService(MOCK_SERVICE);
      registerCleanupFunction(async () => {
        await this.logoutFromTestService(MOCK_SERVICE);
      });
    }
    const service = OnlineServices.getServices(MOCK_SERVICE)[0];
    return { name: service.getAccountAddress() };
  }
}

var PinebuildTestUtils = {
  /**
   * Waits for the <browser> to load, and then returns the current View.
   * This assumes that the desired load is going to result in a new View
   * that will become current.
   *
   * @param {Element} browser The <browser> that will start the load.
   * @param {String|null} [wantLoad=null]
   *        If a function, takes a URL and returns true if that's the load we're
   *        interested in. If a string, gives the URL of the load we're interested
   *        in. If not present, the first non-about:blank load is used.
   * @return {Promise}
   * @resolves With the View that is current after the load is completed.
   */
  async waitForNewView(browser, wantLoad = null) {
    await BrowserTestUtils.browserLoaded(browser, false, wantLoad);
    return browser.ownerGlobal.gStageManager.currentView;
  },

  /**
   * Sets a View to be current, and waits for the ViewChanged event to fire.
   *
   * @param {View} view The View to make current.
   * @param {Window?} win
   *   The window to the view is from, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after setting the View.
   */
  async setCurrentView(view, win = window) {
    let viewChangedPromise = this.waitForSelectedView(view, win);
    let viewUpdatedPromise = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "ViewUpdated",
      false,
      event => event.view == view
    );
    win.gStageManager.setView(view);
    await Promise.all([viewUpdatedPromise, viewChangedPromise]);
    return viewChangedPromise;
  },

  /**
   * Waits for a particular View to be made current in StageManager. If
   * this view needs to load, then that will be waited for too.
   *
   * @param {View} view The View that is expected to become current.
   * @param {Window?} win
   *   The window to the view is from, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after setting the View.
   */
  async waitForSelectedView(view, win = window) {
    let viewChanged = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "ViewChanged",
      false,
      event => event.view == view
    );
    let controller = new AbortController();
    let viewLoaded = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "ViewLoaded",
      false,
      event => event.view == view,
      false,
      controller.signal
    );
    let viewChangedEvent = await viewChanged;
    if (viewChangedEvent.detail.navigating) {
      // We're actually loading this view, so we need to wait for
      // the ViewLoaded event to fire.
      await viewLoaded;
    } else {
      // There's not going to be a ViewLoaded event, to tear down the
      // ViewLoaded event listener.
      controller.abort();
    }
  },

  /**
   * Helper assertion function that checks that two View references are
   * pointing at the same object. If not, logs some interesting things about
   * the unequal Views.
   *
   * @param {View} viewA The View to compare with viewB
   * @param {View} viewB The View to compare with viewA
   */
  assertEqualViews(viewA, viewB) {
    if (viewA === viewB) {
      Assert.ok(true, "Views are equal.");
    } else {
      Assert.ok(false, "Views are not equal.");
      info(`View A: ${viewA.title} - ${viewA.url.spec}\n`);
      info(`View B: ${viewB.title} - ${viewB.url.spec}\n`);
    }
  },

  /**
   * Helper assertion function that compares a window's array of Views and
   * compares their urls to those provided.
   *
   * @param {string[]} urls
   *   An Array of urls.
   * @param {Window?} win
   *   The window the views are from, the current window is used by default
   */
  assertUrlsAre(urls, win = window) {
    let riverUrls = win.gStageManager.views.map(view => view.url.spec);
    Assert.deepEqual(riverUrls, urls);
  },

  /**
   * Helper assertion function that compares a window's array of
   * Views with viewArray and logs information if they don't match.
   *
   * @param {View[]} viewArray
   *   An Array of Views to compare with gStageManager.views.
   * @param {Window?} win
   *   The window the views are from, the current window is used by default
   */
  assertViewsAre(viewArray, win = window) {
    if (win.gStageManager.views.length != viewArray.length) {
      Assert.ok(false, "View lengths do not match.");
      return;
    }

    for (let i = 0; i < viewArray.length; ++i) {
      info(`Checking View at index ${i}`);
      this.assertEqualViews(win.gStageManager.views[i], viewArray[i]);
    }
  },

  /**
   * Sends a window back a View.
   * @param {Window?} win
   *   The window to navigate, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goBack(win = window) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "ViewChanged"
    );
    win.gStageManager.goBack();
    return viewChangedPromise;
  },

  /**
   * Sends a window forward a View.
   * @param {Window?} win
   *   The window to navigate, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goForward(win = window) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "ViewChanged"
    );
    win.gStageManager.goForward();
    return viewChangedPromise;
  },

  /**
   * Test helper for generating a start time at 18:00 and an end time. By default,
   * the event's duration is only 30 minutes but can be set using the `eventHourDuration`
   * and `eventMinutesDuration` parameters.
   *
   * @param {Number}  eventDurationHours
   *        Optional. The hour duration of an event. Defaults to 0.
   * @param {Number}  eventDurationMinutes
   *        Optional. The remaining minute duration of an event. Defaults to 30.
   * @param {Number|Date}  eventStartHourOrDate
   *        Optional. Either the hour or Date the event starts at. In cases where we are
   *        using dynamically generated times, passing a Date is more reliable. Defaults to 18:00.
   * @param {Number}  eventStartMinutes
   *        Optional. The starting minutes for the event. Defaults to 0.
   * @return {Object} Object containing the event start and end times as ISO strings.
   */
  generateEventTimes(
    eventDurationHours = 0,
    eventDurationMinutes = 30,
    eventStartHourOrDate = 18,
    eventStartMinutes = 0
  ) {
    // Set start time
    let startTime;
    if (eventStartHourOrDate instanceof Date) {
      startTime = eventStartHourOrDate;
    } else {
      startTime = new Date();
      startTime.setHours(eventStartHourOrDate);
      startTime.setMinutes(eventStartMinutes);
    }

    // Set end time
    let endTime = new Date(startTime);

    if (eventDurationHours > 0) {
      endTime.setHours(startTime.getHours() + eventDurationHours);
    }

    endTime.setMinutes(startTime.getMinutes() + eventDurationMinutes);

    return {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    };
  },

  /**
   * Loads a series of URLs into the window and waits until the Views
   * have been added to the ActiveViewManager.
   *
   * @param {String[]} urls
   *   An array of URL strings to load, in order.
   * @param {Window?} win
   *   The window to load the URLs in. The current window is used by
   *   default
   * @return {Promise}
   * @resolves {View[]} The array of Views that were loaded, in the same
   *   order as the URL strings.
   */
  async loadViews(urls, win = window) {
    let browser = win.gBrowser.selectedBrowser;
    let views = [];

    for (let url of urls) {
      let viewAddedPromise = BrowserTestUtils.waitForEvent(
        win.gStageManager,
        "ViewAdded"
      );
      let viewChangedPromise = BrowserTestUtils.waitForEvent(
        win.gStageManager,
        "ViewChanged"
      );
      let loaded = BrowserTestUtils.browserLoaded(browser, false, url);
      BrowserTestUtils.loadURI(browser, url);
      let viewAddedEvent = await viewAddedPromise;
      views.push(viewAddedEvent.view);
      await viewChangedPromise;
      await loaded;
    }

    return views;
  },

  /**
   * Returns the ViewGroup DOM elements in the ActiveViewManager
   * in a window. This does not include pinned ViewGroups.
   *
   * @param {Window?} win
   *   The window to get the ViewGroups for. The current window is used by
   *   default
   * @return {Promise}
   * @resolves {ViewGroup[]} The ViewGroup DOM nodes for the current window.
   */
  async getViewGroups(win = window) {
    let river = win.document.querySelector("river-el");
    // Make sure LitElement has finished any in-flight DOM update jobs.
    await river.updateComplete;
    return Array.from(
      river.shadowRoot.querySelectorAll("view-group:not([hidden])")
    );
  },

  /**
   * Returns the top-most View in the River (the "active" View).
   *
   * @param {Window?} win
   *   The window to get the active View for. The current window is used by
   *   default
   * @return {Promise}
   * @resolves {View} The active View.
   */
  async getActiveView(win = window) {
    let viewGroups = await this.getViewGroups(win);
    let topGroup = viewGroups.at(-1);
    Assert.ok(topGroup, "Found a top-most ViewGroupElement.");
    Assert.ok(topGroup.lastView, "Top-most ViewGroupElement contains a View.");
    return topGroup.lastView;
  },

  /**
   * Returns the pinned ViewGroups in the ActiveViewManager in a window.
   * This also ensures that there's only 1 View per pinned ViewGroup.
   *
   * @param {Window?} win
   *   The window to get the ViewGroups for. The current window is used by
   *   default
   * @return {Promise}
   * @resolves {ViewGroup[]} The pinned ViewGroup DOM nodes for the current
   *   window.
   */
  async getPinnedViewGroups(win = window) {
    let pinnedViews = window.document.querySelector("pinned-views");
    // Make sure LitElement has finished any in-flight DOM update jobs.
    await pinnedViews.updateComplete;
    let viewGroups = pinnedViews.shadowRoot.querySelectorAll("view-group");
    for (let viewGroup of viewGroups) {
      Assert.equal(
        viewGroup.viewGroup.length,
        1,
        "There should be 1 View for each pinned ViewGroup."
      );
    }

    return Array.from(viewGroups);
  },

  /**
   * Opens the Page Action Menu for a ViewGroup and returns the <panel>
   * element for the Page Action Menu. This assumes that the ViewGroup
   * contains the current View and that the Page Action Menu button is
   * visible. Callers should ensure that they close the Page Action Menu
   * by passing the <panel> to closePageActionMenu, unless they close
   * it by some other means.
   *
   * @param {ViewGroup} viewGroup
   *   The ViewGroup to open the Page Action Menu for.
   * @return {Promise}
   * @resolves {Element} The <panel> for the Page Action Menu.
   */
  async openPageActionMenu(viewGroup) {
    let win = viewGroup.ownerGlobal;
    let doc = win.document;
    let avm = doc.querySelector("active-view-manager");
    let testingAPI = avm.getTestingAPI();
    let pageActionMenuPanel = testingAPI.getPageActionPanel();
    Assert.ok(
      pageActionMenuPanel,
      "Should have found the Page Action Menu panel."
    );

    let popupshown = BrowserTestUtils.waitForEvent(
      pageActionMenuPanel,
      "popupshown"
    );
    let pageActionMenuButton = viewGroup.shadowRoot.querySelector(
      ".page-action-button"
    );

    Assert.ok(
      !BrowserTestUtils.is_hidden(pageActionMenuButton),
      "Page Action Menu button is visible."
    );
    EventUtils.synthesizeMouseAtCenter(pageActionMenuButton, {}, win);
    await popupshown;
    return pageActionMenuPanel;
  },

  /**
   * Closes a previously opened Page Action Menu.
   *
   * @param {Element} pageActionMenuPanel
   *   The panel for the Page Action Menu.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once the Page Action Menu has fired its popuphidden event.
   */
  async closePageActionMenu(pageActionMenu) {
    let popuphidden = BrowserTestUtils.waitForEvent(
      pageActionMenu,
      "popuphidden"
    );
    pageActionMenu.hidePopup();
    await popuphidden;
  },

  /**
   * Sets aside a session in a window and waits until the about:flow-reset
   * page is displayed.
   *
   * @param {Window?} win
   *   The window to set aside a session for. It is assumed that a session
   *   has begun for this window.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once the about:flow-reset page has been loaded.
   */
  async setAsideSession(win = window) {
    let sessionSetAside = SessionManager.once("session-set-aside");
    let sessionReplaced = SessionManager.once("session-replaced");
    let flowResetLoaded = BrowserTestUtils.waitForNewTab(
      win.gBrowser,
      "about:flow-reset",
      true
    );
    await SessionManager.replaceSession(win);
    await sessionSetAside;
    await sessionReplaced;
    await flowResetLoaded;
  },

  /**
   * Enters the history carousel for a particular window.
   *
   * @param {Window?} win
   *   The window to open the history carousel in. Defaults to the current
   *   window.
   * @return {Promise}
   * @resolves {Element}
   *   Resolves with the <browser> element hosting the about:historycarousel
   *   document once it has fired the event declaring itself as "ready".
   */
  async enterHistoryCarousel(win = window) {
    let entered = win.gHistoryCarousel.showHistoryCarousel(true);
    let browser = win.document.getElementById("historycarousel-browser");
    let ready = BrowserTestUtils.waitForContentEvent(
      browser,
      "HistoryCarouselReady"
    );
    await Promise.all([entered, ready]);
    return browser;
  },

  /**
   * Exits the history carousel for a particular window.
   *
   * @param {Window?} win
   *   The window to open the history carousel in. Defaults to the current
   *   window.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once the about:historycarousel document has been torn down
   *   and the current View is staged.
   */
  async exitHistoryCarousel(win = window) {
    let exitEvent = BrowserTestUtils.waitForEvent(win, "HistoryCarousel:Exit");
    await win.gHistoryCarousel.showHistoryCarousel(false);
    await exitEvent;
  },

  /**
   * @typedef {object} HistoryCarouselPreview
   *   An object describing an individual preview hosted in
   *   about:historycarousel.
   * @property {string} title
   *   The title rendered for the preview in the <caption> element.
   * @property {string} titleTooltip
   *   The tooltip shown to the user when they hover the <caption> element.
   * @property {string} iconURL
   *   The URL for the favicon shown next to the title.
   * @property {boolean} hasBlob
   *   True if the preview is showing the <img> displaying a Blob URL.
   * @property {boolean} hasWireframe
   *   True if the preview is showing an <svg> wireframe for an unloaded
   *   page.
   */

  /**
   * @typedef {object} HistoryCarouselPreviewsData
   *   An object describing the previews shown in about:historycarousel.
   * @property {number} currentIndex
   *   The currently selected index within the carousel.
   * @property {HistoryCarouselPreview[]} previews
   *   An array of HistoryCarouselPreview objects describing each preview.
   */

  /**
   * Reaches into a <browser> element hosting an about:historycarousel
   * document, and returns information about the previews that its showing.
   *
   * @param {Element} browser
   *   The <browser> element hosting the about:historycarousel document.
   * @return {Promise}
   * @resolves {HistoryCarouselPreviewsData}
   *   Resolves with an object describing the previews being shown in the
   *   history carousel.
   */
  async getHistoryCarouselPreviews(browser) {
    return SpecialPowers.spawn(browser, [], async () => {
      let previewEls = Array.from(content.document.querySelectorAll("li"));
      let previews = previewEls.map(p => {
        let faviconSrc = p.querySelector(".favicon").src;
        let iconURL = faviconSrc == "null" ? null : faviconSrc;
        let pinned = p.getAttribute("pinned") == "true";

        return {
          title: p.querySelector(".caption").textContent,
          titleTooltip: p.querySelector(".caption").title,
          iconURL,
          pinned,
          hasBlob:
            !pinned &&
            p.querySelector(".preview-image").src?.startsWith("blob:"),
          hasWireframe: !pinned && !!p.querySelector("svg"),
          index: p.index,
        };
      });
      let currentPreview = content.document.querySelector("li[current]");
      let currentIndex = currentPreview.index;
      return {
        previews,
        currentIndex,
      };
    });
  },

  /**
   * Reaches into a <browser> element hosting an about:historycarousel
   * document, simulates scrolling to a preview at a particular index.
   *
   * @param {Element} browser
   *   The <browser> element hosting the about:historycarousel document.
   * @param {number} previewIndex
   *   The index of the preview to scroll to.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once both StageManager and the history carousel have
   *   acknowledged that the current preview index has changed.
   */
  async selectHistoryCarouselIndex(browser, previewIndex) {
    let waitForSelectionChange = this.waitForSelectedHistoryCarouselIndex(
      browser,
      previewIndex
    );
    await SpecialPowers.spawn(browser, [previewIndex], async index => {
      let previewEls = Array.from(content.document.querySelectorAll("li"));
      let previewEl = previewEls[index];
      previewEl.scrollIntoView({ behavior: "instant", inline: "center" });
    });
    await waitForSelectionChange;
  },

  /**
   * Waits for the about:historycarousel document hosted in browser to
   * set a particular preview as selected, meaning that it's scrolled
   * into the center of the viewport.
   *
   * @param {Element} browser
   *   The <browser> element hosting the about:historycarousel document.
   * @param {number} previewIndex
   *   The index of the preview that is expected to be selected.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once both StageManager and the history carousel have
   *   acknowledged that the current preview index has changed.
   */
  async waitForSelectedHistoryCarouselIndex(browser, previewIndex) {
    await SpecialPowers.spawn(browser, [previewIndex], async index => {
      let oldSelectedPreview = content.document.querySelector("li[current]");
      Assert.notEqual(
        index,
        oldSelectedPreview.index,
        "Selected index wasn't initially the current one."
      );
      await ContentTaskUtils.waitForEvent(
        content,
        "HistoryCarouselIndexUpdated",
        false,
        e => e.detail == index
      );

      let newSelectedPreview = content.document.querySelector("li[current]");
      Assert.notEqual(oldSelectedPreview, newSelectedPreview);
      Assert.equal(
        index,
        newSelectedPreview.index,
        "Selected preview element has the right index."
      );
    });
  },

  /**
   * Opens a new browser window and runs the specified test function
   * in that window.
   *
   * @param {Function} fn
   *   The test function to run in the new window.
   * @return {Promise}
   * @resolves {undefined}
   *   Resolves once both the test function has run and the newly
   *   opened window has been closed.
   */
  async withNewBrowserWindow(fn) {
    let win = await BrowserTestUtils.openNewBrowserWindow();
    try {
      await fn(win);
    } finally {
      await BrowserTestUtils.closeWindow(win);
    }
  },
};
