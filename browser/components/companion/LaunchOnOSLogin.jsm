/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["LaunchOnOSLogin"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: "resource://gre/modules/AppConstants.jsm",
  Subprocess: "resource://gre/modules/Subprocess.jsm",
  MacAttribution: "resource:///modules/MacAttribution.jsm",
});

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

function ensureOSSettingsMatchPref() {
  var prefVal = Services.prefs.getBoolPref(PREF_LAUNCH_ON_LOGIN, false);
  if (AppConstants.platform == "win") {
    reflectPrefToRegistry(prefVal);
  } else if (AppConstants.platform == "macosx") {
    reflectPrefToLaunchDAgent(prefVal);
  }
}

async function reflectPrefToLaunchDAgent(prefVal) {
  let uid = Services.appinfo.osRealUserID;

  const label = "com.mozilla.pinebuild";
  let plistFile = Services.dirsvc.get("Home", Ci.nsIFile);
  plistFile.append("Library");
  plistFile.append("LaunchAgents");
  plistFile.append(`${label}.plist`);

  let bootout = await Subprocess.call({
    command: "/bin/launchctl",
    arguments: ["bootout", `gui/${uid}/${label}`],
    stderr: "stdout",
  });

  let { exitCode } = await bootout.wait();
  if (exitCode != 0) {
    Cu.reportError(`Failed to run /bin/launchctl bootout: ${exitCode}`);
  }

  if (prefVal) {
    const xmlEscape = s =>
      s
        .replace(/&/g, "&amp;")
        .replace(/>/g, "&gt;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    let plist = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>EnvironmentVariables</key>
  <dict>
      <key>MOZ_APP_SILENT_START</key>
      <string>1</string>
      <key>MOZ_APP_NO_DOCK</key>
      <string>1</string>
  </dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
      <string>/usr/bin/open</string>
      <string>${xmlEscape(MacAttribution.applicationPath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;

    await IOUtils.write(plistFile.path, new TextEncoder().encode(plist));

    let bootstrap = await Subprocess.call({
      command: "/bin/launchctl",
      arguments: ["bootstrap", `gui/${uid}`, plistFile.path],
      stderr: "stdout",
    });

    ({ exitCode } = await bootstrap.wait());
    if (exitCode != 0) {
      throw new Error(
        `Failed to run launchctl bootstrap: ${exitCode}`,
        Cr.NS_ERROR_UNEXPECTED
      );
    }
  } else {
    await IOUtils.remove(plistFile.path, { ignoreAbsent: true });
  }
}

function reflectPrefToRegistry(prefVal) {
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
  if (prefVal) {
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
    Services.prefs.addObserver(PREF_LAUNCH_ON_LOGIN, ensureOSSettingsMatchPref);
    ensureOSSettingsMatchPref();
  },
};
