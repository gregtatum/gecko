/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This tasks tests the following interactions with the login item
 * and the OS reauthentication prompt:
 *   Ensure that the OS reauthentication prompt appears as expected when selecting
 *   the "Edit Password" option of a login item.
 *   Ensure that cancelling the OS reauthentication prompt resets the login item
 *   back to a "non-editing" mode.
 *   Ensuring that successfully authenticating through the OS reauthentication prompt
 *   and then cancelling the edit action via "cancel" button returns the login item
 *   back to a "non-editing" mode.
 */
add_task(async function test_edit_login_and_os_auth_prompt_interactions() {
  if (!OSKeyStoreTestUtils.canTestOSKeyStoreLogin()) {
    ok(
      true,
      `skipping test since oskeystore cannot be automated in this environment`
    );
    return;
  }

  registerCleanupFunction(function() {
    LoginTestUtils.clearData();
  });
  SpecialPowers.pushPrefEnv({
    set: [["signon.management.page.os-auth.enabled", true]],
  });

  let username = "username";
  let password = "password";
  await LoginTestUtils.addLogin({ username, password });

  // Show OS auth dialog when "Edit Password" is selected on a login item and cancel the prompt.
  let osAuthDialogShown = OSKeyStoreTestUtils.waitForOSKeyStoreLogin(false);
  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await helper.selectCompanionTab("browse");
    // Activate the passwords option in the browse view
    await helper.runCompanionTask(async () => {
      let passwordsEntry = content.document.querySelector(".passwords");
      let passwordsShown = ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      passwordsEntry.click();
      await passwordsShown;
    });

    // We need to wait for the xul:browser that loads the passwords frame
    // to load.
    await BrowserTestUtils.browserLoaded(helper.browser, true);

    // Navigate to the login item and click the "Edit" option of the login item
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
        let editButton = panelList.querySelector(".edit");
        ok(editButton, "Got edit button");
        editButton.click();
      });
    });
  });
  // Wait until the OS authentication dialog appears and cancel the prompt.
  await osAuthDialogShown;
  // Assert that the login-list is not in an "editing" state
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
        }, "waiting for loginList to be selected");
        ok(loginList, "Got loginList");
        ok(
          !loginList.classList.contains("editing"),
          "List should not be in edit mode after cancelling OS authentication prompt"
        );
      });
    });
  });
  // Show OS auth dialog when "Edit Password" is selected on a login item
  // and successfully authenticate.
  osAuthDialogShown = OSKeyStoreTestUtils.waitForOSKeyStoreLogin(true);
  await CompanionHelper.whenReady(async helper => {
    // Navigate to the login item and click the "Edit" option of the login item
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
        let editButton = panelList.querySelector(".edit");
        ok(editButton, "Got edit button");
        editButton.click();
      });
    });
  });
  // Wait until the OS authentication dialog appears and successfully authenticate the prompt.
  await osAuthDialogShown;
  // Assert that the login-list is in an "editing" state
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
        }, "waiting for loginList to be selected");
        ok(loginList, "Got loginList");
        ok(
          loginList.classList.contains("editing"),
          "List should be in edit mode after successfully authenticating via OS auth prompt"
        );
        let loginItem;
        await ContentTaskUtils.waitForCondition(() => {
          loginItem = content.document.querySelector("login-item");
          return loginItem.shadowRoot;
        });
        // Click the cancel button of the edit screen
        loginItem.shadowRoot.querySelector(".cancel-button").click();
        ok(
          !loginList.classList.contains("editing"),
          "List should not be in edit mode after cancelling the edit operation"
        );
      });
    });
  });

  LoginTestUtils.clearData();
  await SpecialPowers.popPrefEnv();
});
