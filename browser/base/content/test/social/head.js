/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Promise",
  "resource://gre/modules/commonjs/sdk/core/promise.js");
XPCOMUtils.defineLazyModuleGetter(this, "Task",
  "resource://gre/modules/Task.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");

function waitForCondition(condition, nextTest, errorMsg) {
  var tries = 0;
  var interval = setInterval(function() {
    if (tries >= 30) {
      ok(false, errorMsg);
      moveOn();
    }
    if (condition()) {
      moveOn();
    }
    tries++;
  }, 100);
  var moveOn = function() { clearInterval(interval); nextTest(); };
}

// Check that a specified (string) URL hasn't been "remembered" (ie, is not
// in history, will not appear in about:newtab or auto-complete, etc.)
function promiseSocialUrlNotRemembered(url) {
  let deferred = Promise.defer();
  let uri = Services.io.newURI(url, null, null);
  PlacesUtils.asyncHistory.isURIVisited(uri, function(aURI, aIsVisited) {
    ok(!aIsVisited, "social URL " + url + " should not be in global history");
    deferred.resolve();
  });
  return deferred.promise;
}

let gURLsNotRemembered = [];

function runSocialTestWithProvider(manifest, callback) {
  let SocialService = Cu.import("resource://gre/modules/SocialService.jsm", {}).SocialService;

  let manifests = Array.isArray(manifest) ? manifest : [manifest];

  // Check that none of the provider's content ends up in history.
  function finishCleanUp() {
    for (let i = 0; i < manifests.length; i++) {
      let m = manifests[i];
      for (let what of ['sidebarURL', 'workerURL', 'iconURL']) {
        if (m[what]) {
          yield promiseSocialUrlNotRemembered(m[what]);
        }
      };
    }
    for (let i = 0; i < gURLsNotRemembered.length; i++) {
      yield promiseSocialUrlNotRemembered(gURLsNotRemembered[i]);
    }
    gURLsNotRemembered = [];
  }

  info("runSocialTestWithProvider: " + manifests.toSource());

  let finishCount = 0;
  function finishIfDone(callFinish) {
    finishCount++;
    if (finishCount == manifests.length)
      Task.spawn(finishCleanUp).then(finish);
  }
  function removeAddedProviders(cleanup) {
    manifests.forEach(function (m) {
      // If we're "cleaning up", don't call finish when done.
      let callback = cleanup ? function () {} : finishIfDone;
      // Similarly, if we're cleaning up, catch exceptions from removeProvider
      let removeProvider = SocialService.removeProvider.bind(SocialService);
      if (cleanup) {
        removeProvider = function (origin, cb) {
          try {
            SocialService.removeProvider(origin, cb);
          } catch (ex) {
            // Ignore "provider doesn't exist" errors.
            if (ex.message == "SocialService.removeProvider: no provider with this origin exists!")
              return;
            info("Failed to clean up provider " + origin + ": " + ex);
          }
        }
      }
      removeProvider(m.origin, callback);
    });
  }

  let providersAdded = 0;
  let firstProvider;

  manifests.forEach(function (m) {
    SocialService.addProvider(m, function(provider) {
      provider.active = true;

      providersAdded++;
      info("runSocialTestWithProvider: provider added");

      // we want to set the first specified provider as the UI's provider
      if (provider.origin == manifests[0].origin) {
        firstProvider = provider;
      }

      // If we've added all the providers we need, call the callback to start
      // the tests (and give it a callback it can call to finish them)
      if (providersAdded == manifests.length) {
        // Set the UI's provider and enable the feature
        Social.provider = firstProvider;
        Social.enabled = true;

        function finishSocialTest(cleanup) {
          // disable social before removing the providers to avoid providers
          // being activated immediately before we get around to removing it.
          Services.prefs.clearUserPref("social.enabled");
          removeAddedProviders(cleanup);
        }
        registerCleanupFunction(function () {
          finishSocialTest(true);
        });
        callback(finishSocialTest);
      }
    });
  });
}

function runSocialTests(tests, cbPreTest, cbPostTest, cbFinish) {
  let testIter = Iterator(tests);

  if (cbPreTest === undefined) {
    cbPreTest = function(cb) {cb()};
  }
  if (cbPostTest === undefined) {
    cbPostTest = function(cb) {cb()};
  }

  function runNextTest() {
    let name, func;
    try {
      [name, func] = testIter.next();
    } catch (err if err instanceof StopIteration) {
      // out of items:
      (cbFinish || finish)();
      return;
    }
    // We run on a timeout as the frameworker also makes use of timeouts, so
    // this helps keep the debug messages sane.
    executeSoon(function() {
      function cleanupAndRunNextTest() {
        info("sub-test " + name + " complete");
        cbPostTest(runNextTest);
      }
      cbPreTest(function() {
        info("sub-test " + name + " starting");
        try {
          func.call(tests, cleanupAndRunNextTest);
        } catch (ex) {
          ok(false, "sub-test " + name + " failed: " + ex.toString() +"\n"+ex.stack);
          cleanupAndRunNextTest();
        }
      })
    });
  }
  runNextTest();
}

// A fairly large hammer which checks all aspects of the SocialUI for
// internal consistency.
function checkSocialUI(win) {
  let win = win || window;
  let doc = win.document;
  let provider = Social.provider;
  let enabled = win.SocialUI.enabled;
  function isbool(a, b, msg) {
    is(!!a, !!b, msg);
  }
  isbool(win.SocialSidebar.canShow, enabled, "social sidebar active?");
  if (enabled)
    isbool(win.SocialSidebar.opened, enabled, "social sidebar open?");
  isbool(win.SocialChatBar.isAvailable, enabled && Social.haveLoggedInUser(), "chatbar available?");
  isbool(!win.SocialChatBar.chatbar.hidden, enabled && Social.haveLoggedInUser(), "chatbar visible?");
  isbool(!win.SocialShareButton.shareButton.hidden, enabled && provider.recommendInfo, "share button visible?");
  isbool(!doc.getElementById("social-toolbar-item").hidden, enabled, "toolbar items visible?");
  if (enabled)
    is(win.SocialToolbar.button.style.listStyleImage, 'url("' + provider.iconURL + '")', "toolbar button has provider icon");

  // and for good measure, check all the social commands.
  // Social:Remove - never disabled directly but parent nodes are
  isbool(!doc.getElementById("Social:Toggle").hidden, enabled, "Social:Toggle visible?");
  isbool(!doc.getElementById("Social:ToggleNotifications").hidden, enabled, "Social:ToggleNotifications visible?");
  isbool(!doc.getElementById("Social:FocusChat").hidden, enabled && Social.haveLoggedInUser(), "Social:FocusChat visible?");
  isbool(doc.getElementById("Social:FocusChat").getAttribute("disabled"), enabled ? "false" : "true", "Social:FocusChat disabled?");
  is(doc.getElementById("Social:SharePage").getAttribute("disabled"), enabled && provider.recommendInfo ? "false" : "true", "Social:SharePage visible?");

  // broadcasters.
  isbool(!doc.getElementById("socialActiveBroadcaster").hidden, enabled, "socialActiveBroadcaster hidden?");
}
