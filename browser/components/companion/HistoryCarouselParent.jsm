/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["HistoryCarousel", "HistoryCarouselParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "CLICK_COUNT_TIMEOUT_MS",
  "browser.pinebuild.megaback.click-count-timeout-ms",
  3000
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "CLICK_COUNT_THRESHOLD",
  "browser.pinebuild.megaback.click-count-threshold",
  5
);

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "HistoryCarousel",
    maxLogLevelPref: "browser.pinebuild.megaback.logLevel",
  });
});

/**
 * The HistoryCarousel class is responsible for interpreting whether or not
 * the user has interacted with the back button in a way that indicates
 * that they want to show the history carousel. Currently, there are
 * two interactions that do this:
 *
 * 1. A long-press on the back button
 * 2. Frequent clicks on the back button within a time period. Currently,
 *    that's CLICK_COUNT_THRESHOLD clicks during a
 *    CLICK_COUNT_TIMEOUT_MS period.
 */
class HistoryCarousel {
  #timerID;
  #clickCount;
  #openedByLongPress;
  #window;
  #enabled;
  #containerCache;

  /**
   * Sets up the event handlers on the back button.
   */
  constructor(window) {
    this.#timerID = null;
    this.#clickCount = 0;
    this.#openedByLongPress = false;
    this.#window = window;
    this.#enabled = false;
    this.#containerCache = null;
  }

  init() {
    if (
      !Services.prefs.getBoolPref("browser.pinebuild.megaback.enabled", false)
    ) {
      return;
    }
    let doc = this.#window.document;
    let pbBackButton = doc.getElementById("pinebuild-back-button");

    // We need to add this capturing click event handler before adding
    // to the gClickAndHoldListenersOnElement to ensure the click event
    // handler is called first. That gives us an opportunity to cancel
    // the back button click command from running if the user long
    // presses on the back button.
    pbBackButton.addEventListener("click", this, { capture: true });

    this.#window.gClickAndHoldListenersOnElement.add(pbBackButton, () => {
      // The user longpressed, so set this flag to prevent the back
      // command from being fired on click.
      this.#openedByLongPress = true;
      this.showHistoryCarousel(true);
    });
  }

  handleEvent(event) {
    if (event.type != "click") {
      return;
    }
    // This is kind of a hack, but if this flag is set, then we
    // prevent the click event from continuing to propagate, and
    // call preventDefault. This prevents both the
    // gClickAndHoldListenersOnElement command and the default
    // XUL command machinery from firing. We then clear the flag
    // to make sure that clicks continue to work.
    if (this.#openedByLongPress) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#openedByLongPress = false;
      return;
    }

    if (!this.#timerID) {
      this.#clickCount = 1;
      this.#timerID = this.#window.setTimeout(() => {
        this.resetCount();
      }, CLICK_COUNT_TIMEOUT_MS);
    } else {
      this.#clickCount++;
      if (this.#clickCount >= CLICK_COUNT_THRESHOLD) {
        this.#window.clearTimeout(this._timerID);
        this.resetCount();
        this.showHistoryCarousel(true);
      }
    }
  }

  /**
   * Rests the tracked number of clicks on the back button back
   * to 0.
   */
  resetCount() {
    this.#clickCount = 0;
    this.#timerID = null;
  }

  get enabled() {
    return this.#enabled;
  }

  get #container() {
    if (!this.#containerCache) {
      let doc = this.#window.document;
      let template = doc.getElementById("historyCarouselPanel");
      template.replaceWith(template.content);
      this.#containerCache = doc.getElementById("historycarousel-container");
    }
    return this.#containerCache;
  }

  #getOrCreateCarouselBrowser() {
    const BROWSER_ID = "historycarousel-browser";
    let browser = this.#container.querySelector(`#${BROWSER_ID}`);
    if (!browser) {
      browser = this.#window.document.createXULElement("browser");
      browser.setAttribute("id", BROWSER_ID);
      browser.setAttribute("disablehistory", "true");
      browser.setAttribute("autoscroll", "false");
      browser.setAttribute("disablefullscreen", "true");
      browser.setAttribute("flex", "1");
      browser.setAttribute("message", "true");
      browser.setAttribute("remoteType", "privilegedabout");
      browser.setAttribute("remote", "true");
      browser.setAttribute("src", "about:blank");
      browser.setAttribute("type", "content");
      this.#container.appendChild(browser);
    }

    return browser;
  }

  /**
   * Sets up or tears down the history carousel for the current window.
   *
   * @param {Boolean} shouldShow
   *   True if the carousel should be shown.
   * @returns {Promise}
   * @resolves {undefined}
   *   Resolves once the state has been entered (or if we're already in the
   *   selected state).
   */
  async showHistoryCarousel(shouldShow) {
    if (this.#enabled == shouldShow) {
      return;
    }

    logConsole.debug("Show history carousel: ", shouldShow);

    if (this.#window.top.gGlobalHistory.views.length <= 1) {
      throw new Error(
        "Cannot enter history carousel mode without multiple views"
      );
    }

    let gBrowser = this.#window.gBrowser;
    let carouselBrowser = this.#getOrCreateCarouselBrowser();

    this.#notify("HistoryCarousel:TransitionStart");

    if (shouldShow) {
      this.#enabled = shouldShow;
      logConsole.debug(
        "Navigating history carousel browser to about:historycarousel"
      );
      carouselBrowser.loadURI("about:historycarousel", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      // If this is the first time we've bound the <browser> to the DOM, then the
      // docShell is active by default, despite being invisible (since the container
      // is still hidden). We deactivate it here so that we can activate it in the
      // same step as making its container visible. Activating the docShell causes
      // the visibilitystatechange event to fire in the underlying document which
      // is what kicks off the initial animation.
      this.#window.document.body.setAttribute("historycarousel", "loading");
      this.#container.hidden = false;
      carouselBrowser.docShellIsActive = false;
      carouselBrowser.renderLayers = true;

      logConsole.debug("Waiting for history carousel browser to be ready");

      // To reduce flicker, we'll wait until:
      // 1. the underlying history carousel <browser> has reported that its ready
      // 2. the compositor has reported that its received the displaylist
      //
      // before proceeding.
      let composited = await new Promise(resolve => {
        carouselBrowser.addEventListener("MozLayerTreeReady", resolve, {
          once: true,
        });
      });
      let ready = await new Promise(resolve => {
        this.#window.addEventListener("HistoryCarousel:Ready", resolve, {
          once: true,
        });
      });
      await Promise.all([composited, ready]);
      // Finally, we'll wait until we've completed the next paint and composite
      // on the whole window before doing the switch.
      let lastTransactionId = this.#window.windowUtils.lastTransactionId;
      await new Promise(resolve => {
        let listener = event => {
          if (event.transactionId > lastTransactionId) {
            this.#window.removeEventListener("MozAfterPaint", listener);
            resolve();
          }
        };
        this.#window.addEventListener("MozAfterPaint", listener);
      });

      this.#window.document.body.setAttribute("historycarousel", "ready");

      logConsole.debug(
        "History carousel browser is ready. Making visible and focusing."
      );
      carouselBrowser.focus();

      for (let backgroundTab of gBrowser.tabs) {
        backgroundTab.linkedBrowser.enterModalState();
      }

      carouselBrowser.docShellIsActive = true;
    } else {
      let actor = carouselBrowser.browsingContext.currentWindowGlobal.getActor(
        "HistoryCarousel"
      );
      let finalIndex = await actor.sendQuery("Exit");
      logConsole.debug("Got back final index: ", finalIndex);

      this.#notify("HistoryCarousel:Exit", { finalIndex });

      this.#enabled = shouldShow;

      for (let backgroundTab of gBrowser.tabs) {
        backgroundTab.linkedBrowser.leaveModalState();
      }

      this.#window.document.body.removeAttribute("historycarousel");
      this.#container.hidden = true;

      logConsole.debug("Destroying history carousel browser.");
      carouselBrowser.remove();
    }

    this.#notify("HistoryCarousel:TransitionEnd");
  }

  #notify(eventType, detail = {}) {
    this.#window.dispatchEvent(
      new this.#window.CustomEvent(eventType, { bubbles: true, detail })
    );
  }
}

/**
 * HistoryCarouselParent acts as a mediator between an about:historycarousel
 * page and the GlobalHistory instance in the associated window.
 */
class HistoryCarouselParent extends JSWindowActorParent {
  // We hold a reference to GlobalHistory because accessing the browsingContext
  // embedderElement won't work in didDestroy.
  #globalHistory;
  #historyCarousel;

  actorCreated() {
    let window = this.browsingContext.embedderElement.ownerGlobal;
    this.#globalHistory = window.gGlobalHistory;
    this.#historyCarousel = window.gHistoryCarousel;
    this.#globalHistory.addEventListener("ViewChanged", this);
  }

  didDestroy() {
    this.#globalHistory.removeEventListener("ViewChanged", this);
  }

  /**
   * Handles GlobalHistory ViewChanged events so that the carousel
   * can then select the appropriate index to match.
   *
   * @param {GlobalHistoryEvent} event
   *   The ViewChanged GlobalHistoryEvent indicating a change of
   *   View selection in the parent process.
   */
  handleEvent(event) {
    if (event.type == "ViewChanged") {
      let index = this.#globalHistory.views.indexOf(event.view);
      this.sendAsyncMessage("SelectIndex", { index });
    }
  }

  /**
   * Handles messages sent by the HistoryCarouselChild, and passes
   * them along to the GlobalHistory instance for the current window.
   *
   * @param {Object} message
   *   The message received from the HistoryCarouselChild.
   */
  async receiveMessage(message) {
    let browser = this.browsingContext.top.embedderElement;
    let window = browser.ownerGlobal;

    switch (message.name) {
      // The empty carousel has loaded, so we now populate it with enough
      // information to render the currently selected View.
      case "Init": {
        return this.#globalHistory.getInitialHistoryCarouselData();
      }
      // The currently selected View has had its image populated, meaning we're
      // ready to switch the carousel <browser> to the foreground. Dispatches a
      // custom HistoryCarousel:Ready event so that GlobalHistory can do the
      // switch.
      case "Ready": {
        browser.dispatchEvent(
          new window.CustomEvent("HistoryCarousel:Ready", {
            bubbles: true,
          })
        );
        break;
      }
      // The HistoryCarouselChild has requested preview image data for a
      // particular index.
      case "GetPreview": {
        return this.#globalHistory.getHistoryCarouselDataForIndex(
          message.data.index
        );
      }
      // The HistoryCarouselChild has received a user input event requesting
      // that it exit.
      case "RequestExit": {
        return this.#historyCarousel.showHistoryCarousel(false);
      }
      // The selection inside of the carousel has changed.
      case "SetVisibleIndex": {
        let view = this.#globalHistory.views[message.data.index];
        this.#globalHistory.setView(view);
        break;
      }
    }

    return null;
  }
}
