/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function once(target, event) {
  return new Promise(done => {
    target.addEventListener(event, done, { once: true });
  });
}

add_task(async function testHidesWindowWhenTaskTrayIconClicked() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.launchOnOSLogin.enabledForTesting", true]],
  });
  const PINEBUILD_BACKGROUND_UI =
    "chrome://browser/content/companion/pinebuildBackground.xhtml";
  let features = "chrome,titlebar=no,alwaysontop,minimizable=yes";
  let win = Services.ww.openWindow(
    null,
    PINEBUILD_BACKGROUND_UI,
    "_blank",
    features,
    []
  );
  let baseWin = win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
  Assert.equal(
    baseWin.visibility,
    false,
    "Window should be hidden on creation."
  );

  // At each section here we set the visibility to true and ensure our handler sets it back.
  baseWin.visibility = true;
  await once(win, "load");
  let menupopup = win.document.querySelector(
    "#pinebuildBackground-menu > menupopup"
  );
  Assert.equal(
    baseWin.visibility,
    false,
    "Window should be hidden after first load."
  );

  baseWin.visibility = true;
  let popupshowingPromise = once(win, "popupshowing");
  menupopup.openPopup();
  await popupshowingPromise;
  Assert.equal(
    baseWin.visibility,
    false,
    "Window should be hidden after showing the menupopup."
  );

  // We just hide the popup here to not leave it lying around.
  let popuphiddenPromise = once(win, "popuphidden");
  menupopup.hidePopup();
  await popuphiddenPromise;

  let systemstatusbarclickPromise = once(win, "systemstatusbarclick");
  baseWin.visibility = true;
  win.dispatchEvent(new CustomEvent("systemstatusbarclick"));
  await systemstatusbarclickPromise;
  Assert.equal(
    baseWin.visibility,
    false,
    "Window should be hidden after a systemstatusbarclick event."
  );

  win.close();
});
