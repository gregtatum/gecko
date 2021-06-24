/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

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
      window.CompanionUtils.sendAsyncMessage("Companion:MuteAllTabs", null);
    });
    shadow.appendChild(fragment);

    this.trackedControllers = new WeakSet();
    this.trackedTabs = new WeakSet();
    this.windowListener = () => this.render();
  }

  connectedCallback() {
    window.addEventListener("Companion:TabAdded", this.windowListener);
    window.addEventListener("Companion:MediaEvent", this.windowListener);
    window.addEventListener("Companion:TabAttrModified", this.windowListener);
    window.addEventListener(
      "Companion:TabPipToggleChanged",
      this.windowListener
    );
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:TabAdded", this.windowListener);
    window.removeEventListener("Companion:MediaEvent", this.windowListener);
    window.removeEventListener(
      "Companion:TabAttrModified",
      this.windowListener
    );
    window.removeEventListener(
      "Companion:TabPipToggleChanged",
      this.windowListener
    );
  }

  get tabs() {
    return window.CompanionUtils.tabs();
  }

  get allActiveMediaChildren() {
    return this.querySelectorAll("e-media:not([hidden])");
  }

  render() {
    this.innerHTML = "";
    for (let tab of this.tabs) {
      if (!tab.media) {
        continue;
      }
      this.append(new Media(tab));
    }

    if (this.allActiveMediaChildren.length) {
      this.removeAttribute("hidden");
      let anyNoisy = false;
      for (let media of this.allActiveMediaChildren) {
        if (media.tab.soundPlaying && !media.tab.audioMuted) {
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
  constructor(tab) {
    super();
    this.tab = tab;

    this.className = "media card";
    let template = document.getElementById("template-media");
    let fragment = template.content.cloneNode(true);

    this.appendChild(fragment);
    this.render();

    let mediaControlHandler = command => {
      return event => {
        if (event.button != 0) {
          return;
        }
        event.stopPropagation();

        window.CompanionUtils.sendAsyncMessage("Companion:MediaControl", {
          browserId: this.tab.browserId,
          command,
        });
      };
    };

    this.playPause.addEventListener("click", mediaControlHandler("togglePlay"));
    this.mute.addEventListener("click", mediaControlHandler("toggleMute"));
    this.unmute.addEventListener("click", mediaControlHandler("toggleMute"));
    this.next.addEventListener("click", mediaControlHandler("nextTrack"));
    this.prev.addEventListener("click", mediaControlHandler("prevTrack"));

    this.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }

      window.CompanionUtils.sendAsyncMessage("Companion:FocusBrowser", {
        browserId: this.tab.browserId,
      });
    });
    this.pip.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }
      event.stopPropagation();

      window.CompanionUtils.sendAsyncMessage("Companion:LaunchPip", {
        browserId: this.tab.browserId,
      });
    });
  }

  get artwork() {
    return this.querySelector(".artwork");
  }
  get artworkBackground() {
    return this.querySelector(".artwork-background");
  }
  get title() {
    return this.querySelector(".title");
  }
  get artist() {
    return this.querySelector(".artist");
  }
  get playPause() {
    return this.querySelector(".play-pause button");
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
    let hasMedia =
      (this.tab.canTogglePip || this.tab.soundPlaying) && this.tab.title;
    let metadata = this.tab.media.metadata;

    if (!metadata || !hasMedia) {
      this.hidden = true;
      return;
    }

    let artwork = metadata?.artwork[0]
      ? "url(" + metadata.artwork[0].src + ")"
      : "";
    this.title.textContent = metadata.title ?? this.tab.title;
    this.artist.textContent = metadata.artist ?? "";
    this.artwork.style.backgroundImage = artwork;
    this.artworkBackground.style.backgroundImage = artwork;

    let supportedKeys = this.tab.media.supportedKeys;
    if (
      !supportedKeys.includes("play") ||
      !supportedKeys.includes("pause") ||
      !metadata
    ) {
      // Only offer play/pause option if the site supports both
      // options.
      this.playPause.hidden = true;
    } else {
      this.playPause.dataset.state = this.tab.media.isPlaying
        ? "playing"
        : "paused";
    }

    this.mute.hidden = this.tab.audioMuted;
    this.unmute.hidden = !this.tab.audioMuted;

    this.prev.hidden = !supportedKeys.includes("previoustrack");
    this.next.hidden = !supportedKeys.includes("nexttrack");

    this.pip.hidden = !this.tab.canTogglePip;
  }
}

customElements.define("e-media-list", MediaList);
customElements.define("e-media", Media);
