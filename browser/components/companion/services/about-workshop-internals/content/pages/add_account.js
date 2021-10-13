/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";
import { Page } from "../page.js";

ChromeUtils.defineModuleGetter(
  globalThis,
  "OAuth2",
  "resource:///modules/OAuth2.jsm"
);

export default class AddAccountPage extends Page {
  static get properties() {
    return {
      icsStatus: { state: true },
      rssStatus: { state: true },
      gapiStatus: { state: true },
      mapiStatus: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  constructor(opts) {
    super(opts, {
      title: "Add Account",
      pageId: "page-add-account",
    });
  }

  icsTemplate() {
    return html`
      <section class="card">
        <h5>Add iCalendar via ICS URL</h5>
        <div id="home-add-ics-error">${this.icsStatus}</div>
        <form>
          <label for="home-add-ics-input">URL: </label>
          <input
            id="home-add-ics-input"
            type="text"
            placeholder="https://example.org/example.ics"
          />
          <hr />
          <button
            id="home-add-ics-button"
            type="button"
            @click=${this.onClickAddIcs}
          >
            Add
          </button>
        </form>
      </section>
    `;
  }

  get _icsInput() {
    return this.renderRoot.querySelector("#home-add-ics-input");
  }

  async onClickAddIcs() {
    this.icsStatus = "Creating account...";
    let {
      error,
      errorDetails,
      account,
    } = await this.workshopAPI.tryToCreateAccount(
      {
        calendarUrl: this._icsInput.value,
      },
      {
        type: "ical",
      }
    );

    if (error) {
      const jsonDetails = JSON.stringify(errorDetails);
      this.icsStatus = `${error}: ${jsonDetails}`;
    } else {
      this.icsStatus = "Account created!";
      this.router.navigateTo(["account", account.id]);
    }
  }

  rssTemplate() {
    return html`
      <section class="card">
        <h5>Add RSS Feed Account</h5>
        <div id="home-add-rss-error">${this.rssStatus}</div>
        <form>
          <label for="home-add-rss-input">URL: </label>
          <input
            id="home-add-rss-input"
            type="text"
            placeholder="https://example.org/example.xml"
          />
          <hr />
          <button
            id="home-add-rss-button"
            type="button"
            @click=${this.onClickAddRss}
          >
            Add
          </button>
        </form>
      </section>
    `;
  }

  get _rssInput() {
    return this.renderRoot.querySelector("#home-add-rss-input");
  }

  async onClickAddRss() {
    this.rssStatus = "Creating account...";
    let {
      error,
      errorDetails,
      account,
    } = await this.workshopAPI.tryToCreateAccount(
      {
        feedUrl: this._rssInput.value,
      },
      {
        type: "feed",
      }
    );

    if (error) {
      const jsonDetails = JSON.stringify(errorDetails);
      this.rssStatus = `${error}: ${jsonDetails}`;
    } else {
      this.rssStatus = "Account created!";
      this.router.navigateTo(["account", account.id]);
    }
  }

  gapiTemplate() {
    return html`
      <section class="card">
        <h5>Google Account</h5>
        <div id="home-add-gapi-error">${this.gapiStatus}</div>
        <form>
          <button
            id="home-add-gapi-button"
            type="button"
            @click="${this.onClickAddGapi}"
          >
            Add
          </button>
        </form>
      </section>
    `;
  }

  async onClickAddGapi() {
    this.gapiStatus = "Creating account...";

    // ### Perform the oauth dance
    // NOTE: Serious concern here: This may end up destroying our tab, causing
    // us to lose our state.
    const oauthInfo = this.workshopAPI.oauthBindings.google;
    const authorizer = new OAuth2(
      oauthInfo.endpoint,
      oauthInfo.tokenEndpoint,
      oauthInfo.scopes.join(" "),
      oauthInfo.clientId,
      oauthInfo.clientSecret,
      null
    );

    try {
      const accessToken = await authorizer.getToken();
      if (!accessToken) {
        this.gapiStatus = "OAuth failure, see console.";
        return;
      }
    } catch (ex) {
      this.gapiStatus = `Exception during OAuth: ${ex}`;
      return;
    }
    // The authorizer should now have accessToken, refreshToken, and
    // tokenExpires on it.

    const domainInfo = {
      type: "gapi",
      oauth2Settings: {
        authEndpoint: oauthInfo.endpoint,
        tokenEndpoint: oauthInfo.tokenEndpoint,
        scope: oauthInfo.scopes.join(" "),
      },
      oauth2Secrets: {
        clientId: oauthInfo.clientId,
        clientSecret: oauthInfo.clientSecret,
      },
      oauth2Tokens: {
        refreshToken: authorizer.refreshToken,
        accessToken: oauthInfo.accessToken,
        expireTimeMS: oauthInfo.tokenExpires,
      },
    };

    let {
      error,
      errorDetails,
      account,
    } = await this.workshopAPI.tryToCreateAccount(
      // The domainInfo should already have everything we need to pull out the
      // account info, so there's nothing to pass here.
      {},
      domainInfo
    );

    if (error) {
      const jsonDetails = JSON.stringify(errorDetails);
      this.gapiStatus = `${error}: ${jsonDetails}`;
    } else {
      this.gapiStatus = "Account created!";
      this.router.navigateTo(["account", account.id]);
    }
  }

  mapiTemplate() {
    return html`
      <section class="card">
        <h5>Microsoft Account</h5>
        <div id="home-add-mapi-error">${this.mapiStatus}</div>
        <form>
          <button
            id="home-add-mapi-button"
            type="button"
            @click="${this.onClickAddMapi}"
          >
            Add
          </button>
        </form>
      </section>
    `;
  }

  async onClickAddMapi() {
    this.mapiStatus = "Creating account...";

    // ### Perform the oauth dance
    // NOTE: Serious concern here: This may end up destroying our tab, causing
    // us to lose our state.
    const oauthInfo = this.workshopAPI.oauthBindings.microsoft;
    const authorizer = new OAuth2(
      oauthInfo.endpoint,
      oauthInfo.tokenEndpoint,
      oauthInfo.scopes.join(" "),
      oauthInfo.clientId,
      oauthInfo.clientSecret,
      null
    );

    try {
      const accessToken = await authorizer.getToken();
      if (!accessToken) {
        this.mapiStatus = "OAuth failure, see console.";
        return;
      }
    } catch (ex) {
      this.mapiStatus = `Exception during OAuth: ${ex}`;
      return;
    }
    // The authorizer should now have accessToken, refreshToken, and
    // tokenExpires on it.

    const domainInfo = {
      type: "mapi",
      oauth2Settings: {
        authEndpoint: oauthInfo.endpoint,
        tokenEndpoint: oauthInfo.tokenEndpoint,
        scope: oauthInfo.scopes.join(" "),
      },
      oauth2Secrets: {
        clientId: oauthInfo.clientId,
        clientSecret: oauthInfo.clientSecret,
      },
      oauth2Tokens: {
        refreshToken: authorizer.refreshToken,
        accessToken: oauthInfo.accessToken,
        expireTimeMS: oauthInfo.tokenExpires,
      },
    };

    let {
      error,
      errorDetails,
      account,
    } = await this.workshopAPI.tryToCreateAccount(
      // The domainInfo should already have everything we need to pull out the
      // account info, so there's nothing to pass here.
      {},
      domainInfo
    );

    if (error) {
      const jsonDetails = JSON.stringify(errorDetails);
      this.mapiStatus = `${error}: ${jsonDetails}`;
    } else {
      this.mapiStatus = "Account created!";
      this.router.navigateTo(["account", account.id]);
    }
  }

  render() {
    return html`
      <h4>Add Accounts</h4>
      ${this.icsTemplate()} ${this.rssTemplate()} ${this.gapiTemplate()}
      ${this.mapiTemplate()}
    `;
  }
}
customElements.define("awi-add-account-page", AddAccountPage);
