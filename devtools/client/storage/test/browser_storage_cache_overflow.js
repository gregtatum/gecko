/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Test endless scrolling when a lot of items are present in the storage
// inspector table for Cache storage.
"use strict";

const ITEMS_PER_PAGE = 50;

add_task(async function() {
  await openTabAndSetupStorage(
    URL_ROOT_COM_SSL + "storage-cache-overflow.html"
  );

  gUI.tree.expandAll();

  await selectTreeItem(["Cache", "https://example.com", "lorem"]);
  checkCellLength(ITEMS_PER_PAGE);

  await scroll();
  checkCellLength(ITEMS_PER_PAGE * 2);

  info("Close Toolbox");
  await gDevTools.closeToolboxForTab(gBrowser.selectedTab);
});
