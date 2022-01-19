/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
 * There was a bug involving navigating back to the main companion browse
 * menu after entering the new password creation view, and exiting without
 * saving. This test verifies that after entering the new password creation
 * view, and clicking the back button twice, the companion lands back at the
 * main companion browse menu.
 */
add_task(async function testLoginsBackButton() {
  await CompanionHelper.whenReady(async helper => {
    info("Navigating to companion browse menu");
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
      info("Looking for passwords entry in the companion browse menu");
      let passwordsEntry = content.document.querySelector(".passwords");
      ok(
        !ContentTaskUtils.is_hidden(passwordsEntry),
        "Passwords option is visible"
      );

      let passwordsShown = ContentTaskUtils.waitForEvent(
        content.document,
        "browse-panel-shown"
      );
      passwordsEntry.click();
      await passwordsShown;

      let passwordsBrowser = content.document.getElementById(
        "companion-login-browser"
      );
      await SpecialPowers.spawn(passwordsBrowser, [], async () => {
        let loginList;

        info("Looking for the login list component");
        await ContentTaskUtils.waitForCondition(() => {
          loginList = content.document.querySelector("login-list");
          return loginList.shadowRoot;
        }, "waiting for loginList to get created");
        ok(loginList, "Got login list component");

        info("Awaiting visibility of login list");
        await ContentTaskUtils.waitForCondition(() => {
          return ContentTaskUtils.is_visible(loginList);
        });

        info("Opening new login form");
        let createButton = loginList.shadowRoot.querySelector(
          ".create-login-button"
        );
        let loginItem = content.document.querySelector("login-item");
        let createLoginFormShown = ContentTaskUtils.waitForCondition(() => {
          return loginItem.hasAttribute("data-is-new-login");
        });

        ok(loginItem, "Got login-item");

        info("Click the create login button");
        createButton.click();
        await createLoginFormShown;

        info("The login list shouldn't be visible now");
        ok(ContentTaskUtils.is_hidden(loginList), "The login list is hidden");

        info("login form shown, testing back nav with no unsaved changes");
        let backButton = content.document.querySelector(".subviewbutton-back");
        ok(backButton, "Found back button");
        info("Click the back button once");
        backButton.click();

        info("wait until the login list is visible again");
        await ContentTaskUtils.waitForCondition(() => {
          return ContentTaskUtils.is_visible(loginList);
        });

        info("Looking for the login list component again");
        await ContentTaskUtils.waitForCondition(() => {
          loginList = content.document.querySelector("login-list");
          return loginList.shadowRoot;
        }, "waiting for loginList to get created again");
        ok(loginList, "Got login list component again");

        info(
          "The browse panel should be shown after clicking the back button again"
        );
        let browsePanelShown = ContentTaskUtils.waitForEvent(
          content.document,
          "browse-panel-shown"
        );
        info("Click the back button a second time");
        backButton.click();

        ok(browsePanelShown, "Made it back to the browse panel");
      });
    });
  });
});
