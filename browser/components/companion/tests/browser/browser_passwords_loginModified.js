/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
 * There was a bug where a login modified event which was
 * dispatched in the background, as a result of the login's
 * usage counter being incremented upon using the login on
 * its associated website, caused the Companion about:logins
 * to break. This test verifies that if a login modified event
 * is dispatched, the user should be automatically returned to
 * the login list view if they were in the login edit view, in
 * order to avoid the breakage.
 */
add_task(async function testCreateLogin() {
  let LOGIN_TO_UPDATE = new nsLoginInfo(
    "https://example.com",
    "https://example.com",
    null,
    "user2",
    "pass2"
  );
  LOGIN_TO_UPDATE = Services.logins.addLogin(LOGIN_TO_UPDATE);
  const LOGIN_OBJ = LoginHelper.loginToVanillaObject(LOGIN_TO_UPDATE);
  const LOGIN_UPDATES = {
    origin: "https://example.com",
    password: "my1GoodPassword",
    username: "user1",
  };

  await CompanionHelper.whenReady(async helper => {
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(
      async (LOGIN_OBJ_INTERIOR, LOGIN_UPDATES_INTERIOR) => {
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

        await SpecialPowers.spawn(
          passwordsBrowser,
          [[LOGIN_OBJ_INTERIOR, LOGIN_UPDATES_INTERIOR]],
          async ([loginToUpdate, loginUpdates]) => {
            // Wait until the login list is visible.
            let loginList;
            await ContentTaskUtils.waitForCondition(() => {
              loginList = content.document.querySelector("login-list");
              return loginList.shadowRoot;
            }, "waiting for loginList to get created");
            ok(loginList, "Got loginList");
            let createButton = loginList.shadowRoot.querySelector(
              ".create-login-button"
            );

            // Create a new login, to verify that one is present to edit.
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

            // Save the new login, return to the login list.
            let loginListShown = ContentTaskUtils.waitForCondition(() => {
              return ContentTaskUtils.is_visible(loginList);
            });
            let saveChangesButton = loginItem.shadowRoot.querySelector(
              ".save-changes-button"
            );
            info("clicking on 'Save' button");
            saveChangesButton.click();
            await loginListShown;

            // Check that the newly-created login is in the list.
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

            // Enter edit mode so that we can check that we're correctly
            // kicked out of it later.
            info("Enter edit mode for new login");
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

            info("The login list shouldn't be visible now");
            ok(
              ContentTaskUtils.is_hidden(loginList),
              "The login list is hidden"
            );

            info("The login item should be visible");
            ok(
              ContentTaskUtils.is_visible(loginItem),
              "The login item is visible"
            );

            info("Dispatching the login modified event");
            const updateEvent = Cu.cloneInto(
              {
                bubbles: true,
                detail: Object.assign(
                  { guid: loginToUpdate.guid },
                  loginUpdates
                ),
              },
              content
            );

            content.dispatchEvent(
              new content.CustomEvent("AboutLoginsUpdateLogin", updateEvent)
            );

            // We should be kicked out of edit mode, back to the login list.
            // The data-editing property should be removed, and the login
            // item component should no longer be visible.
            await ContentTaskUtils.waitForCondition(() => {
              return !loginItem.hasAttribute("data-editing");
            }, "Waiting for login-item to exit edit mode");

            info("The login item shouldn't be visible now");
            ok(
              ContentTaskUtils.is_hidden(loginItem),
              "The login item is hidden"
            );

            info("The login list should be visible");
            ok(
              ContentTaskUtils.is_visible(loginList),
              "The login list is visible"
            );
          }
        );
      },
      [LOGIN_OBJ, LOGIN_UPDATES]
    );
  });
});
