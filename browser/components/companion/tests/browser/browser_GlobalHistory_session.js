/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL1 = "https://example.com/browser/";
const TEST_URL2 = "https://example.org/";
const TEST_URL3 = "https://example.com/";
const TEST_URL4 = "https://example.com/browser/browser/";
const TEST_URL5 = "http://mochi.test:8888/";

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
  let { gBrowser, gGlobalHistory } = win;

  let windowState = {
    extData: {
      GlobalHistoryState: JSON.stringify([
        { id: 2, cachedEntry: null },
        { id: 3, cachedEntry: null },
        { id: 4, cachedEntry: null },
        { id: 5, cachedEntry: { ID: 5, url: TEST_URL5 } },
        { id: 1, cachedEntry: null },
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
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[4]);

  // Change to a view in a lazy browser. Can't use the browser loaded event here
  // as it isn't a real browser yet.
  let viewPromise = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewChanged"
  );
  let loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[1]);
  gGlobalHistory.setView(gGlobalHistory.views[1]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, true]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[1]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[1]);

  // Change to a view in a different history position in the browser.
  loadPromise = BrowserTestUtils.browserLoaded(gBrowser.browsers[1]);
  gGlobalHistory.setView(gGlobalHistory.views[0]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, true]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[1]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[0]);

  // Change to a view in another lazy browser.
  loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[2]);
  viewPromise = BrowserTestUtils.waitForEvent(gGlobalHistory, "ViewChanged");
  gGlobalHistory.setView(gGlobalHistory.views[2]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[2]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[2]);

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
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[2]);

  // Recreate it.
  loadPromise = waitForLazyBrowserLoad(gBrowser.browsers[0]);
  viewPromise = BrowserTestUtils.waitForEvent(gGlobalHistory, "ViewChanged");
  gGlobalHistory.setView(gGlobalHistory.views[4]);
  await Promise.all([loadPromise, viewPromise]);

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL2, TEST_URL4]);
  assertLazyBrowsers(win, [false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[0]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[4]);

  // Simulate history expiration
  loadPromise = BrowserTestUtils.waitForContentEvent(
    gBrowser.browsers[1],
    "pageshow"
  );
  gGlobalHistory.setView(gGlobalHistory.views[1]);
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
  gGlobalHistory.setView(gGlobalHistory.views[0]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4, TEST_URL2]);
  assertLazyBrowsers(win, [false, false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[3]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[0]);

  // Browse to a view that never existed
  loadPromise = BrowserTestUtils.waitForNewTab(gBrowser);
  gGlobalHistory.setView(gGlobalHistory.views[3]);
  await loadPromise;

  PinebuildTestUtils.assertUrlsAre(
    [TEST_URL2, TEST_URL3, TEST_URL4, TEST_URL5, TEST_URL1],
    win
  );
  assertTabUrls(win, [TEST_URL1, TEST_URL3, TEST_URL4, TEST_URL2, TEST_URL5]);
  assertLazyBrowsers(win, [false, false, false, false, false]);
  Assert.equal(gBrowser.selectedBrowser, gBrowser.browsers[4]);
  Assert.equal(gGlobalHistory.currentView, gGlobalHistory.views[3]);

  await BrowserTestUtils.closeWindow(win);
});
