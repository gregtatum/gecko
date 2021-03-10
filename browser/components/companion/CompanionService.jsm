/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
  MuxerUnifiedComplete: "resource:///modules/UrlbarMuxerUnifiedComplete.jsm",
  UrlbarProvidersManager: "resource:///modules/UrlbarProvidersManager.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
});

class CompanionWindowMuxer extends MuxerUnifiedComplete {
  get name() {
    return "companion";
  }

  sort(queryContext) {
    super.sort(queryContext);

    let switchEntry = queryContext.results.findIndex(
      entry => entry.type == UrlbarUtils.RESULT_TYPE.TAB_SWITCH
    );

    if (switchEntry >= 0) {
      let [entry] = queryContext.results.splice(switchEntry, 1);
      queryContext.results.unshift(entry);
    }
  }
}

const CompanionService = {
  init() {
    if (this.inited) {
      return;
    }
    this.inited = true;

    UrlbarProvidersManager.registerMuxer(new CompanionWindowMuxer());
  },

  openCompanion() {
    this.init();

    let companion = Services.wm.getMostRecentWindow("Firefox:Companion");

    if (companion && !companion.closed) {
      companion.focus();
      return;
    }

    Services.ww.openWindow(
      null,
      "chrome://browser/content/companion/companion.xhtml",
      "_blank",
      "chrome,all,dialog=no,resizable=yes,toolbar=yes",
      null
    );
  },

  closeCompanion() {
    let companion = Services.wm.getMostRecentWindow("Firefox:Companion");
    if (companion && !companion.closed) {
      companion.close();
    }
  },
};
