/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The HiddenFrame creates and owns a windowless browser. In this case, the window is
 * referring to an nsWindow, which is the OS-level widget that gets drawn to the screen,
 * not the window global in JavaScript. This browser will not be rendered to the screen,
 * hence it is a "hidden frame". `HiddenFrame.prototype.get` is the primary API, which
 * returns a `ChromeWindow` that is owned by this windowless browser. This browser
 * lives in the parent process, but it is possible to append another `<browser>` to
 * the ChromeWindow's document to create a windowless browser in another process.
 */
export class HiddenFrame {
  /**
   * @type {Promise<ChromeWindow>?}
   */
  #chromeWindow;

  /**
   * @type {nsIWindowlessBrowser?}
   */
  #windowlessBrowser;

  /**
   * If the hidden frame is still loading during destruction, the progress listener will
   * need to be removed.
   * @type {Function?}
   */
  #removeProgressListener;

  /**
   * @type {Set<HiddenFrame>?}
   */
  static #allHiddenFrames;

  /**
   * Gets the |contentWindow| of the hidden frame. Creates the frame if needed.
   * @returns {Promise<ChromeWindow>} Returns a promise which is resolved when the hidden frame has finished
   *          loading.
   */
  getChromeWindow() {
    if (!this.#chromeWindow) {
      this.#chromeWindow = this.#createChromeWindow();
    }
    return this.#chromeWindow;
  }

  /**
   * Destroy the HiddenFrame and close the windowless browser..
   */
  destroy() {
    if (this.#windowlessBrowser) {
      if (this.#removeProgressListener) {
        this.#removeProgressListener();
      }
      this.#chromeWindow = null;

      HiddenFrame.#allHiddenFrames?.delete(this);
      this.#windowlessBrowser.close();
      this.#windowlessBrowser = null;
    }
  }

  /**
   * When shutting down the frame will need to be destroyed.
   */
  #trackDestructionOnShutdown() {
    if (!HiddenFrame.#allHiddenFrames) {
      // Lazily initialize the cleanup handler for hidden frames.
      HiddenFrame.#allHiddenFrames = new Set();
      Services.obs.addObserver(function () {
        for (let hiddenFrame of HiddenFrame.#allHiddenFrames) {
          hiddenFrame.destroy();
        }
      }, "xpcom-shutdown");
    }

    HiddenFrame.#allHiddenFrames.add(this);
  }

  /**
   * Create the windowless browser, and return the ChromeWindow contained in it.
   *
   * @returns {Promise<ChromeWindow>}
   */
  #createChromeWindow() {
    return new Promise(resolve => {
      this.#trackDestructionOnShutdown();

      // Create the windowless browser in the current process.
      let chromeFlags = Ci.nsIWebBrowserChrome.CHROME_REMOTE_WINDOW;
      if (Services.appinfo.fissionAutostart) {
        chromeFlags |= Ci.nsIWebBrowserChrome.CHROME_FISSION_WINDOW;
      }
      this.#windowlessBrowser = Services.appShell.createWindowlessBrowser(
        true,
        chromeFlags
      );

      // Add a listener for the load progress to be completed.
      this.#windowlessBrowser.QueryInterface(Ci.nsIInterfaceRequestor);
      const webProgress = this.#windowlessBrowser.getInterface(
        Ci.nsIWebProgress
      );

      const listener = {
        QueryInterface: ChromeUtils.generateQI([
          "nsIWebProgressListener",
          "nsIWebProgressListener2",
          "nsISupportsWeakReference",
        ]),
        onStateChange: (_wbp, request, stateFlags, _status) => {
          if (!request) {
            return;
          }
          if (stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
            this.#removeProgressListener();
            // Get the window reference via the document.
            resolve(this.#windowlessBrowser.document.ownerGlobal);
          }
        },
      };

      this.#removeProgressListener = () => {
        webProgress.removeProgressListener(listener);
        this.#removeProgressListener = null;
      };

      webProgress.addProgressListener(
        listener,
        Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT
      );

      // Finally load the empty XUL page.
      let { docShell, browsingContext } = this.#windowlessBrowser;
      let systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
      docShell.createAboutBlankContentViewer(systemPrincipal, systemPrincipal);
      browsingContext.useGlobalHistory = false;

      this.#windowlessBrowser.loadURI(
        Services.io.newURI("chrome://global/content/win.xhtml"),
        {
          triggeringPrincipal: systemPrincipal,
        }
      );
    });
  }
}
