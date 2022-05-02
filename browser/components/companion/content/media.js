/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { getListDiff } from "./listDiff.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const allowMute = Services.prefs.getBoolPref(
  "browser.companion.media.mute.enabled",
  false
);

export class MediaList extends HTMLElement {
  constructor(title) {
    super();

    this.title = title;
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-media-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;

    this.muteAll = fragment.querySelector(".mute-all");
    if (allowMute) {
      // TODO: the Mute All functionality isn't working right so it's hidden for now.
      // It's either due to some distinction between a tab being muted and the underlying
      // media elements being muted or just some bugs here
      this.muteAll.addEventListener("click", () => {
        if (this.muteAll.hasAttribute("disabled")) {
          return;
        }
        window.CompanionUtils.sendAsyncMessage("Companion:MuteAllTabs", null);
      });
    } else {
      this.muteAll.remove();
    }

    shadow.appendChild(fragment);

    this.trackedControllers = new WeakSet();
    this.trackedTabs = new WeakSet();
    this.windowListener = () => this.render();
  }

  connectedCallback() {
    window.addEventListener("Companion:TabAddedOrUpdated", this.windowListener);
    window.addEventListener("Companion:TabRemoved", this.windowListener);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener(
      "Companion:TabAddedOrUpdated",
      this.windowListener
    );
    window.removeEventListener("Companion:TabRemoved", this.windowListener);
  }

  get tabs() {
    return window.CompanionUtils.tabs();
  }

  get allActiveMediaChildren() {
    return this.querySelectorAll("e-media:not([hidden])");
  }

  render() {
    let transform = getListDiff(
      this.children,
      [...this.tabs].filter(t => t.media),
      c => c.tab.browserId,
      t => t.browserId
    );

    let children = [];
    for (let t of transform) {
      switch (t.type) {
        case "insertion": {
          children.push(new Media(t.data));
          break;
        }
        case "move": {
          // Updating the node rather than re-rendering it allows us to
          // maintain continuity of focus.
          let media = this.children[t.oldIndex];
          media.update(t.data);
          children.push(media);
          break;
        }
        case "deletion": {
          // We do nothing right now on deletion. The node will get cleaned up
          // via this.replaceChildren. However, we may in the future want to
          // animate media out, in which case we'll want to keep a tombstone
          // element around to animate, and remove it on animation end.
          break;
        }
        default: {
          console.error(`Unexpected transform type: ${t.type}`);
          break;
        }
      }
    }

    // There's ultimately nothing we can do to perfectly retain focus when
    // elements are moving around. We could try to use the minimal number of
    // this.insertBefore(...) calls, to avoid removing elements from the DOM
    // when possible, but ultimately if the order of children change, at least
    // one of them needs to be removed and re-added, which will drop focus. So,
    // we just remember what was focused before the reordering, and try to
    // focus that afterward. If it was removed, then this will simply do
    // nothing.
    let focused = document.activeElement;
    this.replaceChildren(...children);
    focused.focus();

    if (this.allActiveMediaChildren.length) {
      this.removeAttribute("hidden");
      if (allowMute) {
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
    if (allowMute) {
      this.mute.addEventListener("click", mediaControlHandler("toggleMute"));
      this.unmute.addEventListener("click", mediaControlHandler("toggleMute"));
    }
    this.next.addEventListener("click", mediaControlHandler("nextTrack"));
    this.prev.addEventListener("click", mediaControlHandler("prevTrack"));

    this.addEventListener("click", event => {
      if (event.button != 0) {
        return;
      }

      window.CompanionUtils.sendAsyncMessage("Companion:FocusTab", {
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

  update(tab) {
    this.tab = tab;
    this.render();
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
    let metadata = this.tab.media.metadata;

    if (!metadata) {
      this.hidden = true;
      return;
    }
    this.hidden = false;

    let artwork = metadata?.artwork[0]
      ? "url(" + metadata.artwork[0].src + ")"
      : "";
    this.title.textContent = metadata?.title ?? this.tab.title;
    this.artist.textContent = metadata?.artist ?? "";
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
      document.l10n.setAttributes(
        this.playPause,
        this.tab.media.isPlaying
          ? "videocontrols-pause-button"
          : "videocontrols-play-button"
      );
    }

    this.mute.hidden = !allowMute || this.tab.audioMuted;
    this.unmute.hidden = !allowMute || !this.tab.audioMuted;

    this.prev.hidden = !supportedKeys.includes("previoustrack");
    this.next.hidden = !supportedKeys.includes("nexttrack");

    this.pip.hidden = !this.tab.canTogglePip;
  }
}

customElements.define("e-media-list", MediaList);
customElements.define("e-media", Media);
