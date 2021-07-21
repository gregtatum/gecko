/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Page } from "../page.js";

import { ListView } from "../elements/list_view.js";
import { AccountListItem } from "../elements/account_list_item.js";

export default class HomePage extends Page {
  constructor(opts) {
    super(opts, {
      title: "Workshop Internals Home",
      pageId: "page-home",
    });
  }

  render(pageElem) {
    // ## Add ICS Account
    this.icsErrorArea = pageElem.querySelector("#home-add-ics-error");
    this.icsInput = pageElem.querySelector("#home-add-ics-input");
    this.icsButton = pageElem.querySelector("#home-add-ics-button");
    this.icsAddHandler = async () => {
      this.icsErrorArea.textContent = "Creating account...";
      let {
        error,
        errorDetails,
        account,
      } = await this.workshopAPI.tryToCreateAccount(
        {
          calendarUrl: this.icsInput.value,
        },
        {
          type: "ical",
        }
      );

      if (error) {
        const jsonDetails = JSON.stringify(errorDetails);
        this.icsErrorArea.textContent = `${error}: ${jsonDetails}`;
      } else {
        this.icsErrorArea.textContent = "Account created!";
        this.router.navigateTo(["account", account.id]);
      }
    };
    this.icsButton.addEventListener("click", this.icsAddHandler);

    // ## Add ActiveSync Account
    this.asErrorArea = pageElem.querySelector("#home-add-activesync-error");
    this.asEmailInput = pageElem.querySelector(
      "#home-add-activesync-email-input"
    );
    this.asPasswordInput = pageElem.querySelector(
      "#home-add-activesync-password-input"
    );
    this.asButton = pageElem.querySelector("#home-add-activesync-button");
    this.activesyncAddHandler = async () => {
      this.asErrorArea.textContent = "Creating account...";
      let {
        error,
        errorDetails,
        account,
      } = await this.workshopAPI.tryToCreateAccount(
        {
          displayName: this.asEmailInput.value,
          emailAddress: this.asEmailInput.value,
          password: this.asPasswordInput.value,
        },
        {
          type: "activesync",
          incoming: {
            server: "https://m.hotmail.com",
          },
        }
      );

      if (error) {
        const jsonDetails = JSON.stringify(errorDetails);
        this.asErrorArea.textContent = `${error}: ${jsonDetails}`;
      } else {
        this.asErrorArea.textContent = "Account created!";
        this.router.navigateTo(["account", account.id]);
      }
    };
    this.asButton.addEventListener("click", this.activesyncAddHandler);

    // ## Add RSS Account
    this.rssErrorArea = pageElem.querySelector("#home-add-rss-error");
    this.rssInput = pageElem.querySelector("#home-add-rss-input");
    this.rssButton = pageElem.querySelector("#home-add-rss-button");
    this.rssAddHandler = async () => {
      this.rssErrorArea.textContent = "Creating account...";
      let {
        error,
        errorDetails,
        account,
      } = await this.workshopAPI.tryToCreateAccount(
        {
          feedUrl: this.rssInput.value,
        },
        {
          type: "feed",
        }
      );

      if (error) {
        const jsonDetails = JSON.stringify(errorDetails);
        this.rssErrorArea.textContent = `${error}: ${jsonDetails}`;
      } else {
        this.rssErrorArea.textContent = "Account created!";
        this.router.navigateTo(["account", account.id]);
      }
    };
    this.rssButton.addEventListener("click", this.rssAddHandler);

    // ## List Accounts
    this.accountListContainer = pageElem.querySelector(
      "#home-account-list-container"
    );
    this.accountListElem = new ListView(
      this.workshopAPI.accounts,
      AccountListItem
    );
    this.accountListContainer.appendChild(this.accountListElem);

    // ## Random Navigation Buttons
    this.settingsButton = pageElem.querySelector("#home-show-settings");
    this.settingsHandler = () => {
      this.router.navigateTo(["settings"]);
    };
    this.settingsButton.addEventListener("click", this.settingsHandler);
  }

  cleanup() {
    this.icsButton.removeEventListener("click", this.icsAddHandler);
    this.asButton.removeEventListener("click", this.activesyncAddHandler);
    this.rssButton.removeEventListener("click", this.rssAddHandler);

    this.accountListContainer.replaceChildren();
    // Note that we don't need to / shouldn't release `workshopAPI.accounts`
    // because it's supposed to always be there, but for other list views which
    // we ourselves created, we would want to call `release()` at the end.

    this.settingsButton.removeEventListener("click", this.settingsHandler);
  }
}
