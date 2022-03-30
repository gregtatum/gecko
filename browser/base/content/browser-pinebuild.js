/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/browser-window */

XPCOMUtils.defineLazyModuleGetters(this, {
  HistoryCarousel: "resource:///actors/HistoryCarouselParent.jsm",
});

XPCOMUtils.defineLazyGetter(this, "gHistoryCarousel", () => {
  return new HistoryCarousel(window);
});

var PineBuildUIUtils = {
  init() {
    window.addEventListener("deactivate", this);
    Services.els.addSystemEventListener(document, "keydown", this, false);

    window.addEventListener(
      "unload",
      () => {
        // Clear any pending saves for this window on close, as it'll get
        // saved via the close window handlers.
        SessionManager.clearSessionSave(window);
        window.removeEventListener("deactivate", this);
      },
      { once: true }
    );
  },

  delayedStartup() {
    window.top.gHistoryCarousel.init();
    this.setupKeyboardOverrides();

    if (!Services.prefs.getBoolPref("browser.pinebuild.workspaces.enabled")) {
      let cmd = document.getElementById("Browser:StartNewWorkspace");
      cmd.hidden = true;
    }
  },

  copy(anchor, string) {
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(string);
    anchor.ownerGlobal.ConfirmationHint.show(anchor, "copyURL");
  },

  setupKeyboardOverrides() {
    let backKey = document.getElementById("goBackKb");
    let fwdKey = document.getElementById("goForwardKb");
    let backKey2 = document.getElementById("goBackKb2");
    let fwdKey2 = document.getElementById("goForwardKb2");

    for (let keyEl of [backKey, fwdKey, backKey2, fwdKey2]) {
      if (!keyEl) {
        continue;
      }

      keyEl.removeAttribute("command");
      keyEl.setAttribute(
        "oncommand",
        "gHistoryCarousel.showHistoryCarousel(true);"
      );
    }
  },

  // A Set containing the currently displayed notifications so we can avoid
  // showing duplicates.
  activeNotifications: new Set(),
  // A promise that is set when the notifications start hiding and is resolved
  // when that animation completes.
  hideNotificationsPromise: null,
  // The AbortSignalController stored so we can remove the event listeners.
  notificationAbortController: null,
  // The timer for hiding the notifications.
  notificationTimer: null,
  // How long notifications show for.
  NOTIFICATION_LENGTH: 5000,

  /**
   * Shows a toast notification for a short period before hiding.
   *
   * @param {object} opts
   *    Object containing the options to show a notification, including the
   *    domElement to be shown.
   */
  showToastNotification(opts) {
    // If we try to show a notification while the notification panel
    // is hiding, wait till its hidden then reshow it.
    if (this.hideNotificationsPromise) {
      this.hideNotificationsPromise.then(() =>
        this.showToastNotification(opts)
      );
    }

    let startHideNotificationTimer = () => {
      this.notificationTimer = this._delayDOMChange(
        () => this.hideNotifications(),
        this.NOTIFICATION_LENGTH
      );
    };

    // A notification with the same id is currently beings shown
    if (this.activeNotifications.has(opts.id)) {
      clearTimeout(this.notificationTimer);
      startHideNotificationTimer();
      return;
    }

    this.activeNotifications.add(opts.id);

    const XUL_NS =
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let container = document.createElementNS(XUL_NS, "html:div");

    container.classList.add("toast-notification");
    container.addEventListener("click", () => {
      clearTimeout(this.notificationTimer);
      this.hideNotifications();
      opts.onSelect();
    });
    container.appendChild(opts.domElement);

    let toasts = document.getElementById("companion-toast");
    toasts.appendChild(container);

    if (toasts.classList.contains("show")) {
      return;
    }

    this.notificationAbortController = new AbortController();
    // Don't hide the toast notifications while the use is hovering
    // over them.
    toasts.addEventListener(
      "mouseenter",
      () => {
        clearTimeout(this.notificationTimer);
      },
      { signal: this.notificationAbortController.signal }
    );
    toasts.addEventListener(
      "mouseleave",
      () => {
        startHideNotificationTimer();
      },
      { signal: this.notificationAbortController.signal }
    );

    toasts.classList.add("show");
    startHideNotificationTimer();
  },

  hideNotifications() {
    this.hideNotificationsPromise = new Promise(resolve => {
      let toasts = document.getElementById("companion-toast");
      this.notificationAbortController.abort();

      let done = () => {
        toasts.replaceChildren();
        this.activeNotifications.clear();
        this.hideNotificationsPromise = null;
        resolve();
      };

      if (window.matchMedia("(prefers-reduced-motion)").matches) {
        done();
      } else {
        toasts.addEventListener("transitionend", done, { once: true });
      }

      toasts.classList.remove("show");
    });
  },

  /**
   * Delays a change for the specified timeout, and waits for an animation
   * frame.
   *
   * @param {function} cb
   *   Called when the delay is complete and an animation frame obtained.
   * @param {number} timeout
   *   The number of milliseconds to delay the change for.
   */
  _delayDOMChange(cb, timeout) {
    return setTimeout(() => requestAnimationFrame(cb), timeout);
  },

  handleEvent(event) {
    switch (event.type) {
      case "deactivate": {
        if (!window.closed) {
          SessionManager.queueSessionSave(window);
        }
        break;
      }
      case "keydown": {
        this.onKeyDown(event);
        break;
      }
    }
  },

  onKeyDown(event) {
    let action = ShortcutUtils.getSystemActionForEvent(event);
    switch (action) {
      case ShortcutUtils.CYCLE_TABS: {
        if (event.shiftKey) {
          gStageManager.goBack();
        } else {
          gStageManager.goForward();
        }
        event.preventDefault();
        break;
      }
      case ShortcutUtils.CLOSE_TAB: {
        gStageManager.closeCurrentView();
        event.preventDefault();
        break;
      }
      case ShortcutUtils.NEXT_TAB: {
        gStageManager.goForward();
        event.preventDefault();
        break;
      }
      case ShortcutUtils.PREVIOUS_TAB: {
        gStageManager.goBack();
        event.preventDefault();
        break;
      }
    }
  },
};

PineBuildUIUtils.init();
