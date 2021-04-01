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
      for (let media of this.allActiveMediaChildren) {
        let tab = media.tab;
        if (tab.soundPlaying && !tab.muted) {
          tab.toggleMuteAudio();
        }
      }
      this.render();
    });
    shadow.appendChild(fragment);

    this.trackedControllers = new WeakSet();
    this.trackedTabs = new WeakSet();
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

  get allActiveMediaChildren() {
    return this.querySelectorAll("e-media:not([hidden])");
  }

  render() {
    this.innerHTML = "";
    for (let browser of this.allBrowsers) {
      if (!browser.browsingContext) {
        continue;
      }
      // TODO: This only handles the browsingContext for the top-level
      // document and not subdocs (like a youtube embed). We may want to
      // recurse into children to find a media session if the top-level
      // doc doesn't have one. Should we try to handle the case where we
      // have multiple within a tab?
      this.connectMediaController(browser.browsingContext);
      this.connectTab(tabForBrowser(browser));
      this.append(new Media(browser));
    }

    if (this.allActiveMediaChildren.length) {
      this.removeAttribute("hidden");
      let anyNoisy = false;
      for (let media of this.allActiveMediaChildren) {
        if (media.tab.soundPlaying && !media.tab.muted) {
          anyNoisy = true;
        }
        if (anyNoisy) {
          this.muteAll.removeAttribute("disabled");
        } else {
          this.muteAll.setAttribute("disabled", "true");
        }
      }
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

  connectTab(tab) {
    if (!tab || this.trackedTabs.has(tab)) {
      return;
    }
    this.trackedTabs.add(tab);

    tab.addEventListener("TabAttrModified", this);
    tab.addEventListener("TabPipToggleChanged", this);
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
    this.pip.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      let actor = this.browser.browsingContext.currentWindowGlobal.getActor(
        "PictureInPictureLauncher"
      );
      actor.sendAsyncMessage("PictureInPicture:CompanionToggle");
      this.render();
    });
  }

  get tab() {
    return tabForBrowser(this.browser);
  }
  get mediaController() {
    return this.browser?.browsingContext?.mediaController;
  }
  get pipToggleParent() {
    return this.browser?.browsingContext?.currentWindowGlobal?.getActor(
      "PictureInPictureToggle"
    );
  }
  get canTogglePip() {
    return this.pipToggleParent && this.pipToggleParent.trackingMouseOverVideos;
  }
  get metadata() {
    let metadata = null;
    try {
      metadata = this.mediaController.getMetadata();
    } catch (e) {}
    return metadata;
  }
  get documentTitle() {
    return this.browser?.browsingContext?.currentWindowGlobal?.documentTitle;
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
  get prev() {
    return this.querySelector(".prev");
  }
  get next() {
    return this.querySelector(".next");
  }
  get pip() {
    return this.querySelector(".pip");
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
    } else if (
      (this.canTogglePip || this.tab.soundPlaying) &&
      this.documentTitle
    ) {
      this.title.textContent = this.documentTitle;
      // TODO: Use favicon here too
      this.artwork.hidden = true;
    } else {
      this.hidden = true;
    }
    if (
      !this.mediaController.supportedKeys.includes("play") ||
      !this.mediaController.supportedKeys.includes("pause") ||
      !metadata
    ) {
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
    this.prev.hidden = !this.mediaController.supportedKeys.includes(
      "previoustrack"
    );
    this.next.hidden = !this.mediaController.supportedKeys.includes(
      "nexttrack"
    );

    if (!this.canTogglePip) {
      this.pip.hidden = true;
    }
  }
}

customElements.define("e-media-list", MediaList);
customElements.define("e-media", Media);
