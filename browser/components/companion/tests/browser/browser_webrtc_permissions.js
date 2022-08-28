/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * There are a bunch of handy utilities for testing microphone and camera
 * sharing via WebRTC in browser/base/content/test/webrtc. Instead of recreating
 * all of them and their dependencies in this test directory, we import the
 * utility script in its entirety here. Unfortunately, because that script also
 * imports things that head.js imports, we hit collisions. We workaround these
 * collisions by importing the WebRTC head.js into an object, and then poking
 * global dependencies into that object.
 */
const webrtcTestUtils = {};

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/browser/base/content/test/webrtc/head.js",
  webrtcTestUtils
);

/**
 * These are the global dependencies that browser/base/content/test/webrtc/head.js
 * relies on.
 */
webrtcTestUtils.ok = ok;
webrtcTestUtils.is = is;
webrtcTestUtils.info = info;
webrtcTestUtils.executeSoon = executeSoon;
webrtcTestUtils.BrowserTestUtils = BrowserTestUtils;
webrtcTestUtils.ContentTask = ContentTask;

/**
 * These constants are defined at the top-level of the webrtc/head.js script, but
 * aren't available when we import with loadSubScript, so we redefine them here.
 */
const PREF_PERMISSION_FAKE = "media.navigator.permission.fake";
const PREF_AUDIO_LOOPBACK = "media.audio_loopback_dev";
const PREF_VIDEO_LOOPBACK = "media.video_loopback_dev";
const PREF_FAKE_STREAMS = "media.navigator.streams.fake";
const PREF_FOCUS_SOURCE = "media.getusermedia.window.focus_source.enabled";

const TEST_ROOT =
  "https://example.com/browser/browser/base/content/test/webrtc/";
const TEST_PAGE = TEST_ROOT + "get_user_media.html";

add_setup(async function() {
  let prefs = [
    [PREF_PERMISSION_FAKE, true],
    [PREF_AUDIO_LOOPBACK, ""],
    [PREF_VIDEO_LOOPBACK, ""],
    [PREF_FAKE_STREAMS, true],
    [PREF_FOCUS_SOURCE, false],
  ];
  await SpecialPowers.pushPrefEnv({ set: prefs });
});

/**
 * This is a very basic test to ensure that the Permission Panel shows
 * up anchored to the ActiveViewManager if webrtcUI.showSharingDoorhanger
 * is called. This doesn't test any actual Permission Panel behaviours,
 * since this is already tested pretty heavily in the non-pinebuild
 * configuration.
 */
add_task(async function test_permission_panel_anchored_to_avm() {
  await PinebuildTestUtils.loadViews([TEST_PAGE]);
  await webrtcTestUtils.shareDevices(
    gBrowser.selectedBrowser,
    true /* camera */,
    true /* microphone */
  );

  // We wait for the popup event on the window because the panel might
  // not actually exist yet, since it's lazily created.
  let permissionPanelPromise = BrowserTestUtils.waitForPopupEvent(
    window,
    "shown"
  );

  let activeStreams = webrtcUI.getActiveStreams(true, false, false);
  webrtcUI.showSharingDoorhanger(activeStreams[0]);

  let { target: panel } = await permissionPanelPromise;
  Assert.equal(
    panel.anchorNode,
    gActiveViewManager,
    "Permission panel should be anchored to the AVM"
  );
  let labels = panel.querySelectorAll(".permission-popup-permission-label");
  Assert.equal(labels.length, 2, "Two permissions visible in main view");

  let panelClosed = BrowserTestUtils.waitForPopupEvent(panel, "hidden");
  EventUtils.synthesizeKey("VK_ESCAPE");
  await panelClosed;
});
