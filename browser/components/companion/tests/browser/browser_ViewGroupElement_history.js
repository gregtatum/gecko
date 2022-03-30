/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This set of tests exercises the ViewGroupElement component. It tries to do
 * so in isolation from the rest of the AVM components for speed and
 * ease of entering different states.
 */

/**
 * This class matches the interface for View from StageManager, but lets us
 * prepare it with whatever URL or title data we'd like.
 */
class FakeView {
  /**
   * Constructor for a FakeView.
   *
   * @param {string} urlString
   *   The URL for the page this FakeView should pretend to be
   *   representing.
   * @param {string} title
   *   The title for the page this FakeView should pretend to be
   *   representing.
   */
  constructor(urlString, title) {
    this.url = Services.io.newURI(urlString);
    this.title = title;
    this.iconURL = null;
    this.busy = false;
    this.securityState = Ci.nsIWebProgressListener.STATE_IS_SECURE;
    this.aboutPageType = null;
    this.muted = false;
    this.pinned = false;
    this.isArticle = false;
    this.contentPrincipal = Services.scriptSecurityManager.createContentPrincipal(
      this.url,
      {}
    );
  }
}

const PAGE_ROOT = "https://example.com/";
// We're going to be generating FakeViews, and want a way of
// telling them apart deterministically, so we use an ID that
// increments every time we create one.
let gViewID = 0;

/**
 * Returns an array of FakeViews.
 *
 * @param {number} numViews
 *   How many FakeViews to create.
 * @returns {FakeView[]}
 */
function generateGroupableViews(numViews) {
  let result = [];
  for (let i = 0; i < numViews; ++i) {
    let urlString = PAGE_ROOT + gViewID + ".html";
    result.push(new FakeView(urlString, `Page #${gViewID}`));
    gViewID++;
  }
  return result;
}

/**
 * Constructs a ViewGroupElement with some FakeViews and inserts it into
 * the DOM for testing. This utility function sets up the ViewGroupElement
 * so that it thinks it is active, and so that it suppresses the
 * UserAction:ViewSelected events if they fire so that StageManager
 * doesn't try to do anything about it. This function also handles
 * cleaning up the ViewGroupElement when the test is over.
 *
 * @param {FakeViewGroup[]} fakeViews
 *   The FakeViews to set on the ViewGroupElement.
 * @returns {ViewGroupElement}
 */
function generateViewGroupElement(fakeViewGroup) {
  let viewGroupEl = document.createElement("view-group");
  viewGroupEl.viewGroup = fakeViewGroup;
  viewGroupEl.setAttribute("exportparts", "domain, history");
  viewGroupEl.setAttribute("active", "true");
  gActiveViewManager.appendChild(viewGroupEl);
  registerCleanupFunction(() => {
    viewGroupEl.remove();
  });
  viewGroupEl.addEventListener("UserAction:ViewGroupSelected", e => {
    e.stopPropagation();
  });
  return viewGroupEl;
}

/**
 * A utility function that takes a ViewGroupElement and compares it with a string
 * that describes how the history "breadcrumbs" in the ViewGroupElement should
 * currently appear. If they do not match, a test failure is reported.
 *
 * @param {ViewGroupElement} viewGroupEl
 *   The ViewGroupElement to check.
 * @param {string} expectedAppearance
 *   The string describing how the breadcrumbs should appear.
 *   The syntax for the appearance is:
 *
 *   •     = small breadcrumb
 *   -     = medium breadcrumb
 *   ---   = large breadcrumb
 *   [---] = large selected breadcrumb
 *
 *   where each breadcrumb string is separated by a space character. This is
 *   a valid expectedAppearance:
 *
 *   "• - --- --- --- [---]"
 *
 *   so is this:
 *
 *   "[---] --- ---"
 *
 *   and this:
 *
 *   "• - [---] --- --- - •"
 */
async function assertHistoryElsAppearance(viewGroupEl, expectedAppearance) {
  await viewGroupEl.updateComplete;
  let historyEls = viewGroupEl.shadowRoot.querySelectorAll("button.history");
  let appearance = Array.from(historyEls)
    .map(historyEl => {
      switch (historyEl.getAttribute("size")) {
        case "small":
          return "•";
        case "medium":
          return "-";
        case "large":
          if (historyEl.classList.contains("active")) {
            return "[---]";
          }
          return "---";
        default:
          Assert.ok(false, "Found a history element without a size.");
          return "<NOTHING>";
      }
    })
    .join(" ");

  Assert.equal(
    appearance,
    expectedAppearance,
    "History should be represented correctly."
  );
}

/**
 * Tests some shorter ViewGroupElements with 5 Views within them have their
 * history represented correctly.
 */
add_task(async function test_ViewGroupElement_short_history() {
  const NUM_FAKE_VIEWS = 5;
  let fakeViews = generateGroupableViews(NUM_FAKE_VIEWS);
  let viewGroupEl = generateViewGroupElement(fakeViews);

  // Let's start by making the last view the active one.
  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- --- [---]");

  // Let's work our way back through the history, as if the user
  // was hitting the back button.
  viewGroupEl.activeView = fakeViews.at(-2);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- [---] ---");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-3);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- [---] --- ---");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- ---");

  // Back another time - we're at the start now.
  viewGroupEl.activeView = fakeViews.at(-5);
  await assertHistoryElsAppearance(viewGroupEl, "[---] --- --- --- ---");

  // Okay, now let's work our way forward. This behaves the same as moving
  // backwards, just in the opposite direction.

  // Forward once
  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- ---");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-3);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- [---] --- ---");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-2);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- [---] ---");

  // Forward another time - we're at the end now.
  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- --- [---]");

  // Now just some hopping around
  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- ---");

  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- --- [---]");

  viewGroupEl.activeView = fakeViews.at(-5);
  await assertHistoryElsAppearance(viewGroupEl, "[---] --- --- --- ---");

  viewGroupEl.activeView = fakeViews.at(-3);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- [---] --- ---");
});

/**
 * Tests a larger ViewGroupElement with 9 Views within them, to test the overflow
 * behaviour, and what happens when we move through those items linearly.
 */
add_task(async function test_ViewGroupElement_long_history_linear() {
  const NUM_FAKE_VIEWS = 9;
  let fakeViews = generateGroupableViews(NUM_FAKE_VIEWS);
  let viewGroupEl = generateViewGroupElement(fakeViews);

  // Let's start by making the last view the active one.
  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- --- [---]");

  // Let's work our way back through the history, as if the user
  // was hitting the back button.
  viewGroupEl.activeView = fakeViews.at(-2);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] ---");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-3);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- [---] --- ---");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "• - [---] --- --- ---");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-5);
  await assertHistoryElsAppearance(viewGroupEl, "• - [---] --- --- - •");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-6);
  await assertHistoryElsAppearance(viewGroupEl, "• - [---] --- --- - •");

  // Back another time
  viewGroupEl.activeView = fakeViews.at(-7);
  await assertHistoryElsAppearance(viewGroupEl, "• - [---] --- --- - •");

  // Back another time - we're almost at the start now.
  viewGroupEl.activeView = fakeViews.at(-8);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- - •");

  // Back another time - we're at the start now.
  viewGroupEl.activeView = fakeViews.at(-9);
  await assertHistoryElsAppearance(viewGroupEl, "[---] --- --- --- - •");

  // Okay, now let's work our way forward. This behaves the same as moving
  // backwards, just in the opposite direction.

  // Forward once
  viewGroupEl.activeView = fakeViews.at(-8);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- - •");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-7);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- [---] --- - •");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-6);
  await assertHistoryElsAppearance(viewGroupEl, "--- --- --- [---] - •");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-5);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] - •");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] - •");

  // Forward another time
  viewGroupEl.activeView = fakeViews.at(-3);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] - •");

  // Forward another time - we're almost at the end now.
  viewGroupEl.activeView = fakeViews.at(-2);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] ---");

  // Forward another time - we're almost at the end now.
  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- --- [---]");
});

/**
 * Tests a larger ViewGroupElement with 9 Views within them, to test the overflow
 * behaviour, and what happens when we move through those non-linearly.
 */
add_task(async function test_ViewGroupElement_long_history_hopping() {
  const NUM_FAKE_VIEWS = 9;
  let fakeViews = generateGroupableViews(NUM_FAKE_VIEWS);
  let viewGroupEl = generateViewGroupElement(fakeViews);

  // Let's start by making the last view the active one.
  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- --- [---]");

  viewGroupEl.activeView = fakeViews.at(-8);
  await assertHistoryElsAppearance(viewGroupEl, "--- [---] --- --- - •");

  viewGroupEl.activeView = fakeViews.at(-4);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- [---] - •");

  viewGroupEl.activeView = fakeViews.at(-7);
  await assertHistoryElsAppearance(viewGroupEl, "• - [---] --- --- - •");

  viewGroupEl.activeView = fakeViews.at(-9);
  await assertHistoryElsAppearance(viewGroupEl, "[---] --- --- --- - •");

  viewGroupEl.activeView = fakeViews.at(-1);
  await assertHistoryElsAppearance(viewGroupEl, "• - --- --- --- [---]");
});
