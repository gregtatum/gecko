/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Page } from "../page.js";

import { ListView } from "../elements/list_view.js";
import { AccountListItem } from "../elements/account_list_item.js";

export default class HomePage extends Page {
  constructor(opts) {
    super(opts, {
      pageId: "page-home",
    });
  }

  render(pageElem) {
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

    this.accountListContainer = pageElem.querySelector(
      "#home-account-list-container"
    );
    this.accountListElem = new ListView(
      this.workshopAPI.accounts,
      AccountListItem
    );
    this.accountListContainer.appendChild(this.accountListElem);
  }

  cleanup() {
    this.icsButton.removeEventListener("click", this.icsAddHandler);

    this.accountListContainer.replaceChildren([]);
    // Note that we don't need to / shouldn't release `workshopAPI.accounts`
    // because it's supposed to always be there, but for other list views which
    // we ourselves created, we would want to call `release()` at the end.
  }
}
