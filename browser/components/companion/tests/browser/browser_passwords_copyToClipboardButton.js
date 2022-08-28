/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const TEST_USERNAME = "test";
const TEST_PASSWORD = "password";

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["signon.management.page.os-auth.enabled", true],
      ["dom.events.testing.asyncClipboard", true],
    ],
  });
  await LoginTestUtils.addLogin({
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
  });

  registerCleanupFunction(async function() {
    await SpecialPowers.popPrefEnv();
    LoginTestUtils.clearData();
  });
});

/**
 * Navigates through the login list to find the selected login item and
 * activates the selected login item's "Copy Password" button
 * @param {CompanionHelper} helper CompanionHelper needed to run Companion tasks
 */
async function runPasswordCopyTask() {
  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(async () => {
      let passwordsBrowser = content.document.getElementById(
        "companion-login-browser"
      );
      await SpecialPowers.spawn(passwordsBrowser, [], async () => {
        let loginList;
        await ContentTaskUtils.waitForCondition(() => {
          loginList = content.document.querySelector("login-list");
          return loginList.shadowRoot;
        }, "waiting for loginList to get created");
        ok(loginList, "Got loginList");

        let loginListItem = loginList.shadowRoot.querySelector(
          ".login-list-item.selected"
        );
        ok(loginListItem, "Got loginListItem");
        let moreActionsDropdown = loginListItem.querySelector("button");
        ok(moreActionsDropdown, "Got moreActionsDropdown");
        moreActionsDropdown.click();
        let panelList = loginListItem.querySelector("panel-list");
        ok(panelList, "Got panelList");
        await ContentTaskUtils.waitForCondition(() => {
          return (
            panelList.hasAttribute("open") && !panelList.hasAttribute("showing")
          );
        }, "waiting for panelList to be open and not showing");
        let copyPassword = panelList.querySelector(".copyPassword");
        ok(copyPassword, "Got copyPassword button");
        copyPassword.click();
      });
    });
  });
}

/**
 * We want to ensure that the OS reauthentication appears as expected when
 * activating the "Copy Password" button. Additionally we want to ensure
 * that the password is successfully copied to the clipboard after a
 * successful reauthentication attempt.
 */
add_task(async function test_reauth_and_clipboard_when_copying_password() {
  if (!OSKeyStoreTestUtils.canTestOSKeyStoreLogin()) {
    info(
      `Cannot run test since copying the password of a login item requires "oskeystore" login`
    );
    ok(true); // Prevent unexpected failure in automation
    return;
  }

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await helper.selectCompanionTab("browse");
    // Activate the passwords option in the browse view
    await helper.openBrowseSubmenu("passwords", false);

    // We need to wait for the xul:browser that loads the passwords frame
    // to load.
    await BrowserTestUtils.browserLoaded(helper.browser, true);
  });
  // Set up the reauthentication observer so that the reauth prompt is successful
  let reauthObserved = OSKeyStoreTestUtils.waitForOSKeyStoreLogin(true);

  // Navigate to the login item and click the "Copy Password" option of the login item
  // as well as ensure the test password is copied to the clipboard.
  await SimpleTest.promiseClipboardChange(TEST_PASSWORD, async () => {
    await runPasswordCopyTask();
  });

  // Ensure the reauthentication process was successful
  await reauthObserved;
});

/**
 * We want to ensure that the OS reauthentication appears as expected when
 * activating the "Copy Password" button. Additionally we want to ensure
 * that the password is not copied to the clipboard after the
 * reauthentication prompt is cancelled.
 */
add_task(async function test_cancel_reauth_prompt_when_copying_password() {
  if (!OSKeyStoreTestUtils.canTestOSKeyStoreLogin()) {
    info(
      `Cannot run test since copying the password of a login item requires "oskeystore" login`
    );
    ok(true); // Prevent unexpected failure in automation
    return;
  }

  // Navigate to the "Passwords" entry in the Browse view
  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await helper.selectCompanionTab("browse");
    await helper.openBrowseSubmenu("passwords", false);

    // We need to wait for the xul:browser that loads the passwords frame
    // to load.
    await BrowserTestUtils.browserLoaded(helper.browser, true);
  });

  // Set up the reauthentication observer so that the reauth prompt is cancelled
  let reauthObserved = OSKeyStoreTestUtils.waitForOSKeyStoreLogin(false);
  // Set up the clipboard helper so we can ensure that there has been no data copied to the clipboard in an unsuccessful reauthentication
  let clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
    Ci.nsIClipboardHelper
  );
  clipboardHelper.copyString(null);
  // Navigate to the login item and click the "Copy Password" option of the login item
  await runPasswordCopyTask();

  await reauthObserved;
  // Now that the reauthentication has been observed, the test password should not be on the clipboard.
  let xferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  xferable.init(this.docShell);
  xferable.addDataFlavor("text/unicode");
  Services.clipboard.getData(xferable, Ci.nsIClipboard.kGlobalClipboard);
  let clipboardData = {};
  xferable.getTransferData("text/unicode", clipboardData);
  Assert.notEqual(
    clipboardData.value.QueryInterface(Ci.nsISupportsString).data,
    TEST_PASSWORD,
    "Clipboard should not contain the test password after an unsuccessful reauthentication"
  );
});
