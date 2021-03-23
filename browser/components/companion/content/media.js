/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

function tabForBrowser(browser) {
  let gBrowser = browser.ownerGlobal.gBrowser;
  return gBrowser.getTabForBrowser(browser);
}

export class MediaList extends HTMLElement {
  constructor(title) {
    super();

    this.title = title;
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-media-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;

    // TODO: the Mute All functionality isn't working right so it's hidden for now.
    // It's either due to some distinction between a tab being muted and the underlying
    // media elements being muted or just some bugs here
    this.muteAll = fragment.querySelector(".mute-all");
    this.muteAll.addEventListener("click", () => {
      if (this.muteAll.hasAttribute("disabled")) {
        return;
      }
      for (let browser of this.allBrowsers) {
        let tab = tabForBrowser(browser);
        if (tab.soundPlaying) {
          tab.toggleMuteAudio();
        }
      }
      this.render();
    });
    this.muteAll.hidden = true;
    shadow.appendChild(fragment);

    this.trackedControllers = new WeakSet();
    this.windowListener = () => this.render();
  }
  connectedCallback() {
    this.render();
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-change"
    );
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-new-tab"
    );
  }
  disconnectedCallback() {
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-change"
    );
    Services.obs.removeObserver(
      this.windowListener,
      "browser-window-tracker-new-tab"
    );
  }
  get allBrowsers() {
    let browsers = [];
    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let browser of win.gBrowser.browsers) {
        browsers.push(browser);
      }
    }
    return browsers;
  }
  render() {
    console.debug(`Media: render`);
    this.innerHTML = "";
    let anyNoisy = false;
    for (let browser of this.allBrowsers) {
      if (!browser.browsingContext) {
        continue;
      }
      this.connectMediaController(browser.browsingContext);
      // console.log(browser.browsingContext.mediaController);
      // if (!browser.browsingContext.mediaController.isActive) {
      //     continue;
      // }
      this.append(new Media(browser));
      if (!browser.audioMuted) {
        anyNoisy = true;
      }
    }

    if (anyNoisy) {
      this.muteAll.removeAttribute("disabled");
    } else {
      this.muteAll.setAttribute("disabled", "true");
    }

    if (this.querySelector("e-media:not([hidden])")) {
      this.removeAttribute("hidden");
    } else {
      this.setAttribute("hidden", "true");
    }
  }

  connectMediaController(browsingContext) {
    let controller = browsingContext?.mediaController;
    if (!controller || this.trackedControllers.has(controller)) {
      return;
    }
    this.trackedControllers.add(controller);

    const options = {
      mozSystemGroup: true,
      capture: false,
    };

    controller.addEventListener("activated", this, options);
    controller.addEventListener("deactivated", this, options);
    controller.addEventListener("supportedkeyschange", this, options);
    controller.addEventListener("positionstatechange", this, options);
    controller.addEventListener("metadatachange", this, options);
    controller.addEventListener("playbackstatechange", this, options);
  }

  handleEvent(aEvent) {
    // switch (aEvent.type) {
    //   case "activated":
    //     console.debug(`Media: activated`, aEvent);
    //     break;
    //   case "deactivated":
    //     console.debug(`Media: deactivated`, aEvent);
    //     break;
    //   case "supportedkeyschange":
    //     console.debug(`Media: supportedkeyschange`, aEvent);
    //     break;
    //   case "positionstatechange":
    //     console.debug(`Media: positionstatechange`, aEvent);
    //     break;
    //   case "metadatachange":
    //     console.debug(`Media: metadatachange`, aEvent);
    //     break;
    //   case "playbackstatechange":
    //     console.debug(`Media: playbackstatechange`, aEvent);
    //     break;
    //   default:
    //     console.debug(`Unknown event type ${aEvent.type}`);
    //     break;
    // }
    this.render();
  }
}

export class Media extends HTMLElement {
  constructor(browser) {
    super();
    this.browser = browser;

    this.className = "media card";
    let template = document.getElementById("template-media");
    let fragment = template.content.cloneNode(true);

    this.appendChild(fragment);
    this.render();
    this.play.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.mediaController.play();
      this.render();
    });
    this.pause.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.mediaController.pause();
      this.render();
    });
    this.mute.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.tab.toggleMuteAudio();
      this.render();
    });
    this.unmute.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.tab.toggleMuteAudio();
      this.render();
    });
    this.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }

      // i'm sure there's a better way to do this
      this.browser.ownerGlobal.gBrowser.selectedTab = this.tab;
      this.browser.ownerGlobal.focus();
      this.render();
    });
    this.next.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.mediaController.nextTrack();
      this.render();
    });
    this.prev.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      this.mediaController.prevTrack();
      this.render();
    });
  }

  get tab() {
    return tabForBrowser(this.browser);
  }
  get mediaController() {
    return this.browser?.browsingContext?.mediaController;
  }
  get metadata() {
    let metadata = null;
    try {
      metadata = this.mediaController.getMetadata();
    } catch (e) {}
    return metadata;
  }
  get artwork() {
    return this.querySelector(".artwork");
  }
  get title() {
    return this.querySelector(".title");
  }
  get play() {
    return this.querySelector(".play");
  }
  get pause() {
    return this.querySelector(".pause");
  }
  get mute() {
    return this.querySelector(".mute");
  }
  get unmute() {
    return this.querySelector(".unmute");
  }
  get switchToTab() {
    return this.querySelector(".tab");
  }
  get prev() {
    return this.querySelector(".prev");
  }
  get next() {
    return this.querySelector(".next");
  }

  render() {
    // TODO: Check supportedkeys to dynamically add / remove buttons

    let metadata = this.metadata;
    if (metadata) {
      this.title.textContent =
        this.metadata.title +
        " - " +
        this.metadata.artist +
        " - " +
        this.metadata.album;
      if (metadata.artwork[0]) {
        // TODO:
        // 1) This is loading a remote URL
        // 2) Use favicon as fallback
        this.artwork.src = metadata.artwork[0].src;
      } else {
        this.artwork.hidden = true;
      }
    } else {
      this.hidden = true;
    }
    if (!this.mediaController.supportedKeys.includes("play") ||
        !this.mediaController.supportedKeys.includes("pause")) {
      // Only offer play/pause option if the site supports both
      // options.
      this.play.hidden = true;
      this.pause.hidden = true;
    } else if (this.mediaController.isPlaying) {
      this.play.hidden = true;
      this.pause.hidden = false;
    } else {
      this.pause.hidden = true;
      this.play.hidden = false;
    }
    if (this.browser.audioMuted) {
      this.mute.hidden = true;
      this.unmute.hidden = false;
    } else {
      this.unmute.hidden = true;
      this.mute.hidden = false;
    }
    this.prev.hidden = !this.mediaController.supportedKeys.includes("previoustrack");
    this.next.hidden = !this.mediaController.supportedKeys.includes("nexttrack");
  }
}

customElements.define("e-media-list", MediaList);
customElements.define("e-media", Media);
