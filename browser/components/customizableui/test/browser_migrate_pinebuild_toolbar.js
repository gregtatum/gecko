/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const kPrefCustomizationState = "browser.uiCustomization.state";
const kPrefPinebuildToolbarVersion = "browser.pinebuild.toolbar.version";

// TODO bug 1745810: Remove the use of ChromeUtils.import(..., null).
// eslint-disable-next-line mozilla/reject-chromeutils-import-params
let CustomizableUIBSPass = ChromeUtils.import(
  "resource:///modules/CustomizableUI.jsm",
  null
);
let { CustomizableUIInternal } = CustomizableUIBSPass;

add_setup(async function() {
  const oldMigrationValue = Services.prefs.getIntPref(
    kPrefPinebuildToolbarVersion,
    0
  );
  const oldState = CustomizableUIBSPass.gSavedState;
  registerCleanupFunction(() => {
    Services.prefs.setIntPref(kPrefPinebuildToolbarVersion, oldMigrationValue);
    CustomizableUIBSPass.gSavedState = oldState;
  });

  Services.prefs.setIntPref(kPrefPinebuildToolbarVersion, 0);
});

// Tests migrations in CustomizableUI._updateForNewPinebuildVersion.
add_task(async function migration1() {
  // Test MR2-1571: the customization pref is in a bad state where
  // pinebuild-toolbar is in the wrong place.
  CustomizableUIBSPass.gSavedState = {
    currentVersion: 6,
    placements: {
      "nav-bar": ["urlbar-container", "pinebuild-toolbar"],
    },
  };
  CustomizableUIInternal._updateForNewPinebuildVersion();

  Assert.greater(
    Services.prefs.getIntPref(kPrefPinebuildToolbarVersion, 0),
    0,
    "Migration version incremented"
  );
  const navbarPlacements =
    CustomizableUIBSPass.gSavedState.placements["nav-bar"];
  Assert.equal(
    navbarPlacements.indexOf("pinebuild-toolbar"),
    0,
    "pinebuild-toolbar is the first item in the toolbar."
  );
});
