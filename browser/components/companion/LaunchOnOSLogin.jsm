/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["LaunchOnOSLogin"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

XPCOMUtils.defineLazyGetter(this, "gBrandBundle", function() {
  return Services.strings.createBundle(
    "chrome://branding/locale/brand.properties"
  );
});

const PREF_LAUNCH_ON_LOGIN = "browser.startup.launchOnOSLogin";

// Returns a nsIFile to the firefox.exe (really, application) executable file.
function getFirefoxExecutableFile() {
  return Services.dirsvc.get("XREExeF", Ci.nsIFile);
}

function reflectPrefToRegistry() {
  const reg = Cc["@mozilla.org/windows-registry-key;1"].createInstance(
    Ci.nsIWindowsRegKey
  );
  reg.create(
    Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
    Ci.nsIWindowsRegKey.ACCESS_ALL
  );

  // From MSDN: "Each key has a name consisting of one or more printable characters.
  // Key names are not case sensitive. Key names cannot include the backslash character
  // (\), but any other printable character can be used. Value names and data can
  // include the backslash character."
  // We assume we're not including unprintable characters in our brandShortName.
  const brandShortName = gBrandBundle
    .GetStringFromName("brandShortName")
    .replaceAll("\\", "");
  if (Services.prefs.getBoolPref(PREF_LAUNCH_ON_LOGIN, false)) {
    reg.writeStringValue(
      brandShortName,
      `"${getFirefoxExecutableFile().path}" -silentmode`
    );
  } else {
    try {
      reg.removeValue(brandShortName);
    } catch (e) {} // Do nothing if the value does not exist
  }
}

const LaunchOnOSLogin = {
  init() {
    // Currently this is only implemented for Windows
    if (AppConstants.platform != "win") {
      return;
    }
    Services.prefs.addObserver(PREF_LAUNCH_ON_LOGIN, reflectPrefToRegistry);
    reflectPrefToRegistry();
  },
};
