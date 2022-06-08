/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContentTaskUtils } = ChromeUtils.import(
  "resource://testing-common/ContentTaskUtils.jsm"
);

// MR2-2662: Remove this function and use the passwordmgr/test/browser/head.js version instead
async function openACPopup(
  popup,
  browser,
  inputSelector,
  iframeBrowsingContext = null
) {
  let promiseShown = BrowserTestUtils.waitForEvent(popup, "popupshown");

  await SimpleTest.promiseFocus(browser);
  info("content window focused");

  // Focus the username field to open the popup.
  let target = iframeBrowsingContext || browser;
  await SpecialPowers.spawn(
    target,
    [[inputSelector]],
    function openAutocomplete(sel) {
      content.document.querySelector(sel).focus();
    }
  );
  let shown = await promiseShown;
  ok(shown, "autocomplete popup shown");
  return shown;
}

const TEST_URL =
  "https://example.com/browser/browser/components/companion/tests/browser/loginForm.html";

add_task(async function test_view_saved_logins_navigates_to_companion() {
  await LoginTestUtils.addLogin({
    username: "username",
    password: "password",
  });
  await LoginTestUtils.addLogin({
    username: "username2",
    password: "password2",
  });
  let showPasswordMessage = TestUtils.topicObserved(
    "companion-show-passwords-panel"
  );
  await CompanionHelper.whenReady(async helper => {
    let passwordsShown = helper.runCompanionTask(async () => {
      let namedDeck = content.document.querySelector("named-deck");
      is(namedDeck.selectedViewName, "now", `The default deck view is "now"`);
      await ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      is(
        namedDeck.selectedViewName,
        "passwords",
        `Named deck view changed to "passwords"`
      );
    });

    await BrowserTestUtils.withNewTab(
      {
        gBrowser,
        url: TEST_URL,
      },
      async browser => {
        const popup = document.getElementById("PopupAutoComplete");
        ok(popup, "Got popup");
        await openACPopup(popup, browser, "#form-basic-username");

        let footer = popup.querySelector(`[originaltype="loginsFooter"]`);
        ok(footer, "Got footer richlistitem");

        await TestUtils.waitForCondition(() => {
          return !EventUtils.isHidden(footer);
        }, "Waiting for footer to become visible");

        // Checking that keyboard navigation behavior works correctly
        await EventUtils.synthesizeKey("KEY_ArrowDown");
        await EventUtils.synthesizeKey("KEY_ArrowDown");
        await EventUtils.synthesizeKey("KEY_ArrowDown");
        await EventUtils.synthesizeKey("KEY_Enter");

        await showPasswordMessage;
        await passwordsShown;
        // The browse view and Passwords panel should be visible at this point
      }
    );
    await helper.reload();
    LoginTestUtils.clearData();
  });
});
