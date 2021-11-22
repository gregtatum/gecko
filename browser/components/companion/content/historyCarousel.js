/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global CarouselUtils */
// CarouselUtils is exposed to us from HistoryCarouselChild.jsm.

/**
 * The INTERSECTION_THRESHOLD_FOR_CURRENT is the threshold value passed to
 * the IntersectionObserver for PreviewElements. An intersection amount
 * greater than this value qualifies the PreviewElement as "current". This
 * should be greater than 0.5 so that no more than 1 entry can be "current".
 */
const INTERSECTION_THRESHOLD_FOR_CURRENT = 0.6; // From 0.0 to 1.0

/**
 * PreviewElement is a customElement that subclasses <li>, and represents
 * a single entry in the carousel.
 */
class PreviewElement extends HTMLLIElement {
  static get observedAttributes() {
    return ["title", "url", "iconURL"];
  }

  #image = null;
  #caption = null;
  #favicon = null;

  connectedCallback() {
    let template = document.querySelector("#preview-element-template");
    this.appendChild(template.content.cloneNode(true));
    this.#image = this.querySelector(".preview-image");
    this.#caption = this.querySelector(".caption");
    this.#favicon = this.querySelector(".favicon");
    this.#updateFromAttributes();
  }

  setBlob(blob) {
    this.#image.src = URL.createObjectURL(blob);
  }

  setWireframe(wireframe) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    let svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("preview-image");

    svg.setAttributeNS(
      null,
      "viewBox",
      `0 0 ${wireframe.width} ${wireframe.height}`
    );
    svg.style.backgroundColor = wireframe.canvasBackground;

    for (let rectObj of wireframe.rects) {
      let rectEl = document.createElementNS(SVG_NS, "rect");
      rectEl.setAttribute("x", rectObj.rect.x);
      rectEl.setAttribute("y", rectObj.rect.y);
      rectEl.setAttribute("width", rectObj.rect.width);
      rectEl.setAttribute("height", rectObj.rect.height);

      if (rectObj.type == "background") {
        rectEl.setAttribute("fill", rectObj.color);
      } else if (rectObj.type == "text") {
        rectEl.setAttribute(
          "fill",
          "color-mix(in srgb, black 10%, transparent)"
        );
      }

      svg.appendChild(rectEl);
    }
    this.#image.parentNode.replaceChild(svg, this.#image);
    this.#image = svg;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.isConnected) {
      this.#updateFromAttributes();
    }
  }

  #updateFromAttributes() {
    this.#caption.textContent = this.getAttribute("title");
    this.#caption.title = this.getAttribute("url");
    this.#favicon.src = this.getAttribute("iconURL");
  }
}

// With mousewheel.autodir.enabled set to `true`, we get the vertical scroll
// behaviour that we want, but in the opposite direction. Need to work with
// APZ folks to sort this out. Tracked by
// https://mozilla-hub.atlassian.net/browse/MR2-1336

customElements.define("preview-element", PreviewElement, { extends: "li" });

/**
 * The window global HistoryCarousel object does all of the set up of the
 * carousel and manages all of its state.
 */
const HistoryCarousel = {
  /**
   * The list of message events that we can expect from HistoryCarouselChild.
   * These get event listeners set up for them, and are then handled in
   * handleMessageEvent.
   */
  MESSAGE_EVENTS: [
    "HistoryCarousel:Setup",
    "HistoryCarousel:SelectCurrentIndex",
  ],

  /**
   * The list of DOM events that we listen for on this page. These get event
   * listeners set up for them, and are then handled in handleDOMEvent.
   */
  DOM_EVENTS: ["visibilitychange", "click", "keydown", "change"],

  /**
   * An Array that contains the list of View indexes that still need
   * image data downloaded for them. These are in reverse order, so the
   * next download in the queue should occur for the index returned by
   * previewTaskQueue.pop().
   */
  previewTaskQueue: [],

  /**
   * A cache of the total number of previews that comes down from the parent
   * process during setup. Defaults to -1 until setup is complete.
   */
  totalPreviews: -1,

  /**
   * A convenience getter for the main <ol> element that contains each
   * PreviewElement.
   *
   * @type {Element}
   */
  get list() {
    delete this.list;
    this.list = document.getElementById("preview-list");
    return this.list;
  },

  /**
   * A convenience getter for the scrubber range input element.
   *
   * @type {Element}
   */
  get scrubber() {
    delete this.scrubber;
    this.scrubber = document.getElementById("scrubber");
    return this.scrubber;
  },

  /**
   * A convenience getter for the "previous" button next to the scrubber.
   *
   * @type {Element}
   */
  get previousBtn() {
    delete this.previousBtn;
    this.previousBtn = document.getElementById("previous");
    return this.previousBtn;
  },

  /**
   * A convenience getter for the "previous" button next to the scrubber.
   *
   * @type {Element}
   */
  get nextBtn() {
    delete this.nextBtn;
    this.nextBtn = document.getElementById("next");
    return this.nextBtn;
  },

  /**
   * The initialization function for HistoryCarousel. This should be called
   * once the document and its resources have finished loading.
   */
  init() {
    document.dispatchEvent(
      new CustomEvent("HistoryCarouselInit", { bubbles: true })
    );
    for (let messageEventType of this.MESSAGE_EVENTS) {
      addEventListener(messageEventType, this);
    }
    for (let domEventType of this.DOM_EVENTS) {
      addEventListener(domEventType, this);
    }
  },

  /**
   * Handler for both HistoryCarouselChild message events and DOM events.
   *
   * @param {Event} event
   *   The event being handled.
   */
  handleEvent(event) {
    if (this.MESSAGE_EVENTS.includes(event.type)) {
      this.handleMessageEvent(event);
    } else {
      this.handleDOMEvent(event);
    }
  },

  /**
   * Handles events in the MESSAGE_EVENTS array.
   *
   * @param {Event} event
   *   The message event being handled.
   */
  handleMessageEvent(event) {
    switch (event.type) {
      case "HistoryCarousel:Setup": {
        this.setup();
        break;
      }
      case "HistoryCarousel:SelectCurrentIndex": {
        this.selectCurrentIndex(event.detail.index);
        break;
      }
    }
  },

  /**
   * Handles events in the DOM_EVENTS array.
   *
   * @param {Event} event
   *   The DOM event being handled.
   */
  handleDOMEvent(event) {
    switch (event.type) {
      case "change": {
        this.onChange(event);
        break;
      }
      case "click": {
        this.onClick(event);
        break;
      }
      case "keydown": {
        this.onKeyDown(event);
        break;
      }
      case "visibilitychange": {
        this.onVisibilityChange(event);
        break;
      }
    }
  },

  // Message event handler functions

  /**
   * Called after we have received enough information from the parent
   * process to construct the initial state of the carousel. This function
   * does any initial setting up of the DOM for the PreviewElement list.
   */
  setup() {
    let frag = document.createDocumentFragment();
    let previews = CarouselUtils.getInitialPreviews();
    let currentIndex = CarouselUtils.getCurrentIndex();
    let currentPreview = null;

    this.totalPreviews = previews.length;
    let root = document.documentElement;
    root.style.setProperty("--total-previews", this.totalPreviews);

    let fn = this.onIntersection.bind(this);
    this.intersectionObserver = new IntersectionObserver(fn, {
      root: this.list,
      threshold: INTERSECTION_THRESHOLD_FOR_CURRENT,
    });

    for (let i = 0; i < previews.length; ++i) {
      let previewEl = document.createElement("li", { is: "preview-element" });
      previewEl.setAttribute("index", i);
      previewEl.setAttribute("title", previews[i].title);
      previewEl.setAttribute("url", previews[i].url);
      previewEl.setAttribute("iconURL", previews[i].iconURL);
      frag.appendChild(previewEl);
      this.intersectionObserver.observe(previewEl);

      if (i == currentIndex) {
        currentPreview = previewEl;
      }
    }

    this.list.appendChild(frag);

    // Pre-populate the previewTaskQueue with the indexes of each preview.
    // This will get re-sorted in updateCurrentIndex.
    this.previewTaskQueue = Array.from(Array(previews.length).keys());
    this.updateCurrentIndex(currentIndex);

    // Now start fetching the first item in the task queue. This kicks off
    // a recursive process that will continue to drain the task queue until
    // it's empty.
    this.kickTaskQueue();

    // We have enough information at this point to render the current preview,
    // so do so and snap it into the viewport if it's not already there.
    currentPreview.setBlob(previews[currentIndex].image);
    currentPreview.scrollIntoView({ behavior: "instant", inline: "center" });

    this.scrubber.setAttribute("max", previews.length - 1);
    this.scrubber.value = currentIndex;
  },

  /**
   * The IntersectionObserver handler for PreviewElements. This is used
   * to update the internal notion of which PreviewElement is "current"
   * based on its overlap with the visible viewport.
   *
   * @param {IntersectionObserverEntry[]}
   */
  onIntersection(entries) {
    for (let entry of entries) {
      if (entry.isIntersecting) {
        let previewEl = entry.target;
        let index = parseInt(previewEl.getAttribute("index"), 10);
        if (CarouselUtils.getCurrentIndex() != index) {
          CarouselUtils.selectCurrentIndex(index);
        }
        this.updateCurrentIndex(index);
        // We presume only 1 entry can be considered current at a time,
        // so after finding the first intersection we bail out.
        break;
      }
    }
  },

  /**
   * Updates HistoryCarousel's internal notion of what the current
   * PreviewElement index is. This results in the "current" and
   * "beforecurrent" attributes being set on the appropriate PreviewElement
   * elements, and also triggers a re-sort of the previewTaskQueue based
   * on the new current.
   *
   * @param {Number} index
   *   The index of the new current PreviewElement.
   */
  updateCurrentIndex(index) {
    let oldCurrentPreviewEl = this.list.querySelector("li[current]");
    let oldBeforePreviewEl = oldCurrentPreviewEl?.previousElementSibling;

    if (oldCurrentPreviewEl) {
      oldCurrentPreviewEl.removeAttribute("current");
    }

    if (oldBeforePreviewEl) {
      oldBeforePreviewEl.removeAttribute("beforecurrent");
    }

    let previewEl = document.querySelector(`li[index="${index}"]`);
    let beforePreviewEl = previewEl.previousElementSibling;
    previewEl.setAttribute("current", "true");
    if (beforePreviewEl) {
      beforePreviewEl.setAttribute("beforecurrent", "true");
    }

    // The previewTaskQueue's job is to be an ordered list of indexes
    // for which we want to request the preview images for. That ordering
    // is related to the "current" PreviewElement: the priority should be
    // to load the current PreviewElement's image, followed by the images
    // for the PreviewElements immediately next to it, followed by the
    // images immediately next to those, and so-on. This is sometimes called
    // a "distance" sort.
    //
    // We need to update this sorting because the user is not prevented
    // from changing the "current" PreviewElement while the images are still
    // loading.
    //
    // This sorting algorithm sorts by distance from index in reverse order
    // so that the highest priority index can be retrieved via
    // this.previewTaskQueue.pop().
    this.previewTaskQueue.sort(
      (a, b) => Math.abs(index - b) - Math.abs(index - a)
    );

    this.scrubber.value = index;
    this.previousBtn.toggleAttribute("disabled", index == 0);
    this.nextBtn.toggleAttribute("disabled", index == this.totalPreviews - 1);
    document.dispatchEvent(
      new CustomEvent("HistoryCarouselIndexUpdated", {
        bubbles: true,
        detail: index,
      })
    );
  },

  /**
   * Starts the next load from the previewTaskQueue. This needs to be called
   * once manually, and after that it will automatically be called after each
   * image load until the queue is fully drained.
   */
  kickTaskQueue() {
    let index = this.previewTaskQueue.pop();
    if (index !== undefined) {
      CarouselUtils.requestPreview(index).then(result => {
        if (result) {
          let preview = document.querySelector(`li[index="${index}"`);
          preview.setAttribute("title", result.title);
          preview.setAttribute("url", result.url);
          preview.setAttribute("iconURL", result.iconURL);
          if (result.image.blob) {
            preview.setBlob(result.image.blob);
          } else if (result.image.wireframe) {
            preview.setWireframe(result.image.wireframe);
          }
        }
        this.kickTaskQueue();
      });
    } else {
      document.dispatchEvent(
        new CustomEvent("HistoryCarouselReady", { bubbles: true })
      );
    }
  },

  /**
   * Scrolls the PreviewElement with a particular index into the center
   * of the viewport.
   *
   * @param {Number} index
   *   The index of the PreviewElement to scroll into view.
   * @param {Boolean} [instant]
   *   If set to true, the selected index does an instant scroll into the
   *   viewport.
   */
  selectCurrentIndex(index, instant = false) {
    let previewEl = document.querySelector(`li[index="${index}"]`);
    let behavior = instant ? "instant" : "smooth";
    previewEl.scrollIntoView({ behavior, inline: "center" });
  },

  // DOM event handlers

  /**
   * Handles change events on the whole window.
   *
   * @param {Event} event
   *   The change event to handle.
   */
  onChange(event) {
    if (event.target == this.scrubber) {
      let index = Math.round(this.scrubber.value);
      this.selectCurrentIndex(index, true /* instant */);
    }
  },

  /**
   * Handles click events on the whole window.
   *
   * @param {MouseEvent} event
   *   The click event to handle.
   */
  onClick(event) {
    switch (event.target) {
      case this.previousBtn: {
        let index = CarouselUtils.getCurrentIndex();
        if (index > 0) {
          this.selectCurrentIndex(index - 1, true /* instant */);
        }
        break;
      }
      case this.nextBtn: {
        let index = CarouselUtils.getCurrentIndex();
        if (index < this.totalPreviews - 1) {
          this.selectCurrentIndex(index + 1, true /* instant */);
        }
        break;
      }
      default: {
        let previewEl = event.target.closest("li");
        if (previewEl) {
          let index = parseInt(previewEl.getAttribute("index"), 10);
          if (CarouselUtils.getCurrentIndex() == index) {
            CarouselUtils.requestExit();
          }
        }
      }
    }
  },

  /**
   * Handles keydown events on the whole window.
   *
   * @param {KeyEvent} event
   *   The click event to handle.
   */
  onKeyDown(event) {
    if (
      event.keyCode == KeyEvent.DOM_VK_ESCAPE ||
      event.keyCode == KeyEvent.DOM_VK_RETURN
    ) {
      CarouselUtils.requestExit();
    }
  },

  /**
   * Handles changes to the document visibility. This is currentl
   * used to show the "shrinking" animation when the carousel first
   * becomes visible.
   *
   * @param {Event} event
   *   The visibilitychange event to handle.
   */
  onVisibilityChange(event) {
    if (!document.hidden) {
      document.body.removeAttribute("invisible");
    }
  },
};

addEventListener(
  "load",
  () => {
    HistoryCarousel.init();
  },
  { once: true }
);
