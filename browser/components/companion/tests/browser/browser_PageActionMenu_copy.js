/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL1 = "https://example.com/";
/**
 * Tests copying the URL via the toolbar button.
 */
add_task(async function test_PageActionMenu_copy() {
  await PinebuildTestUtils.loadViews([TEST_URL1]);
  let viewGroups = PinebuildTestUtils.getViewGroups(window);
  Assert.equal(viewGroups.length, 1, "There should be one total ViewGroups");
  let pam = await PinebuildTestUtils.openPageActionMenu(viewGroups[0]);
  let copyButton = pam.querySelector("#page-action-copy-url");

  let pamClosed = BrowserTestUtils.waitForEvent(pam, "popuphidden");
  EventUtils.synthesizeMouseAtCenter(copyButton, {}, window);
  await pamClosed;

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
    TEST_URL1,
    "Should have copied the correct url value"
  );
});
