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
    this.#image.addEventListener("load", this);
  }

  handleEvent(event) {
    if (event.type != "load") {
      return;
    }

    this.dispatchEvent(new CustomEvent("load"));
  }

  setBlob(blob) {
    this.#image.src = URL.createObjectURL(blob);
  }

  setWireframe(wireframe, width, height) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    let svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("preview-image");

    svg.setAttributeNS(null, "viewBox", `0 0 ${width} ${height}`);
    svg.style.backgroundColor = wireframe.canvasBackground;

    for (let rectObj of wireframe.rects) {
      if (rectObj.type != "background" && rectObj.type != "text") {
        continue;
      }

      let rectEl = document.createElementNS(SVG_NS, "rect");
      rectEl.setAttribute("x", rectObj.x);
      rectEl.setAttribute("y", rectObj.y);
      rectEl.setAttribute("width", rectObj.width);
      rectEl.setAttribute("height", rectObj.height);

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

  get index() {
    return parseInt(this.getAttribute("index"), 10);
  }

  #updateFromAttributes() {
    this.#caption.textContent = this.getAttribute("title");
    this.#caption.title = this.getAttribute("url");
    this.#favicon.src = this.getAttribute("iconURL");
  }
}

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
  MESSAGE_EVENTS: ["HistoryCarousel:Setup", "HistoryCarousel:SelectIndex"],

  /**
   * The list of DOM events that we listen for on this page. These get event
   * listeners set up for them, and are then handled in handleDOMEvent.
   */
  DOM_EVENTS: ["visibilitychange", "click", "keydown", "input"],

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
   * A cache of the originally selected index. We hold onto this in case the
   * user wants to revert back to the originally selected View. Defaults to
   * -1 until setup is complete.
   */
  originalIndex: -1,

  /**
   * This is set to the index that the user has selected either via the
   * scrubber or the AVM. Once the associated preview has intersected
   * the viewport, this is reset to -1.
   */
  selectedIndex: -1,

  /**
   * These are set to the min/max index property on the previews sent down
   * from the parent process.
   */
  minIndex: -1,
  maxIndex: -1,

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
    this.scrubber.focus({ preventFocusRing: true });

    this.whenVisible = new Promise(resolve => {
      this.whenVisibleResolver = resolve;
    });

    // Forcing autodir behaviour on the list allows users to scroll it
    // horizontally while using vertical mousewheel events.
    window.windowUtils.setMousewheelAutodir(this.list, true, true);
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
      case "HistoryCarousel:SelectIndex": {
        this.selectIndex(event.detail.index);
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
      case "input": {
        this.onInput(event);
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
  async setup() {
    let frag = document.createDocumentFragment();
    let previews = CarouselUtils.getInitialPreviews();
    let currentIndex = CarouselUtils.getCurrentIndex();

    this.originalIndex = currentIndex;

    this.totalPreviews = previews.length;
    let root = document.documentElement;
    root.style.setProperty("--total-previews", this.totalPreviews);

    let fn = this.onIntersection.bind(this);
    this.intersectionObserver = new IntersectionObserver(fn, {
      root: this.list,
      threshold: INTERSECTION_THRESHOLD_FOR_CURRENT,
    });

    // We'll populate the previewTaskQueue with the indexes of each preview
    // during the next loop. This queue will get re-sorted in the subsequent
    // updateCurrentIndex call.
    this.previewTaskQueue = [];
    let currentPreview = null;
    let currentPreviewEl = null;

    for (let preview of previews) {
      let previewEl = document.createElement("li", { is: "preview-element" });

      let index = preview.index;
      previewEl.setAttribute("index", index);
      this.previewTaskQueue.push(index);

      previewEl.setAttribute("title", preview.title);
      previewEl.setAttribute("url", preview.url);
      previewEl.setAttribute("iconURL", preview.iconURL);

      frag.appendChild(previewEl);
      this.intersectionObserver.observe(previewEl);

      if (index == currentIndex) {
        currentPreview = preview;
        currentPreviewEl = previewEl;
      }
    }

    this.list.appendChild(frag);
    this.updateCurrentIndex(currentIndex);

    // Now start fetching the first item in the task queue. This kicks off
    // a recursive process that will continue to drain the task queue until
    // it's empty.
    this.kickTaskQueue();

    // We have enough information at this point to render the current preview,
    // so do so and snap it into the viewport if it's not already there.
    currentPreviewEl.setBlob(currentPreview.image);
    currentPreviewEl.scrollIntoView({ behavior: "instant", inline: "center" });
    this.minIndex = previews[0].index;
    this.maxIndex = previews[previews.length - 1].index;

    this.scrubber.setAttribute("min", this.minIndex);
    this.scrubber.setAttribute("max", this.maxIndex);
    this.scrubber.value = currentIndex;

    await new Promise(resolve => {
      currentPreviewEl.addEventListener("load", resolve, {
        once: true,
      });
    });

    CarouselUtils.ready();
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
        let index = previewEl.index;

        // If selectedIndex is not -1, this means that the user has selected
        // a preview either via the scrubber or the AVM. If then the index of
        // what has just intersected doesn't match selectedIndex, that means
        // we're in the midst of smooth scrolling to that index, and we should
        // just ignore the intersection.
        if (this.selectedIndex > -1 && this.selectedIndex != index) {
          continue;
        }

        // If we get here, then either the user caused the intersection by
        // scrolling, or we reached the selectedIndex.
        this.selectedIndex = -1;

        if (CarouselUtils.getCurrentIndex() != index) {
          CarouselUtils.setCurrentIndex(index);
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
    this.previousBtn.toggleAttribute("disabled", index == this.minIndex);
    this.nextBtn.toggleAttribute("disabled", index == this.maxIndex);
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
            preview.setWireframe(
              result.image.wireframe,
              result.image.width,
              result.image.height
            );
          }
        }
        this.kickTaskQueue();
      });
    } else {
      this.whenVisible.then(() => {
        document.dispatchEvent(
          new CustomEvent("HistoryCarouselReady", { bubbles: true })
        );
      });
    }
  },

  /**
   * Scrolls the PreviewElement with a particular index into the center
   * of the viewport. This is called whenever the selection isn't occurring
   * via the "natural" scrolling of the previews, but is instead performed
   * by either the scrubber or via the AVM.
   *
   * @param {Number} index
   *   The index of the PreviewElement to scroll into view.
   * @param {Boolean} [instant]
   *   If set to true, the selected index does an instant scroll into the
   *   viewport.
   */
  selectIndex(index, instant = false) {
    let previewEl = document.querySelector(`li[index="${index}"]`);
    let behavior = instant ? "instant" : "smooth";
    previewEl.scrollIntoView({ behavior, inline: "center" });
    this.selectedIndex = index;
  },

  // DOM event handlers

  /**
   * Handles input events on the whole window.
   *
   * @param {Event} event
   *   The input event to handle.
   */
  onInput(event) {
    if (event.target == this.scrubber) {
      let index = Math.round(this.scrubber.value);
      this.selectIndex(index, false /* instant */);
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
          this.selectIndex(index - 1, false /* instant */);
        }
        break;
      }
      case this.nextBtn: {
        let index = CarouselUtils.getCurrentIndex();
        if (index < this.maxIndex) {
          this.selectIndex(index + 1, false /* instant */);
        }
        break;
      }
      default: {
        let previewEl = event.target.closest("li");
        if (previewEl) {
          if (CarouselUtils.getCurrentIndex() == previewEl.index) {
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
    switch (event.keyCode) {
      case KeyEvent.DOM_VK_ESCAPE: {
        this.selectIndex(this.originalIndex, true /* instant */);
        // We need to ensure that the IntersectionObserver fires, and the
        // parent has acknowledged receipt of the updated index before we
        // finally exit.
        addEventListener(
          "HistoryCarouselIndexUpdated",
          () => {
            CarouselUtils.requestExit();
          },
          { once: true }
        );
        break;
      }
      case KeyEvent.DOM_VK_RETURN: {
        CarouselUtils.requestExit();
        break;
      }
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
      addEventListener(
        "transitionend",
        () => {
          this.whenVisibleResolver();
        },
        { once: true }
      );
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
