// Utility functions for offline tests.
var Cc = SpecialPowers.Cc;
var Ci = SpecialPowers.Ci;
var Cu = SpecialPowers.Cu;
var LoadContextInfo = Cu.import("resource://gre/modules/LoadContextInfo.jsm", {}).LoadContextInfo;

const kNetBase = 2152398848; // 0x804B0000
var NS_ERROR_CACHE_KEY_NOT_FOUND = kNetBase + 61;
var NS_ERROR_CACHE_KEY_WAIT_FOR_VALIDATION = kNetBase + 64;

// Reading the contents of multiple cache entries asynchronously
function OfflineCacheContents(urls) {
  this.urls = urls;
  this.contents = {};
}

OfflineCacheContents.prototype = {
QueryInterface: function(iid) {
    if (!iid.equals(Ci.nsISupports) &&
        !iid.equals(Ci.nsICacheListener)) {
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },
onCacheEntryAvailable: function(desc, accessGranted, status) {
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

    if (!desc) {
      this.fetch(this.callback);
      return;
    }

    var stream = desc.QueryInterface(Ci.nsICacheEntryDescriptor).openInputStream(0);
    var sstream = SpecialPowers.Cc["@mozilla.org/scriptableinputstream;1"]
                 .createInstance(SpecialPowers.Ci.nsIScriptableInputStream);
    sstream.init(stream);
    this.contents[desc.key] = sstream.read(sstream.available());
    sstream.close();
    desc.close();
    this.fetch(this.callback);
  },

fetch: function(callback)
{
  this.callback = callback;
  if (this.urls.length == 0) {
    callback(this.contents);
    return;
  }

  var url = this.urls.shift();
  var self = this;

  var cacheSession = OfflineTest.getActiveSession();
  cacheSession.asyncOpenCacheEntry(url, Ci.nsICache.ACCESS_READ, this);
}
};

var OfflineTest = {

_allowedByDefault: false,

_hasSlave: false,

// The window where test results should be sent.
_masterWindow: null,

// Array of all PUT overrides on the server
_pathOverrides: [],

// SJSs whom state was changed to be reverted on teardown
_SJSsStated: [],

setupChild: function()
{
  if (this._allowedByDefault) {
    this._masterWindow = window;
    return true;
  }

  if (window.parent.OfflineTest._hasSlave) {
    return false;
  }

  this._masterWindow = window.top;

  return true;
},

/**
 * Setup the tests.  This will reload the current page in a new window
 * if necessary.
 *
 * @return boolean Whether this window is the slave window
 *                 to actually run the test in.
 */
setup: function()
{
  netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

  var prefBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
  try {
    this._allowedByDefault = prefBranch.getBoolPref("offline-apps.allow_by_default");
  } catch (e) {}

  if (this._allowedByDefault) {
    this._masterWindow = window;

    return true;
  }

  if (!window.opener || !window.opener.OfflineTest ||
      !window.opener.OfflineTest._hasSlave) {
    // Offline applications must be toplevel windows and have the
    // offline-app permission.  Because we were loaded without the
    // offline-app permission and (probably) in an iframe, we need to
    // enable the pref and spawn a new window to perform the actual
    // tests.  It will use this window to report successes and
    // failures.
    var pm = Cc["@mozilla.org/permissionmanager;1"]
      .getService(Ci.nsIPermissionManager);
    var uri = Cc["@mozilla.org/network/io-service;1"]
      .getService(Ci.nsIIOService)
      .newURI(window.location.href, null, null);
    var principal = SpecialPowers.Cc["@mozilla.org/scriptsecuritymanager;1"]
                      .getService(Ci.nsIScriptSecurityManager)
                      .getNoAppCodebasePrincipal(uri);

    if (pm.testPermissionFromPrincipal(principal, "offline-app") != 0) {
      ok(false, "Previous test failed to clear offline-app permission!  Expect failures.");
    }
    pm.addFromPrincipal(principal, "offline-app", Ci.nsIPermissionManager.ALLOW_ACTION);

    // Tests must run as toplevel windows.  Open a slave window to run
    // the test.
    this._hasSlave = true;
    window.open(window.location, "offlinetest");

    return false;
  }

  this._masterWindow = window.opener;

  return true;
},

teardownAndFinish: function()
{
  this.teardown(function(self) { self.finish(); });
},

teardown: function(callback)
{
  // First wait for any pending scheduled updates to finish
  this.waitForUpdates(function(self) {
    // Remove the offline-app permission we gave ourselves.

    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

    var pm = Cc["@mozilla.org/permissionmanager;1"]
             .getService(Ci.nsIPermissionManager);
    var uri = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService)
              .newURI(window.location.href, null, null);
    var principal = SpecialPowers.Cc["@mozilla.org/scriptsecuritymanager;1"]
                      .getService(Ci.nsIScriptSecurityManager)
                      .getNoAppCodebasePrincipal(uri);

    pm.removeFromPrincipal(principal, "offline-app");

    // Clear all overrides on the server
    for (override in self._pathOverrides)
      self.deleteData(self._pathOverrides[override]);
    for (statedSJS in self._SJSsStated)
      self.setSJSState(self._SJSsStated[statedSJS], "");

    self.clear();
    callback(self);
  });
},

finish: function()
{
  if (this._allowedByDefault) {
    SimpleTest.executeSoon(SimpleTest.finish);
  } else if (this._masterWindow) {
    // Slave window: pass control back to master window, close itself.
    this._masterWindow.SimpleTest.executeSoon(this._masterWindow.OfflineTest.finish);
    window.close();
  } else {
    // Master window: finish test.
    SimpleTest.finish();
  }
},

//
// Mochitest wrappers - These forward tests to the proper mochitest window.
//
ok: function(condition, name, diag)
{
  return this._masterWindow.SimpleTest.ok(condition, name, diag);
},

is: function(a, b, name)
{
  return this._masterWindow.SimpleTest.is(a, b, name);
},

isnot: function(a, b, name)
{
  return this._masterWindow.SimpleTest.isnot(a, b, name);
},

todo: function(a, name)
{
  return this._masterWindow.SimpleTest.todo(a, name);
},

clear: function()
{
  // XXX: maybe we should just wipe out the entire disk cache.
  var applicationCache = this.getActiveCache();
  if (applicationCache) {
    applicationCache.discard();
  }
},

waitForUpdates: function(callback)
{
  netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

  var self = this;
  var observer = {
    notified: false,
    observe: function(subject, topic, data) {
      if (subject) {
        subject.QueryInterface(SpecialPowers.Ci.nsIOfflineCacheUpdate);
        dump("Update of " + subject.manifestURI.spec + " finished\n");
      }

      SimpleTest.executeSoon(function() {
        if (observer.notified) {
          return;
        }

        var updateservice = SpecialPowers.Cc["@mozilla.org/offlinecacheupdate-service;1"]
                            .getService(SpecialPowers.Ci.nsIOfflineCacheUpdateService);
        var updatesPending = updateservice.numUpdates;
        if (updatesPending == 0) {
          try {
            SpecialPowers.removeObserver(observer, "offline-cache-update-completed");
          } catch(ex) {}
          dump("All pending updates done\n");
          observer.notified = true;
          callback(self);
          return;
        }

        dump("Waiting for " + updateservice.numUpdates + " update(s) to finish\n");
      });
    }
  }

  SpecialPowers.addObserver(observer, "offline-cache-update-completed", false);

  // Call now to check whether there are some updates scheduled
  observer.observe();
},

failEvent: function(e)
{
  OfflineTest.ok(false, "Unexpected event: " + e.type);
},

// The offline API as specified has no way to watch the load of a resource
// added with applicationCache.mozAdd().
waitForAdd: function(url, onFinished) {
  // Check every half second for ten seconds.
  var numChecks = 20;

  var waitForAddListener = {
    onCacheEntryAvailable: function(entry, access, status) {
      netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      if (entry) {
        entry.close();
        onFinished();
        return;
      }

      if (--numChecks == 0) {
        onFinished();
        return;
      }

      setTimeout(OfflineTest.priv(waitFunc), 500);
    }
  };

  var waitFunc = function() {
    var cacheSession = OfflineTest.getActiveSession();
    cacheSession.asyncOpenCacheEntry(url,
                                     Ci.nsICache.ACCESS_READ,
                                     waitForAddListener);
  }

  setTimeout(this.priv(waitFunc), 500);
},

manifestURL: function(overload)
{
  var manifestURLspec;
  if (overload) {
    manifestURLspec = overload;
  } else {
    var win = window;
    while (win && !win.document.documentElement.getAttribute("manifest")) {
      if (win == win.parent)
        break;
      win = win.parent;
    }
    if (win)
      manifestURLspec = win.document.documentElement.getAttribute("manifest");
  }

  var ios = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService)

  var baseURI = ios.newURI(window.location.href, null, null);
  return ios.newURI(manifestURLspec, null, baseURI);
},

loadContext: function()
{
  return SpecialPowers.wrap(window).QueryInterface(SpecialPowers.Ci.nsIInterfaceRequestor)
                                   .getInterface(SpecialPowers.Ci.nsIWebNavigation)
                                   .QueryInterface(SpecialPowers.Ci.nsIInterfaceRequestor)
                                   .getInterface(SpecialPowers.Ci.nsILoadContext);
},

loadContextInfo: function()
{
  return LoadContextInfo.fromLoadContext(this.loadContext(), false);
},

getActiveCache: function(overload)
{
  // Note that this is the current active cache in the cache stack, not the
  // one associated with this window.
  var serv = Cc["@mozilla.org/network/application-cache-service;1"]
             .getService(Ci.nsIApplicationCacheService);
  var groupID = serv.buildGroupID(this.manifestURL(overload), this.loadContextInfo());
  return serv.getActiveCache(groupID);
},

getActiveSession: function()
{
  var cache = this.getActiveCache();
  if (!cache) {
    return null;
  }

  var cacheService = Cc["@mozilla.org/network/cache-service;1"]
                     .getService(Ci.nsICacheService);
  return cacheService.createSession(cache.clientID,
                                    Ci.nsICache.STORE_OFFLINE,
                                    true);
},

priv: function(func)
{
  var self = this;
  return function() {
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
    func(arguments);
  }
},

checkCacheEntries: function(entries, callback)
{
  var checkNextEntry = function() {
    if (entries.length == 0) {
      setTimeout(OfflineTest.priv(callback), 0);
    } else {
      OfflineTest.checkCache(entries[0][0], entries[0][1], checkNextEntry);
      entries.shift();
    }
  }

  checkNextEntry();
},

checkCache: function(url, expectEntry, callback)
{
  netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  var cacheSession = this.getActiveSession();
  this._checkCache(cacheSession, url, expectEntry, callback);
},

_checkCache: function(cacheSession, url, expectEntry, callback)
{
  if (!cacheSession) {
    if (expectEntry) {
      this.ok(false, url + " should exist in the offline cache (no session)");
    } else {
      this.ok(true, url + " should not exist in the offline cache (no session)");
    }
    if (callback) setTimeout(this.priv(callback), 0);
    return;
  }

  var _checkCacheListener = {
    onCacheEntryAvailable: function(entry, access, status) {
      netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      if (entry) {
        if (expectEntry) {
          OfflineTest.ok(true, url + " should exist in the offline cache");
        } else {
          OfflineTest.ok(false, url + " should not exist in the offline cache");
        }
        entry.close();
      } else {
        if (status == NS_ERROR_CACHE_KEY_NOT_FOUND) {
          if (expectEntry) {
            OfflineTest.ok(false, url + " should exist in the offline cache");
          } else {
            OfflineTest.ok(true, url + " should not exist in the offline cache");
          }
        } else if (status == NS_ERROR_CACHE_KEY_WAIT_FOR_VALIDATION) {
          // There was a cache key that we couldn't access yet, that's good enough.
          if (expectEntry) {
            OfflineTest.ok(!mustBeValid, url + " should exist in the offline cache");
          } else {
            OfflineTest.ok(mustBeValid, url + " should not exist in the offline cache");
          }
        } else {
          OfflineTest.ok(false, "got invalid error for " + url);
        }
      }
      if (callback) setTimeout(OfflineTest.priv(callback), 0);
    }
  };

  cacheSession.asyncOpenCacheEntry(url,
                                   Ci.nsICache.ACCESS_READ,
                                   _checkCacheListener,
                                   false);
},

setSJSState: function(sjsPath, stateQuery)
{
  var client = new XMLHttpRequest();
  client.open("GET", sjsPath + "?state=" + stateQuery, false);

  var appcachechannel = SpecialPowers.wrap(client).channel.QueryInterface(Ci.nsIApplicationCacheChannel);
  appcachechannel.chooseApplicationCache = false;
  appcachechannel.inheritApplicationCache = false;
  appcachechannel.applicationCache = null;

  client.send();

  if (stateQuery == "")
    delete this._SJSsStated[sjsPath];
  else
    this._SJSsStated.push(sjsPath);
}

};
