/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Provides OAuth 2.0 authentication.
 * @see RFC 6749
 */
var EXPORTED_SYMBOLS = ["OAuth2"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
});

XPCOMUtils.defineLazyServiceGetter(
  this,
  "uuidGenerator",
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

Cu.importGlobalProperties(["fetch"]);

function checkFlags(flags, mask) {
  return (flags & mask) == mask;
}

const OAuthConnect = {
  connections: new Map(),

  connect(oauth) {
    return new Promise((resolve, reject) => {
      let win = BrowserWindowTracker.getTopWindow();
      if (!win) {
        throw new Error("No current browser window");
      }

      let id = uuidGenerator.generateUUID().toString();

      let params = new URLSearchParams();
      params.set("client_id", oauth.clientId);
      params.set("redirect_uri", oauth.redirectionEndpoint);
      params.set("response_type", "code");
      params.set("scope", oauth.scope);
      params.set("access_type", "offline");
      params.set("state", id);

      let url = new URL(oauth.authorizationEndpoint + "?" + params);
      let tab = win.gBrowser.addTrustedTab(url.toString());
      win.gBrowser.selectedTab = tab;
      win.focus();

      this.connections.set(id, {
        tab,
        oauth,
        resolve,
        reject,
      });

      tab.linkedBrowser.addProgressListener(this);
    });
  },

  onStateChange(progress, request, flags) {
    if (
      progress.isTopLevel &&
      checkFlags(flags, Ci.nsIWebProgressListener.STATE_START) &&
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

      tab.ownerGlobal.gBrowser.removeTab(tab);

      let code = params.get("code");
      oauth.requestAccessToken(code).then(resolve, reject);
    }
  },

  QueryInterface: ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsISupportsWeakReference",
  ]),
};

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
    config = null
  ) {
    this.authorizationEndpoint = authorizationEndpoint;
    this.tokenEndpoint = tokenEndpoint;
    this.scope = scope;
    this.clientId = clientId;
    this.consumerSecret = clientSecret;

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

  async getToken() {
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
    this.refreshToken = data.accessToken;
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

    let response = await fetch(this.tokenEndpoint, {
      method: "POST",
      cache: "no-cache",
      body: data,
    });

    let result = await response.json();
    let resultStr = JSON.stringify(result, null, 2);

    if ("error" in result) {
      // RFC 6749 section 5.2. Error Response

      // Typically in production this would be {"error": "invalid_grant"}.
      // That is, the token expired or was revoked (user changed password?).
      // Reset the tokens we have and call success so that the auth flow
      // will be re-triggered.
      this.accessToken = null;
      this.refreshToken = null;

      throw new Error(
        `The authorization server returned an error response: ${resultStr}`
      );
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
