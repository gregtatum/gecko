/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function setup() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  const dialogBox = win.gDialogBox;
  const closedPromise = dialogBox.open(
    "chrome://browser/content/companion/onboarding.html"
  );
  await dialogBox._dialog._dialogReady;
  Assert.ok(dialogBox.isOpen);

  const dialog = win.document.getElementById("window-modal-dialog");
  const onboardingDoc = dialog.querySelector("browser").contentDocument;
  const dismissButton = onboardingDoc.querySelector("#dismiss");
  const okButton = onboardingDoc.querySelector("#ok");

  return {
    closedPromise,
    dialog,
    dialogBox,
    dismissButton,
    okButton,
    onboardingDoc,
    win,
  };
}

add_task(async function test_dismiss_is_clickable() {
  const { closedPromise, dialogBox, dismissButton } = await setup();

  dismissButton.click();

  await closedPromise;
  Assert.ok(!dialogBox.isOpen);
});

add_task(async function test_ok_is_clickable() {
  const { closedPromise, dialogBox, okButton } = await setup();

  okButton.click();

  await closedPromise;
  Assert.ok(!dialogBox.isOpen);
});

add_task(async function test_dismiss_enter_key() {
  const {
    closedPromise,
    dialogBox,
    dismissButton,
    onboardingDoc,
    win,
  } = await setup();
  dismissButton.focus();
  Assert.equal(dismissButton, onboardingDoc.activeElement);

  EventUtils.synthesizeKey("KEY_Enter", {}, win);

  await closedPromise;
  Assert.ok(!dialogBox.isOpen);
});

add_task(async function test_ok_enter_key() {
  const {
    closedPromise,
    dialogBox,
    okButton,
    onboardingDoc,
    win,
  } = await setup();
  okButton.focus();
  Assert.equal(okButton, onboardingDoc.activeElement);

  EventUtils.synthesizeKey("KEY_Enter", {}, win);

  await closedPromise;
  Assert.ok(!dialogBox.isOpen);
});
