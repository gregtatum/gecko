/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL1 = "https://example.com/browser/";
const TEST_URL2 = "https://example.org/";
const TEST_URL3 = "https://example.com/";
const TEST_URL4 = "https://example.com/browser/browser/";
const TEST_URL5 = "http://mochi.test:8888/";

const DEFAULT_WORKSPACE_ID = 0;

function assertTabUrls(win, urls) {
  let tabUrls = win.gBrowser.browsers.map(b => b.currentURI.spec);
  Assert.deepEqual(tabUrls, urls);
}

function assertLazyBrowsers(win, laziness) {
  let browsersLazy = win.gBrowser.browsers.map(b => !b.browsingContext);
  Assert.deepEqual(browsersLazy, laziness);
}

function waitForLazyBrowserLoad(browser) {
  return new Promise(resolve => {
    browser.ownerGlobal.gBrowser.getTabForBrowser(browser).addEventListener(
      "TabBrowserInserted",
      () => {
        resolve(BrowserTestUtils.browserLoaded(browser));
      },
      { once: true }
    );
  });
}

/* Verify that the river functions correctly after a session restore */
add_task(async function testSessionRestore() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let { gBrowser, gStageManager } = win;

  let windowState = {
    extData: {
      GlobalHistoryState: JSON.stringify([
        { id: 2, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
        { id: 3, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
        { id: 4, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
        {
          id: 5,
          cachedEntry: { ID: 5, url: TEST_URL5 },
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
        { id: 1, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
      ]),
    },
    tabs: [
      {
        entries: [
          {
            ID: 1,
            url: TEST_URL1,
          },
        ],
        index: 1,
      },
      {
        entries: [
          {
            ID: 2,
            url: TEST_URL2,
          },
          {
            ID: 3,
            url: TEST_URL3,
          },
        ],
        index: 1,
      },
      {
        entries: [
          {
            ID: 4,
            url: TEST_URL4,
          },
        ],
        index: 1,
      },
    ],
    selected: 1,
  };

  // Restore our session data
  let promiseRestored = BrowserTestUtils.waitForEvent(win, "SSWindowRestored");

  // The restore will insert a single browser that we must wait to finish loading.
  let tabLoadPromise = new Promise(resolve => {
    gBrowser.tabContainer.addEventListener(
      "TabBrowserInserted",
      ({ target: tab }) => {
        resolve(BrowserTestUtils.browserLoaded(tab.linkedBrowser));
      },
      { once: true }
    );
  });

  SessionStore.setWindowState(win, { windows: [windowState] }, true);
  await Promise.all([promiseRestored, tabLoadPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, true, true]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[0]);
  Assert.equal(gStageManager.currentView, gStageManager.views[4]);

  // Change to a view in a lazy browser. Can't use the browser loaded event here
  // as it isn't a real browser yet.
  let viewPromise = BrowserTestUtils.waitForEvent(gStageManager, "ViewChanged");
  let loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[1]);
  gStageManager.setView(gStageManager.views[1]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, true]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[1]);
  Assert.equal(gStageManager.currentView, gStageManager.views[1]);

  // Change to a view in a different history position in the browser.
  loadPromise = BrowserTestUtils.browserLoaded(gBrowser.browsers[1]);
  gStageManager.setView(gStageManager.views[0]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, true]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[1]);
  Assert.equal(gStageManager.currentView, gStageManager.views[0]);

  // Change to a view in another lazy browser.
  loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[2]);
  viewPromise = BrowserTestUtils.waitForEvent(gStageManager, "ViewChanged");
  gStageManager.setView(gStageManager.views[2]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[2]);
  Assert.equal(gStageManager.currentView, gStageManager.views[2]);

  // Discard a browser
  let discardPromise = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabBrowserDiscarded"
  );
  gBrowser.discardBrowser(gBrowser.tabs[0]);
  await discardPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [true, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[2]);
  Assert.equal(gStageManager.currentView, gStageManager.views[2]);

  // Recreate it.
  loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[0]);
  viewPromise = BrowserTestUtils.waitForEvent(gStageManager, "ViewChanged");
  gStageManager.setView(gStageManager.views[4]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[0]);
  Assert.equal(gStageManager.currentView, gStageManager.views[4]);

  // Simulate history expiration
  loadPromise = BrowserTestUtils.waitForContentEvent(
    gBrowser.browsers[1],
    "pageshow"
  );
  gStageManager.setView(gStageManager.views[1]);
  await loadPromise;

  Assert.equal(gBrowser.browsers[1].browsingContext.sessionHistory.count, 2);
  gBrowser.browsers[1].browsingContext.sessionHistory.purgeHistory(1);
  Assert.equal(gBrowser.browsers[1].browsingContext.sessionHistory.count, 1);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4]);

  let state = SessionStore.getWindowState(win);
  let ghState = JSON.parse(state.windows[0].extData.GlobalHistoryState);
  Assert.notEqual(ghState[0].cachedEntry, null);

  // Recreate the missing history entry
  loadPromise = BrowserTestUtils.waitForNewTab(gBrowser);
  gStageManager.setView(gStageManager.views[0]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4, TEST_URL2]);
  assertLazyBrowsers(win, [false, false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[3]);
  Assert.equal(gStageManager.currentView, gStageManager.views[0]);

  // Browse to a view that never existed
  loadPromise = BrowserTestUtils.waitForNewTab(gBrowser);
  gStageManager.setView(gStageManager.views[3]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4, TEST_URL2, TEST_URL5]);
  assertLazyBrowsers(win, [false, false, false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[4]);
  Assert.equal(gStageManager.currentView, gStageManager.views[3]);

  await BrowserTestUtils.closeWindow(win);
});

/**
 * Tests that persisting a session that hasn't changed since its last
 * restoration persists properly.
 */
add_task(async function testSessionRestoreNoChange() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let { gBrowser, gStageManager } = win;

  let [view1] = await PinebuildTestUtils.loadViews([TEST_URL1], win);

  PinebuildTestUtils.assertUrlsAre([TEST_URL1], win);
  assertTabUrls(win, [TEST_URL1]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[0]);
  Assert.equal(gStageManager.currentView, view1);

  let guid = await PinebuildTestUtils.setAsideSession(win);
  Assert.ok(guid, "A session was successfully started and stored.");

  let result = await SessionManager.query({ guid, includePages: true });
  Assert.equal(result.length, 1);
  Assert.equal(result[0].pages.length, 1);

  await PinebuildTestUtils.restoreSession(guid, win);

  result = await SessionManager.query({ guid, includePages: true });
  Assert.equal(result.length, 1);
  Assert.equal(result[0].pages.length, 1);

  await PinebuildTestUtils.setAsideSession(win);

  result = await SessionManager.query({ guid, includePages: true });
  Assert.equal(result.length, 1);
  Assert.equal(result[0].pages.length, 1);

  await BrowserTestUtils.closeWindow(win);
});

/**
 * Tests that setting aside a session and then navigating doesn't cause
 * the about:flow-reset page to appear in the AVM.
 */
add_task(async function testSessionSetAsideNoFlowReset() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let { gStageManager } = win;

  await PinebuildTestUtils.loadViews([TEST_URL1], win);

  let guid = await PinebuildTestUtils.setAsideSession(win);
  Assert.ok(guid, "A session was started and stored.");

  let [view2] = await PinebuildTestUtils.loadViews([TEST_URL2], win);

  Assert.equal(gStageManager.views.length, 1, "Should only be 1 View");
  console.log(gStageManager.views);
  Assert.equal(gStageManager.currentView, view2, "Should be looking at View 2");

  let viewGroups = await PinebuildTestUtils.getViewGroups(win);
  Assert.equal(viewGroups.length, 1, "Should only be 1 ViewGroup");
  Assert.equal(
    viewGroups[0].viewGroup.length,
    1,
    "Should only be 1 View in the ViewGroup"
  );
  Assert.equal(
    viewGroups[0].lastView,
    view2,
    "The view in the ViewGroup should be view2"
  );

  await BrowserTestUtils.closeWindow(win);
});

/**
 * Tests that we map Views to the correct <browser> elements after
 * restoration if the Views have cachedEntry's belong to a lazy-loaded
 * <browser>. This is so that new <browser>'s don't get created upon
 * selection.
 */
add_task(async function testSessionRestoreLazyNoExtraBrowsers() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let { gStageManager } = win;

  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews(
    [TEST_URL1, TEST_URL2, TEST_URL3, TEST_URL4],
    win
  );

  Assert.equal(win.gBrowser.browsers.length, 1);

  // Now we have to load a second <browser> so that upon restoration,
  // the first one will lazy-load.
  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL5);
  let view5 = gStageManager.currentView;
  Assert.equal(win.gBrowser.browsers.length, 2);

  PinebuildTestUtils.assertViewsAre([view1, view2, view3, view4, view5], win);

  // Okay, now set aside and restore this session twice in a row, to make sure
  // that all Views associated with the first <browser> are in the cached state.
  let guid = await PinebuildTestUtils.setAsideSession(win);
  await PinebuildTestUtils.restoreSession(guid, win);
  await PinebuildTestUtils.setAsideSession(win);
  await PinebuildTestUtils.restoreSession(guid, win);

  let views = win.gStageManager.views;
  // Loading the very first View should cause the SessionHistory to
  // be restored, which we need to wait for in order for the subsequent
  // navigations to work properly.
  let firstView = views.shift();
  let browserRestored = BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );
  await PinebuildTestUtils.setCurrentView(firstView, win);
  await browserRestored;

  for (let view of views) {
    await PinebuildTestUtils.setCurrentView(view, win);
  }

  Assert.equal(
    win.gBrowser.browsers.length,
    2,
    "Should still only have 2 <browser> elements."
  );

  await BrowserTestUtils.closeWindow(win);
});

/**
 * Tests that we can set aside and restore Pinned Views and Pinned
 * Apps.
 */
add_task(async function testSessionRestorePinnedViewsAndApps() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let { gStageManager } = win;

  // We'll first load some TEST_URLs that belong to the same origin in
  // the same <browser>. These are the ones we'll pin as an app.
  //
  // It gets a little confusing here because the view numbers don't match
  // up with the TEST_URL numbers, but that's okay - the numbers don't need
  // to match up here.
  let [view1, view2] = await PinebuildTestUtils.loadViews(
    [TEST_URL1, TEST_URL3],
    win
  );

  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL2);
  let view3 = gStageManager.currentView;
  let [view4] = await PinebuildTestUtils.loadViews([TEST_URL5], win);

  PinebuildTestUtils.assertViewsAre([view1, view2, view3, view4], win);
  // Pinning view1 should also pin view2 since they belong to the same <browser>
  // and ViewGroup.
  gStageManager.setViewPinnedState(view1, true, true /* appMode */);
  gStageManager.setViewPinnedState(view3, true, false /* appMode */);

  let viewGroupEls = await PinebuildTestUtils.getPinnedViewGroups(win);
  Assert.equal(viewGroupEls.length, 2, "There should be two pinned ViewGroups");
  Assert.ok(!viewGroupEls[0].viewGroup.isApp, "Pinned View should be first.");
  Assert.equal(
    viewGroupEls[0].viewGroup.length,
    1,
    "Only one View should exist in the Pinned View ViewGroup"
  );
  Assert.equal(viewGroupEls[0].viewGroup.lastView, view3);

  Assert.ok(viewGroupEls[1].viewGroup.isApp, "Pinned App should be second.");
  Assert.equal(
    viewGroupEls[1].viewGroup.length,
    2,
    "Two Views should exist in the Pinned App ViewGroup"
  );
  Assert.equal(viewGroupEls[1].viewGroup.at(0), view1);
  Assert.equal(viewGroupEls[1].viewGroup.at(1), view2);

  let guid = await PinebuildTestUtils.setAsideSession(win);
  await PinebuildTestUtils.restoreSession(guid, win);

  // Setting aside and restoring the views has made our original view
  // variables obsolete, so we get at the restored Views now.
  let views = gStageManager.views;
  viewGroupEls = await PinebuildTestUtils.getPinnedViewGroups(win);
  Assert.equal(
    viewGroupEls.length,
    2,
    "There should still be two pinned ViewGroups"
  );
  Assert.ok(
    !viewGroupEls[0].viewGroup.isApp,
    "Pinned View should still be first."
  );
  Assert.equal(
    viewGroupEls[0].viewGroup.length,
    1,
    "Only one View should still exist in the Pinned View ViewGroup"
  );
  Assert.equal(viewGroupEls[0].viewGroup.lastView, views[0]);

  Assert.ok(
    viewGroupEls[1].viewGroup.isApp,
    "Pinned App should still be second."
  );
  Assert.equal(
    viewGroupEls[1].viewGroup.length,
    2,
    "Two Views should still exist in the Pinned App ViewGroup"
  );
  Assert.equal(viewGroupEls[1].viewGroup.at(0), views[1]);
  Assert.equal(viewGroupEls[1].viewGroup.at(1), views[2]);

  // Finally, make sure that the Pinned Apps and Pinned Views can be selected
  // after restoration.
  //
  // We'll start by trying to load the Pinned App. Note that we need
  // to wait for the SSTabRestored event to fire for the underlying
  // browser after the first load in order to stage the other View
  // in that ViewGroup.
  let browserRestored = BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );
  await PinebuildTestUtils.setCurrentView(views[1], win);
  await browserRestored;
  await PinebuildTestUtils.setCurrentView(views[2], win);

  // The underlying <browser> for the Pinned View is shared with the
  // one in the River, which was staged at the time of restoration,
  // so we don't need to wait for its SSTabRestored event.
  await PinebuildTestUtils.setCurrentView(views[0], win);
  await PinebuildTestUtils.setCurrentView(views[3], win);

  await BrowserTestUtils.closeWindow(win);
});
