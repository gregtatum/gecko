/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Provides OAuth 2.0 authentication.
 * @see RFC 6749
 */
var EXPORTED_SYMBOLS = ["OAuth2"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
});

const TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY =
  "TopLevelNavigationDelegate:IgnoreList";

XPCOMUtils.defineLazyGlobalGetters(this, ["XMLHttpRequest"]);

// This is used for Microsoft OAuth integration. Microsoft requires the Origin
// header to be correct, or to be missing. There's no way to disable the Origin
// header using `fetch()` (at best it can be empty, which doesn't work), so we
// use XHR instead.
function promiseXHR(data) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest({ mozAnon: true, mozSystem: true });
    xhr.responseType = "json";

    const method = data.method || "GET";
    let url = data.url;
    const body = data.body || null;

    xhr.addEventListener(
      "loadend",
      function(event) {
        resolve({ status: xhr.status, json: xhr.response });
      },
      { once: true }
    );

    xhr.open(method, url);

    xhr.send(body);
  });
}

const OAuthConnect = {
  connections: new Map(),

  connect(oauth) {
    return new Promise((resolve, reject) => {
      let win = BrowserWindowTracker.getTopWindow();
      if (!win) {
        throw new Error("No current browser window");
      }

      // This will be passed in the state parameter to identify this request
      // when the user returns from the OAuth flow.
      let id = Services.uuid.generateUUID().toString();

      let params = new URLSearchParams();
      params.set("client_id", oauth.clientId);
      params.set("redirect_uri", oauth.redirectionEndpoint);
      params.set("response_type", "code");
      params.set("scope", oauth.scope);
      params.set("access_type", "offline");
      params.set("state", id);
      params.set("prompt", "select_account");

      let url = new URL(oauth.authorizationEndpoint + "?" + params);
      let tab = win.gBrowser.addTrustedTab("about:blank");
      tab.setAttribute("pinebuild-oauth-flow", oauth.serviceType || "true");

      win.gBrowser.selectedTab = tab;

      // If the TopLevelNavigationDelegateChild is being used, we need it
      // to never convert a top-level navigation into a new tab. We do this
      // with sharedData instead of sending a message to the
      // TopLevelNavigationDelegateChild directly, because we need that
      // configuration to survive potential cross-domain process flips.
      let browserId = tab.linkedBrowser.browsingContext.browserId;

      let { sharedData } = Services.ppmm;
      if (!sharedData.has(TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY)) {
        sharedData.set(
          TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY,
          new Set([browserId])
        );
      } else {
        // In order for SharedData to detect the change and propagate it, we
        // have to write a new reference value to the
        // TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY key by creating a new Set.
        let originalSet = sharedData.get(TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY);
        let newSet = new Set(originalSet).add(browserId);
        sharedData.set(TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY, newSet);
      }

      // SharedData is, by default, lazy, and will only flush the changes
      // on idle. We don't want to run the risk of racing with that message,
      // so we flush manually here to ensure that the sharedData shows up
      // in the content process for this tab before it loads anything.
      sharedData.flush();

      win.focus();

      tab.linkedBrowser.loadURI(url.toString(), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });

      this.connections.set(id, {
        tab,
        oauth,
        resolve,
        reject,
      });

      tab.linkedBrowser.addProgressListener(this);

      let self = this;
      tab.addEventListener("TabClose", function onClose() {
        self.connections.delete(id);
        tab.removeEventListener("TabClose", onClose);
        tab.linkedBrowser.removeProgressListener(self);
      });
    });
  },

  /**
   * Listen to nsIWebProgress events on the OAuth flow tab. Once there is a
   * request that has a `state` parameter that we have used in the OAuth flow
   * the request will be treated as the user returning from their OAuth flow.
   */
  onStateChange(progress, request, flags) {
    if (
      (progress.isTopLevel &&
        request &&
        request.URI &&
        flags &
          (Ci.nsIWebProgressListener.STATE_START |
            Ci.nsIWebProgressListener.STATE_IS_NETWORK)) ||
      request instanceof Ci.nsIChannel
    ) {
      let params = new URLSearchParams(request.URI.query);
      let id = params.get("state");
      if (!this.connections.has(id)) {
        return;
      }

      let { tab, oauth, resolve, reject } = this.connections.get(id);

      if (
        request.URI.prePath + request.URI.filePath !=
        oauth.redirectionEndpoint
      ) {
        return;
      }

      this.connections.delete(id);
      let browserId = tab.linkedBrowser.browsingContext.browserId;

      tab.ownerGlobal.gBrowser.removeTab(tab);

      let { sharedData } = Services.ppmm;
      sharedData.get(TOPLEVEL_NAVIGATION_DELEGATE_DATA_KEY).delete(browserId);

      // Reach out to the OAuth provider's server to turn our "code" into an
      // authenticated access token.
      let code = params.get("code");
      oauth.requestAccessToken(code).then(resolve, reject);
    }
  },

  QueryInterface: ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsISupportsWeakReference",
  ]),
};

/**
 * This class is imported with modifications from the Thunderbird codebase.
 * https://searchfox.org/comm-central/source/mailnews/base/src/OAuth2.jsm
 */
class OAuth2 {
  /**
   * Constructor for the OAuth2 object.
   *
   * @constructor
   * @param {string} authorizationEndpoint - The authorization endpoint as
   *   defined by RFC 6749 Section 3.1.
   * @param {string} tokenEndpoint - The token endpoint as defined by
   *   RFC 6749 Section 3.2.
   * @param {?string} scope - The scope as specified by RFC 6749 Section 3.3.
   *   Will not be included in the requests if falsy.
   * @param {string} clientId - The client_id as specified by RFC 6749 Section
   *   2.3.1.
   * @param {string} [clientSecret=null] - The client_secret as specified in
   *    RFC 6749 section 2.3.1. Will not be included in the requests if null.
   */
  constructor(
    authorizationEndpoint,
    tokenEndpoint,
    scope,
    clientId,
    clientSecret = null,
    config = null,
    serviceType = null
  ) {
    this.authorizationEndpoint = authorizationEndpoint;
    this.tokenEndpoint = tokenEndpoint;
    this.scope = scope;
    this.clientId = clientId;
    this.consumerSecret = clientSecret;
    this.serviceType = serviceType;

    this.extraAuthParams = [];

    if (config) {
      this.deserialize(config);
    }
  }

  clientId = null;
  consumerSecret = null;
  redirectionEndpoint = "https://localhost/oauth";
  scope = null;

  accessToken = null;
  refreshToken = null;
  tokenExpires = null;

  getTokenPromise = null;

  async internalGetToken() {
    if (this.accessToken && this.tokenExpires > Date.now()) {
      return this.accessToken;
    }

    if (this.refreshToken) {
      this.accessToken = null;
      this.tokenExpires = null;
      try {
        return await this.requestAccessToken();
      } catch (e) {
        console.error("Failed to refresh token, attempting to log in again.");
      }
    }

    return OAuthConnect.connect(this);
  }

  async getToken() {
    if (!this.getTokenPromise) {
      this.getTokenPromise = this.internalGetToken().finally(
        () => (this.getTokenPromise = null)
      );
    }

    return this.getTokenPromise;
  }

  toJSON() {
    if (!this.refreshToken) {
      return null;
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpires: this.tokenExpires,
    };
  }

  deserialize(data) {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.tokenExpires = data.tokenExpires;
  }

  /**
   * Request a new access token, or refresh an existing one.
   * @param {string} aCode - The token issued to the client or null to refresh.
   */
  async requestAccessToken(aCode) {
    // @see RFC 6749 section 4.1.3. Access Token Request
    // @see RFC 6749 section 6. Refreshing an Access Token

    let data = new URLSearchParams();
    data.append("client_id", this.clientId);
    if (this.consumerSecret !== null) {
      // Section 2.3.1. of RFC 6749 states that empty secrets MAY be omitted
      // by the client. This OAuth implementation delegates this decision to
      // the caller: If the secret is null, it will be omitted.
      data.append("client_secret", this.consumerSecret);
    }

    if (!aCode) {
      data.append("grant_type", "refresh_token");
      data.append("refresh_token", this.refreshToken);
    } else {
      data.append("grant_type", "authorization_code");
      data.append("code", aCode);
      data.append("redirect_uri", this.redirectionEndpoint);
    }

    let response = await promiseXHR({
      url: this.tokenEndpoint,
      method: "POST",
      body: data,
    });

    let result = response.json;

    if ("error" in result) {
      // RFC 6749 section 5.2. Error Response

      // Typically in production this would be {"error": "invalid_grant"}.
      // That is, the token expired or was revoked (user changed password?).
      // Reset the tokens we have and call success so that the auth flow
      // will be re-triggered.
      this.accessToken = null;
      this.refreshToken = null;

      let resultStr = JSON.stringify(result, null, 2);
      console.error(
        `The authorization server returned an error response: ${resultStr}`
      );

      // We return instead of throw here so we can handle it as a null token.
      return null;
    }

    // RFC 6749 section 5.1. Successful Response
    this.accessToken = result.access_token;
    if ("refresh_token" in result) {
      this.refreshToken = result.refresh_token;
    }
    if ("expires_in" in result) {
      this.tokenExpires = new Date().getTime() + result.expires_in * 1000;
    } else {
      this.tokenExpires = Number.MAX_VALUE;
    }

    return this.accessToken;
  }
}
