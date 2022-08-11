/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* <onboarding-flow> displays `n` onboarding cards and updates
 * user's onboarding progress pref as they proceed through the
 * flow
 *
 * card object:
 * {
 *  el: node,
 *  breadcrumbEl: node,
 *  page: 0,
 *  forwardNav: true,
 *  backwardNav: false,
 * }
 */
class OnboardingFlowElement extends HTMLElement {
  // These are the possible actions a button inside of a card
  // can initiate.
  ACTIONS = [
    "navigate-forward",
    "navigate-backward",
    "initiate-fxa-flow",
    "launch-learn-more",
    "complete-onboarding",
  ];

  // Sequence of steps in the onboarding flow, with names shortened to fit
  // the byte length limits of Glean events. If this sequence is changed, the
  // corresponding metrics events and tests should also be updated. MR2-2885
  STEPS = [
    "welcome",
    "connect_fxa",
    "fxa_connected",
    "privacy",
    "data_prefs",
    "congrats",
  ];

  constructor() {
    super();

    this._cards = [];
    this._currentIndex = 0;
  }

  connectedCallback() {
    window.addEventListener("OnboardingProgressPrefValue", this);
    this.requestProgressPref();

    this._backwardNavButton = document.querySelector(
      ".onboarding-backward-nav"
    );
    this._forwardNavButton = document.querySelector(".onboarding-forward-nav");
    this._breadcrumbs = document.querySelector(".onboarding-flow-breadcrumbs");
    this._backwardNavButton.addEventListener("click", this);
    this._forwardNavButton.addEventListener("click", this);

    let sections = this.getElementsByTagName("section");
    let i = 0;
    for (const section of sections) {
      let thisCard = {
        el: section,
        page: i,
        forwardNav: section.dataset.forwardNav,
        backwardNav: section.dataset.backwardNav,
      };

      const actionableElements = section.querySelectorAll("[data-action]");

      for (let actionableElement of actionableElements) {
        actionableElement.addEventListener("click", this);
      }

      let thisBreadcrumb = document.createElement("span");
      thisBreadcrumb.classList.add(`onboarding-breadcrumb-${i + 1}`);
      thisBreadcrumb.setAttribute("aria-role", "tab");
      thisBreadcrumb.setAttribute("data-active", "false");
      this._breadcrumbs.append(thisBreadcrumb);

      this._cards.push(thisCard);
      i++;
    }
  }

  changePage(newPageIndex) {
    if (!this._cards[newPageIndex]) {
      console.log("attempted to change to a non-existent page");
      return;
    }

    this._currentIndex = newPageIndex;

    let cardToShow = this._cards[this._currentIndex];
    this._cards.forEach(card => {
      card.el.hidden = card !== cardToShow;
    });

    this._forwardNavButton.disabled = cardToShow.forwardNav === "false";
    this._backwardNavButton.disabled = cardToShow.backwardNav === "false";
    this._forwardNavButton.hidden =
      this._currentIndex === this._cards.length - 1;
    this._backwardNavButton.hidden = this._currentIndex === 0;

    this.recordCardShown(this._currentIndex);
    this.setBreadcrumb(this._currentIndex);
    this.setProgressPref(this._currentIndex);
  }

  setBreadcrumb(activeIndex) {
    let i = 0;
    for (let crumb of this._breadcrumbs.children) {
      crumb.setAttribute("data-active", i === activeIndex);
      i++;
    }
  }

  // This sends up the request for the value of browser.pinebuild.onboarding.progress
  // It'll return as a message "OnboardingProgressPrefValue"
  requestProgressPref() {
    document.dispatchEvent(
      new CustomEvent("GetOnboardingProgressPrefValue", {
        bubbles: true,
      })
    );
  }

  saveDataPrefs() {
    let suggestPrefChecked = document.querySelector(
      "input[name='firefox-suggest']"
    ).checked;
    let usageStatsPrefChecked = document.querySelector(
      "input[name='usage-statistics']"
    ).checked;
    document.dispatchEvent(
      new CustomEvent("SaveDataPrefs", {
        bubbles: true,
        detail: { suggestPrefChecked, usageStatsPrefChecked },
      })
    );
  }

  setProgressPref(value) {
    document.dispatchEvent(
      new CustomEvent("SetOnboardingProgressPrefValue", {
        bubbles: true,
        detail: {
          newPrefValue: value,
        },
      })
    );
  }

  _recordEvent(eventName, idx) {
    document.dispatchEvent(
      new CustomEvent("RecordEvent", {
        bubbles: true,
        detail: {
          method: eventName,
          object: this.STEPS[idx],
          order: idx,
          is_last: idx == this.STEPS.length - 1,
        },
      })
    );
  }

  recordCardShown(idx) {
    this._recordEvent("shown", idx);
  }

  recordCardCompleted(idx) {
    this._recordEvent("done", idx);
  }

  handleEvent(event) {
    if (event.type === "OnboardingProgressPrefValue") {
      let newPage = event.detail.prefValue;
      this.changePage(newPage);
      return;
    }

    switch (event.target.dataset.action) {
      case "complete-onboarding":
        this.recordCardCompleted(this._currentIndex);
        document.dispatchEvent(
          new CustomEvent("OnboardingCompleted", { bubbles: true })
        );
        break;
      case "initiate-fxa-flow":
        this.recordCardCompleted(this._currentIndex);
        let email = document.getElementById("fxa-email").value;
        document.dispatchEvent(
          new CustomEvent("OpenFxa", {
            bubbles: true,
            detail: { email },
          })
        );
        break;
      case "launch-learn-more":
        document.dispatchEvent(
          new CustomEvent("LaunchLearnMore", {
            bubbles: true,
          })
        );
        break;
      case "navigate-forward":
        const DATA_PREFS_PAGE_ID = 3;
        if (this._currentIndex === DATA_PREFS_PAGE_ID) {
          this.saveDataPrefs();
        }
        this.recordCardCompleted(this._currentIndex);
        let nextCard = this._currentIndex + 1;
        this.changePage(nextCard);
        break;
      case "navigate-backward":
        let prevCard = this._currentIndex > 0 ? this._currentIndex - 1 : 0;
        this.changePage(prevCard);
        break;
      default:
        if (!this.ACTIONS.includes(event.target.dataset.action)) {
          console.log(
            "onboarding-flow component received an unsupported action"
          );
        }
        break;
    }
  }
}

customElements.define("onboarding-flow", OnboardingFlowElement);
