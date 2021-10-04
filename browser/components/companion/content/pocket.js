/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { html, css } from "./lit.all.js";

const NUM_POCKET_STORIES = 3;

// The filters: portion of this URL is handled on the pocket
// servers to adjust the image. If you need to change the image
// properties you can talk to the pocket team about them.
const POCKET_IMG_URL =
  "https://img-getpocket.cdn.mozilla.net/616x144/filters:format(jpeg):quality(100):no_upscale():strip_exif()/";

export class PocketStory extends MozLitElement {
  static get properties() {
    return {
      story: { type: Object },
    };
  }

  constructor() {
    super();
    this.story = {};
  }

  static get styles() {
    return css`
      .pocket {
        display: flex;
        flex-direction: column;
        width: 100%;
        border: 0.5px solid var(--in-content-border-color);
        border-radius: 8px;
        box-shadow: none;
        margin: 0 0 8px;
        padding: 0;
      }

      .pocket:hover {
        cursor: pointer;
      }

      .pocket-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding: 8px;
        border-radius: 0px 0px 8px 8px;
        border-top: 0.5px solid var(--in-content-border-color);
        background: #fafafa;
      }

      p {
        width: 100%;
      }

      a {
        color: currentColor;
        text-decoration: none;
      }

      a:focus {
        text-decoration: underline;
      }

      .preview {
        object-fit: cover;
        border-radius: 8px 8px 0 0;
        height: 72px;
      }

      .title,
      .excerpt,
      .domain {
        margin: 0;
      }

      .title,
      .excerpt {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        margin-bottom: 4px;
      }

      .title {
        font-size: 0.87em;
      }

      .excerpt {
        font-size: 0.73em;
        color: var(--in-content-deemphasized-text);
      }

      .domain {
        font-size: 0.6em;
        color: color-mix(
          in srgb,
          var(--in-content-deemphasized-text) 75%,
          transparent
        );
      }
    `;
  }

  get imageUrl() {
    if (window.CompanionUtils.isInAutomation) {
      return this.story.raw_image_src;
    }
    return POCKET_IMG_URL + encodeURIComponent(this.story.raw_image_src);
  }

  openStory(e) {
    e.preventDefault();
    window.openUrl(this.story.url);
  }

  render() {
    let { story, openStory, imageUrl } = this;
    return html`
      <div class="pocket pocket-story" @click=${openStory}>
        <img class="preview" src="${imageUrl}" />
        <div class="pocket-content">
          <p class="title">
            <a href=${story.url}>${story.title}</a>
          </p>
          <p class="excerpt">${story.excerpt}</p>
          <p class="domain">${story.domain}</p>
        </div>
      </div>
    `;
  }
}
customElements.define("pocket-story", PocketStory);

export class PocketList extends MozLitElement {
  static get properties() {
    return {
      stories: { type: Array, state: true },
    };
  }

  constructor() {
    super();
    this.stories = [];
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/companion.css");

      .pocket-stories {
        margin: 0 16px 16px 16px;
      }
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchPocketRecommendations();
  }

  async fetchPocketRecommendations() {
    let key = window.CompanionUtils.getCharPref(
      "extensions.pocket.oAuthConsumerKey"
    );

    let pocketURL = window.CompanionUtils.getCharPref(
      "browser.pinebuild.pocket.url",
      ""
    );

    // This will happen in tests that don't care about pocket.
    if (
      !pocketURL ||
      (window.CompanionUtils.isInAutomation &&
        !new URL(pocketURL).hostname.includes("example.com"))
    ) {
      return;
    }

    let target = new URL(`${pocketURL}?version=3&consumer_key=${key}`);
    let response = await fetch(target);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let results = await response.json();
    this.selectPocketStories(results.recommendations);

    await this.updateComplete;
    this.dispatchEvent(
      new CustomEvent("pocket-loaded", {
        bubbles: true,
        composed: true,
      })
    );
  }

  selectPocketStories(data) {
    let startIndex = Math.floor(Math.random() * Math.floor(data.length));
    this.stories = [];
    for (let i = 0; i < NUM_POCKET_STORIES; i++) {
      this.stories.push(
        this.getStoryData(data[(startIndex + i) % data.length])
      );
    }
  }

  getStoryData(story) {
    return {
      url: story.url,
      domain: story.domain,
      title: story.title,
      excerpt: story.excerpt,
      raw_image_src: story.raw_image_src,
    };
  }

  render() {
    return html`
      <div id="pocket-list" ?hidden=${!this.stories.length}>
        <h2
          class="list-title"
          data-l10n-id="companion-pocket-interesting-reads"
        ></h2>
        <h3
          class="list-subtitle"
          data-l10n-id="companion-pocket-powered-by"
        ></h3>
        <div class="pocket-stories">
          ${this.stories.map(
            story => html`
              <pocket-story .story=${story}></pocket-story>
            `
          )}
        </div>
      </div>
    `;
  }
}
customElements.define("pocket-list", PocketList);
