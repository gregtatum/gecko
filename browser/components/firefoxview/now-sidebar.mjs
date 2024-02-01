/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  GenAI: "resource:///modules/GenAI.sys.mjs",
  XPCOMUtils: "resource://gre/modules/XPCOMUtils.sys.mjs",
});

import { css, html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

// eslint-disable-next-line import/no-unassigned-import
import "chrome://global/content/elements/moz-card.mjs";

class NowSidebar extends MozLitElement {
  static properties = {
    prompts: { type: Array },
    notifications: { type: Array },
  };

  static queries = {
    textPromptEl: "textarea",
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .assistant-text-prompt {
      display: flex;
      align-items: stretch;
      gap: 4px;
      margin-top: 4px;

      & > textarea {
        padding: 4px;
        flex-grow: 1;
        border: 1px solid var(--border-interactive-color);
        border-radius: var(--button-border-radius);
      }

      & > button {
        background-image: url("chrome://browser/skin/forward.svg");
        background-position: center;
        background-repeat: no-repeat;
        width: 32px;
      }
    }

    .notification {
      p {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .footer-button {
        margin-block: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 95%;
      }

      .debug {
        font-style: italic;
      }
    }
  `;

  constructor() {
    super();
    this.parentWindow = window.docShell.chromeEventHandler.ownerGlobal;
    this.gBrowser = this.parentWindow.gBrowser;
    this.notifications = [];
    lazy.XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "debug",
      "genai.debug",
      null,
      () => this.isConnected && this.requestUpdate()
    );

    this.prompts = [
      {
        button: "Find tabs",
        label: "Tabs similar to ",
        description: "Analyzing page title and open tabs…",
        prompt: Services.prefs.getStringPref("genai.debug.prompts.0"),
      },
      {
        button: "Summarize content",
        label: "Summary of ",
        description: "Analyzing selection and page text…",
        prompt: Services.prefs.getStringPref("genai.debug.prompts.1"),
      },
      {
        button: "Suggest queries",
        label: "Follow-up searches for ",
        description: "Analyzing selection and page title…",
        prompt: Services.prefs.getStringPref("genai.debug.prompts.2"),
      },
      {
        button: "Name entities",
        label: "Entities on ",
        description: "Analyzing page text…",
        prompt: Services.prefs.getStringPref("genai.debug.prompts.3"),
      },
    ];
  }

  addNotification(notif) {
    this.notifications.unshift(notif);
    this.requestUpdate();
    return notif;
  }

  async runPrompt(event) {
    // Display placeholder content
    const { config } = event.target;
    const notif = this.addNotification({
      label: config.label + this.gBrowser.selectedTab.label,
      description: config.description,
    });

    let text = "";
    try {
      // Gather context for the prompt
      const tabMap = {};
      const actor =
        this.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(
          "GenAI"
        );
      const context = {
        currentTabTitle: this.gBrowser.selectedTab.label,
        openTabs: this.gBrowser.tabs
          .slice(-100)
          .reverse()
          .reduce((o, t, i) => {
            try {
              if (t.label != "New Tab") {
                const key =
                  t.linkedBrowser.currentURI.host.replace(/^www\./, "") + i;
                o[key] = t.label.slice(0, 100);
                tabMap[key] = t;
              }
            } catch (ex) {}
            return o;
          }, {}),
        pageText: await actor.getPageText(),
        selection: await actor.getSelection(),
      };

      // Run the prompt and update content
      text = await lazy.GenAI.completion(config.prompt, context);
      Object.assign(notif, JSON.parse(text));

      // Convert tab ids to tabs if they exist
      notif.tabs = notif.tabs?.reduce((acc, key) => {
        const tab = tabMap[key];
        if (tab) {
          acc.push(tab);
        }
        return acc;
      }, []);
    } catch (ex) {
      notif.description = ex;
      notif.debug = text;
    }
    this.requestUpdate();
  }

  textPrompt(e) {
    let text = this.textPromptEl.value;
    if (!text) {
      return;
    }
    this.addNotification({
      label: text,
      description: "Loading... (but not really)",
    });
    this.textPromptEl.value = "";
  }

  openLink(event) {
    this.parentWindow.openLinkIn(event.originalTarget.href, "tabshifted", {
      triggeringPrincipal:
        this.parentWindow._createNullPrincipalFromTabUserContextId(),
    });
  }

  switchTab(event) {
    this.gBrowser.selectedTab = event.target.tab;
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://global/skin/global.css" />
      <shopping-container insidebar></shopping-container>
      <moz-card heading="Insights">
        <p>
          Slightly more polished than GenAI debug mode but very early
          prototypes. Sends prompts to http endpoint as configured under
          about:config "genai." and toggle "genai.debug" to see more. AI
          generated responses may contain errors such as incorrect format or
          information. Try again or adjust configurations.
        </p>
        <div class="prompts">
          ${this.prompts.map(
            config =>
              html`<button
                .config=${config}
                @click=${this.runPrompt}
                class="footer-button small-button"
                title=${config.prompt}
              >
                ${config.button}
              </button>`
          )}
        </div>
        <div class="assistant-text-prompt">
          <textarea placeholder="This doesn't do anything yet"></textarea>
          <button class="footer-button" @click=${this.textPrompt}></button>
        </div>
      </moz-card>
      ${this.notifications.map(
        notif => html`
          <moz-card class="notification" .heading=${notif.label}>
            <p>${notif.description}</p>
            ${notif.tabs?.length
              ? html`Open tabs:
                ${notif.tabs.map(
                  tab =>
                    html`<button
                      .tab=${tab}
                      @click=${this.switchTab}
                      class="footer-button"
                      title=${tab.label}
                    >
                      ${tab.label}
                    </button>`
                )}`
              : null}
            ${notif.queries
              ? html`Search queries:
                  <ul>
                    ${notif.queries.map(
                      query =>
                        html`<li>
                          <a
                            @click=${this.openLink}
                            href=${Services.search.defaultEngine.getSubmission(
                              query
                            ).uri.spec}
                          >
                            ${query}
                          </a>
                        </li>`
                    )}
                  </ul>`
              : null}
            ${this.debug ? html`<p class="debug">${notif.debug}</p>` : null}
          </moz-card>
        `
      )}
    `;
  }
}
customElements.define("now-sidebar", NowSidebar);
