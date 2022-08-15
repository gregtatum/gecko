/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_secure_website_info() {
  await gStageManager.reset();
  registerCleanupFunction(async () => {
    await gStageManager.reset();
  });
  let [view1, view2] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "http://mochi.test:8888/",
  ]);
  let viewGroups = await PinebuildTestUtils.getViewGroups(window);

  // Open up page action menu on insecure page and ensure the correct
  // security icon and text are showing
  let pageActionMenu = await PinebuildTestUtils.openPageActionMenu(
    viewGroups[1]
  );
  Assert.equal(
    pageActionMenu.querySelector("#site-security-icon").className,
    "notSecure",
    "Insecure pages show slash through the lock icon in the Page Action Menu"
  );
  Assert.equal(
    pageActionMenu
      .querySelector("#site-security-info")
      .getAttribute("data-l10n-id"),
    "identity-connection-not-secure",
    "Correct l10n id is shown on insecure pages"
  );
  await PinebuildTestUtils.closePageActionMenu(pageActionMenu);

  // Navigate to secure page and check the correct
  // security icon and text are showing.
  await PinebuildTestUtils.setCurrentView(view1);
  pageActionMenu = await PinebuildTestUtils.openPageActionMenu(viewGroups[0]);
  Assert.equal(
    pageActionMenu.querySelector("#site-security-icon").className,
    "verifiedDomain",
    "Secure pages show lock icon in the Page Action Menu"
  );
  Assert.equal(
    pageActionMenu
      .querySelector("#site-security-info")
      .getAttribute("data-l10n-id"),
    "page-action-menu-secure-page",
    "Correct l10n id is shown on secure pages"
  );
  await PinebuildTestUtils.closePageActionMenu(pageActionMenu);

  // Navigate back to insecure page and check that
  // the correct security icon and text are showing.
  // By testing this, we prevent the situation where
  // the PAM says 'this website is using a secure connection'
  // when the website is not secure due to an exception
  // that was thrown when constructing the security info. (MR2-2722)
  await PinebuildTestUtils.setCurrentView(view2);
  pageActionMenu = await PinebuildTestUtils.openPageActionMenu(viewGroups[1]);
  Assert.equal(
    pageActionMenu.querySelector("#site-security-icon").className,
    "notSecure",
    "Insecure pages show slash through the lock icon in the Page Action Menu"
  );
  Assert.equal(
    pageActionMenu
      .querySelector("#site-security-info")
      .getAttribute("data-l10n-id"),
    "identity-connection-not-secure",
    "Correct l10n id is shown on insecure pages"
  );
  await PinebuildTestUtils.closePageActionMenu(pageActionMenu);
});
