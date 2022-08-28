/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test to ensure ctrl-w/cmd-w will close the current
 * window if there's one or fewer view(s) in that window
 */
add_task(async function test_close_window_on_ctrl_w() {
  info("Opening new window");
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let windowClosedPromise = BrowserTestUtils.windowClosed(win);
  EventUtils.synthesizeKey("w", { accelKey: true }, win);
  await windowClosedPromise;
  is(win.closed, true, "New window was closed.");
});
