/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the manual snapshot command.
 */

"use strict";

const TEST_URL =
  "https://example.com/browser/browser/components/companion/tests/browser/manual.html";

add_task(async function test_inner_frame() {
  let command = document.getElementById("Browser:SaveSnapshot");
  Assert.equal(
    command.getAttribute("disabled"),
    "true",
    "Command should be disabled while on blank page."
  );

  await BrowserTestUtils.withNewTab(TEST_URL, async browser => {
    Assert.ok(
      !command.hasAttribute("disabled"),
      "Command should be enabled while on a real page."
    );

    let loaded = BrowserTestUtils.browserLoaded(browser, true);

    await SpecialPowers.spawn(browser, [TEST_URL], url => {
      content.document.getElementById("frame").src = url;
    });

    await loaded;

    Assert.ok(
      !command.hasAttribute("disabled"),
      "Loading a page in an inner frame should not change the command."
    );

    loaded = BrowserTestUtils.browserLoaded(browser, true);

    await SpecialPowers.spawn(browser, [], () => {
      content.document.getElementById("frame").src = "about:blank";
    });

    await loaded;

    Assert.ok(
      !command.hasAttribute("disabled"),
      "Loading about:blank in an inner frame should not deactivate the command."
    );

    loaded = BrowserTestUtils.browserLoaded(browser, true);

    await SpecialPowers.spawn(browser, [TEST_URL], url => {
      let frame = content.document.createElement("iframe");
      frame.setAttribute("id", "frame");
      frame.setAttribute("src", url);
      content.document.body.appendChild(frame);
    });

    await loaded;

    Assert.ok(
      !command.hasAttribute("disabled"),
      "Dynamically inserting a frame should not disable the command."
    );
  });

  await BrowserTestUtils.withNewTab("about:blank", async browser => {
    Assert.equal(
      command.getAttribute("disabled"),
      "true",
      "Command should be disabled while on the blank page."
    );

    let loaded = BrowserTestUtils.browserLoaded(browser, true);

    await SpecialPowers.spawn(browser, [TEST_URL], url => {
      let frame = content.document.createElement("iframe");
      frame.setAttribute("id", "frame");
      frame.setAttribute("src", url);
      content.document.body.appendChild(frame);
    });

    await loaded;

    Assert.equal(
      command.getAttribute("disabled"),
      "true",
      "Loading a real page in an inner frame should not activate the command."
    );

    loaded = BrowserTestUtils.browserLoaded(browser, true);

    await SpecialPowers.spawn(browser, [], () => {
      content.document.getElementById("frame").src = "about:blank";
    });

    await loaded;

    Assert.equal(
      command.getAttribute("disabled"),
      "true",
      "Switching back to a blank frame should not activate the command."
    );
  });
});
