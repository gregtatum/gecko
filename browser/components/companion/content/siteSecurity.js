/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.defineModuleGetter(
  globalThis,
  "NetUtil",
  "resource://gre/modules/NetUtil.jsm"
);

/**
 * Determines what security icon/strings are displayed for a top view or
 * a river's active view.
 */
export default function(view) {
  let uri = view.url;
  let state = view.securityState;
  let aboutPageType = view.aboutPageType;

  /**
   * Whether its an internally implemented, secure, "about" page that does not
   * require showing a special icon. An example of an about page that may require
   * showing a special icon includes about:certerror pages where the icon indicates
   * the security status of the page that was blocked from loading.
   */
  function isSecureAboutPage() {
    let secureInternalPages = /^(?:accounts|addons|cache|certificate|config|crashes|downloads|license|logins|preferences|protections|rights|sessionrestore|support|welcomeback|ion)(?:[?#]|$)/i;
    return uri.schemeIs("about") && secureInternalPages.test(uri.pathQueryRef);
  }

  function getResolvedURI() {
    let chanOptions = { uri, loadUsingSystemPrincipal: true };
    let resolvedURI;
    try {
      resolvedURI = NetUtil.newChannel(chanOptions).URI;
      if (resolvedURI.schemeIs("jar")) {
        // Given a URI "jar:<jar-file-uri>!/<jar-entry>"
        // create a new URI using <jar-file-uri>!/<jar-entry>
        resolvedURI = NetUtil.newURI(resolvedURI.pathQueryRef);
      }
      // Check the URI again after resolving.
      return resolvedURI;
    } catch (ex) {
      // NetUtil's methods will throw for malformed URIs and the like
      return null;
    }
  }

  /**
   * Whether its a page loaded from the file system.
   */
  function uriLoadedFromFile() {
    let resolvedURI = getResolvedURI();
    if (resolvedURI && resolvedURI.schemeIs("file")) {
      return true;
    }
    return false;
  }

  /**
   * Whether the connection to the current site was done via secure
   * transport. Note that this doesn't always return true in all cases that
   * the site was accessed via HTTPS, i.e. it returns false when isBrokenConnection()
   * is true even though the page was loaded over HTTPS.
   */
  function isSecureConnection() {
    return (
      !uriLoadedFromFile() && state & Ci.nsIWebProgressListener.STATE_IS_SECURE
    );
  }

  /**
   * Whether the established HTTPS connection is considered "broken".
   * This could have several reasons, such as mixed content or weak
   * cryptography. If this is true, isSecureConnection() returns false.
   */
  function isBrokenConnection() {
    return state & Ci.nsIWebProgressListener.STATE_IS_BROKEN;
  }

  /**
   * Whether mixed active content has been blocked from loading.
   */
  function isMixedActiveContentBlocked() {
    return state & Ci.nsIWebProgressListener.STATE_BLOCKED_MIXED_ACTIVE_CONTENT;
  }

  /**
   * Whether mixed active content has loaded.
   */
  function isMixedActiveContentLoaded() {
    return state & Ci.nsIWebProgressListener.STATE_LOADED_MIXED_ACTIVE_CONTENT;
  }

  /**
   * Whether mixed passive content has loaded.
   */
  function isMixedPassiveContentLoaded() {
    return state & Ci.nsIWebProgressListener.STATE_LOADED_MIXED_DISPLAY_CONTENT;
  }

  let uriHasHost = false;
  try {
    uriHasHost = !!uri.host;
  } catch (e) {
    // When an nsIURI doesn't have a host (for example, for about: pages),
    // trying to access it causes an exception to be thrown.
  }

  if (isSecureAboutPage()) {
    return "aboutUI";
  } else if (uriHasHost && isSecureConnection()) {
    return "verifiedDomain";
  } else if (isBrokenConnection()) {
    if (isMixedActiveContentLoaded()) {
      return "mixedActiveContent";
    } else if (isMixedActiveContentBlocked()) {
      return "mixedDisplayContentLoadedActiveBlocked";
    } else if (isMixedPassiveContentLoaded()) {
      return "mixedDisplayContent";
    }
    return "weakCipher";
  } else if (aboutPageType == "reader") {
    return "readerMode";
  } else if (aboutPageType == "certerror") {
    return "certErrorPage";
  } else if (aboutPageType == "httpsonlyerror") {
    return "httpsOnlyErrorPage";
  } else if (aboutPageType == "neterror" || aboutPageType == "blocked") {
    // Using a placeholder icon in this case. We will require a new icon from UX.
    return "unknownIdentity";
  } else if (
    uriLoadedFromFile() &&
    (uri.schemeIs("resource") || uri.schemeIs("chrome") || uri.schemeIs("file"))
  ) {
    return "localResource";
  }

  // This is an insecure connection.
  return "notSecure";
}
