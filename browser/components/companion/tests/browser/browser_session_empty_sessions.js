/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

function assertRestoreSessionHidden(win, hidden, extraText) {
  return SpecialPowers.spawn(
    win.gBrowser.selectedBrowser,
    [hidden, extraText],
    async (isHidden, extraMsg) => {
      Assert.equal(
        content.document.getElementById("restore").hasAttribute("hidden"),
        isHidden,
        `Should${
          isHidden ? " not" : ""
        } be displaying the restore button ${extraMsg}`
      );
    }
  );
}

add_setup(async () => {
  // Ensure all sessions are deleted.
  await PlacesUtils.withConnectionWrapper("delete", async db => {
    await db.execute(`DELETE FROM moz_session_metadata`);
  });
});

add_task(async function test_session_empty_sessions() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow({
    waitForTabURL: "about:flow-reset",
  });

  await assertRestoreSessionHidden(win, true, "with no sessions");

  // Add an empty session.
  await PlacesUtils.withConnectionWrapper("empty_sessions", async db => {
    await db.execute(
      `INSERT INTO moz_session_metadata (guid, last_saved_at, data)
       VALUES(:guid, 0, "")`,
      {
        guid: SessionManager.makeGuid(),
      }
    );
  });

  // Close and open the window to "reload" about:flow-reset
  await BrowserTestUtils.closeWindow(win);
  win = await BrowserTestUtils.openNewBrowserWindow({
    waitForTabURL: "about:flow-reset",
  });

  await assertRestoreSessionHidden(win, true, "with an empty session");

  // Now visit a page to create a session.
  BrowserTestUtils.loadURI(
    win.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    "https://example.com/"
  );

  await PinebuildTestUtils.setAsideSession(win);

  await assertRestoreSessionHidden(win, false, "with a non-empty session");

  await BrowserTestUtils.closeWindow(win);
});
