/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests copying the URL via the toolbar button.
 */
add_task(async function test_copy_via_toolbar_button() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, "https://example.com");
  await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);

  win.document.getElementById("pinebuild-copy-button").click();

  var xferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  xferable.init(this.docShell);
  xferable.addDataFlavor("text/unicode");
  Services.clipboard.getData(xferable, Ci.nsIClipboard.kGlobalClipboard);
  var data = {};
  xferable.getTransferData("text/unicode", data);

  Assert.equal(
    data.value.QueryInterface(Ci.nsISupportsString).data,
    "https://example.com/",
    "Should have copied the correct url value"
  );
});
