/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* Ensures that the companion can be opened. */
add_task(async function test_open_companion() {
  let helper = new CompanionHelper();
  await helper.closeCompanion();

  let companionBrowser = document.getElementById("companion-browser");

  helper.openCompanion();

  ok(
    BrowserTestUtils.is_visible(companionBrowser),
    "Companion browser should be visible"
  );

  info("waiting for the companion to initialize");
  await helper.companionReady;

  is(
    document
      .getElementById("Browser:ToggleCompanion")
      .getAttribute("aria-pressed"),
    "true",
    "The aria-pressed value is set to 'true' when the companion is open"
  );

  await helper.runCompanionTask(() => {
    ok(
      content.document.querySelector(".companion-main"),
      "The companion content is available"
    );

    let deckContent = content.document.querySelector("#now-content");
    ok(
      deckContent.childElementCount,
      "The companion contents have been populated"
    );
  });
});

/* Ensures that focus is maintained after hitting back button */
add_task(async function test_focus_on_back() {
  await CompanionHelper.whenReady(async helper => {
    info("Navigating to companion browse menu");
    await helper.selectCompanionTab("browse");

    await helper.openBrowseSubmenu("sessions", true);

    await helper.runCompanionTask(async () => {
      const backBtn = await ContentTaskUtils.waitForCondition(() => {
        return content.document
          .querySelector("section-panel")
          .shadowRoot.querySelector(".back-button");
      });
      ok(backBtn, "Found back button");
      await ContentTaskUtils.waitForCondition(() => {
        return getFocusedElement() == backBtn;
      });
      is(
        getFocusedElement(),
        backBtn,
        "The back button is focused after navigating to browse submenu"
      );
      // Test that other keypresses such as Tab don't trigger the back button (MR2-2875)
      EventUtils.synthesizeKey("VK_TAB", {}, content);
      EventUtils.synthesizeKey("VK_TAB", { shiftKey: true }, content);
      is(
        getFocusedElement(),
        backBtn,
        "The back button is focused again after tabbing away and tabbing back"
      );
      let browsePanelShown = ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      info("Click the back button once");
      EventUtils.synthesizeKey("KEY_Enter", {}, content);
      await browsePanelShown;
      const sessionsBtn = content.document.querySelector(
        `.browse button.sessions`
      );
      function getFocusedElement() {
        let element = content.document.activeElement;
        const getShadowRootFocus = e => {
          if (e.shadowRoot) {
            return getShadowRootFocus(e.shadowRoot.activeElement);
          }
          return e;
        };
        return getShadowRootFocus(element);
      }
      is(
        getFocusedElement(),
        sessionsBtn,
        "The correct item is focused after going back to browse list"
      );
    });
    // Reset the companion's state
    await helper.reload();
  });
});
