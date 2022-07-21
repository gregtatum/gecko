/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

window.addEventListener("DOMContentLoaded", () => {
  // The arguments are passed in as the final parameters to TabDialogBox.prototype.open.
  new ImageTools(...window.arguments);
});

/**
 * @typedef {Object} ImageInfo
 * @property {string} currentSrc
 * @property {string} imageText
 * @property {number} height
 * @property {number} width
 */

/**
 * @typedef {Object} Quad
 * @property {{ x: number, y: number }} p1
 * @property {{ x: number, y: number }} p2
 * @property {{ x: number, y: number }} p3
 * @property {{ x: number, y: number }} p4
 */

/**
 * @typedef {Object} TextRecognitionResult
 * @property {number} confidence
 * @property {string} string
 * @property {Quad} string
 */

class ImageTools {
  /** @type {null | string} */
  text = null;

  /**
   * @param {ImageInfo} imageInfo
   */
  constructor(imageInfo) {
    this.imageInfo = imageInfo;

    /** @type {HTMLDivElement} */
    this.imageEl = document.querySelector(".imageToolsImage");

    /** @type {HTMLDivElement} */
    this.textEl = document.querySelector(".imageToolsText");

    this.setupImage();
  }

  setupImage() {
    const { imageInfo, imageEl } = this;
    const img = document.createElement("img");
    img.onload = async () => {
      /** @type {TextRecognitionResult[]} */
      const results = await img.recognizeCurrentImageText();
      this.textEl.innerText = results.map(({ string }) => string).join(" ");
      // TODO - Remove this. This is a hack to remove the shadow root functionality.
      img.openOrClosedShadowRoot.children[0].remove();
    };
    img.src = imageInfo.currentSrc;
    img.width = imageInfo.width;
    img.height = imageInfo.height;
    img.setAttribute("alt", imageInfo.imageText);
    imageEl.appendChild(img);
  }
}
