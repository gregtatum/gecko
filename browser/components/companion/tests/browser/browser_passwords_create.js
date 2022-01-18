/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function testCreateLogin() {
  await CompanionHelper.whenReady(async helper => {
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
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
        await ContentTaskUtils.waitForCondition(() => {
          loginList = content.document.querySelector("login-list");
          return loginList.shadowRoot;
        }, "waiting for loginList to get created");
        ok(loginList, "Got loginList");
        let createButton = loginList.shadowRoot.querySelector(
          ".create-login-button"
        );

        let loginItem = content.document.querySelector("login-item");
        ok(loginItem, "Got login-item");
        let createLoginFormShown = ContentTaskUtils.waitForCondition(() => {
          return loginItem.hasAttribute("data-is-new-login");
        });
        createButton.click();
        await createLoginFormShown;

        info("login form shown, filling it in");
        let originField = loginItem.shadowRoot.querySelector(
          "input[name='origin']"
        );
        originField.value = "https://example.com";
        let usernameField = loginItem.shadowRoot.querySelector(
          "input[name='username']"
        );
        usernameField.value = "test";
        let passwordField = loginItem.shadowRoot.querySelector(
          "input[name='password']"
        );
        passwordField.value = "password";

        let loginListShown = ContentTaskUtils.waitForCondition(() => {
          return ContentTaskUtils.is_visible(loginList);
        });
        let saveChangesButton = loginItem.shadowRoot.querySelector(
          ".save-changes-button"
        );
        info("clicking on 'Save' button");
        saveChangesButton.click();
        await loginListShown;

        let loginListSectionItems = loginList.shadowRoot.querySelectorAll(
          ".login-list-section > li"
        );
        info("looking for new login item");
        let loginListItem = null;
        for (let item of loginListSectionItems) {
          if (
            item.querySelector(".title").textContent == "example.com" &&
            item.querySelector(".username").textContent == "test"
          ) {
            loginListItem = item;
            break;
          }
        }
        ok(loginListItem, "Newly created login is found in the list");

        // Now delete the login we just added.
        let moreDropdown = loginListItem.querySelector(".more-dropdown");
        let morePopup = moreDropdown.nextElementSibling;
        is(
          morePopup.localName,
          "panel-list",
          "The dropdown should be adjacent to the popup"
        );
        let popupIsOpen = ContentTaskUtils.waitForCondition(
          () => morePopup.hasAttribute("open"),
          "waiting for popup to open"
        );
        moreDropdown.click();
        await popupIsOpen;

        let editButton = morePopup.querySelector(".edit");
        editButton.click();

        await ContentTaskUtils.waitForCondition(() => {
          return loginItem.hasAttribute("data-editing");
        }, "Waiting for login-item to be in edit mode");

        let removeButton = loginItem.shadowRoot.querySelector(
          ".remove-login-button"
        );
        removeButton.click();

        let confirmationDialog = content.document.querySelector(
          "confirmation-dialog"
        );
        let confirmButton = confirmationDialog.shadowRoot.querySelector(
          ".confirm-button"
        );
        confirmButton.click();
      });
    });
  });
});
