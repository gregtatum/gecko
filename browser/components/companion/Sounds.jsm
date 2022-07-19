/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["Sounds"];

const Sounds = {
  STARTUP: "chrome://browser/content/companion/begin.wav",
  SET_ASIDE: "chrome://browser/content/companion/setaside.wav",

  get soundsEnabled() {
    return (
      Services.prefs.getBoolPref("browser.pinebuild.sounds") &&
      !Cu.isInAutomation
    );
  },

  play(url) {
    if (!this._soundService) {
      this._soundService = Cc["@mozilla.org/sound;1"].getService(Ci.nsISound);
    }
    if (this.soundsEnabled) {
      this._soundService.play(Services.io.newURI(url));
    }
  },
};
