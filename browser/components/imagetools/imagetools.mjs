/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ourBrowser = window.docShell.chromeEventHandler;
ourBrowser
  .closest(".dialogBox")
  ?.classList.add("imageToolsDialogBox", "noShadow");
ourBrowser.closest(".dialogOverlay")?.classList.add("imageToolsDialogOverlay");
ourBrowser.classList.add("imageToolsDialogFrame");

const contentEl = ourBrowser
  .closest(".browserStack")
  .querySelector('browser[type="content"]');

contentEl?.classList.add("imageToolsContentArea");

window.addEventListener("DOMContentLoaded", () => {
  // The arguments are passed in as the final parameters to TabDialogBox.prototype.open.
  new ImageTools(...window.arguments);
});

window.addEventListener("unload", () => {
  contentEl?.classList.remove("imageToolsContentArea");
});

/**
 * @typedef {Object} ImageInfo
 * @property {string} currentSrc
 * @property {string} imageText
 * @property {number} height
 * @property {number} width
 */

/**
 * @typedef {Object} TextRecognitionResult
 * @property {number} confidence
 * @property {string} string
 * @property {DOMQuad} quad
 */

class ImageTools {
  /** @type {null | string} */
  text = null;

  /**
   * @param {Promise<TextRecognitionResult[]>} results
   * @param {() => {}} resizeVertically
   * @param {ImageInfo} imageInfo
   */
  constructor(results, resizeVertically, imageInfo) {
    this.imageInfo = imageInfo;

    /** @type {HTMLElement} */
    this.textEl = document.querySelector(".imageToolsText");

    /** @type {HTMLElement} */
    this.loadingEL = document.querySelector(".imageToolsTextLoading");

    /** @type {NodeListOf<HTMLElement>} */
    this.headerEls = document.querySelectorAll(".imageToolsHeader")

    this.showHeaderByID("image-tools-header-loading");

    results.then(
      results => {
        if (results.length === 0) {
          this.showHeaderByID("image-tools-header-no-results");
          return;
        }
        this.runClusteringAndUpdateUI(results)
        this.showHeaderByID("image-tools-header-results");
        resizeVertically();
      },
      error => {
        console.error(error);
        this.showHeaderByID("image-tools-header-no-results");
      }
    );

    document
      .querySelector("#image-tools-close")
      .addEventListener("click", () => {
        window.close();
      });
  }

  /**
   * @param {string} id
   */
  showHeaderByID(id) {
    for (const header of this.headerEls) {
      header.hidden = true;
    }

    document.getElementById(id).hidden = false;
  }

  /**
   * @param {string} text
   */
  copy(text) {
    const clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(text);
  };

  /**
   * Cluster the text based on its visual position.
   *
   * @param {TextRecognitionResult[]} results
   * @param {"ltr" | "rtl"} direction
   */
  runClusteringAndUpdateUI(results, direction = "ltr") {
    /** @type {Vec2[]} */
    const centers = [];

    for (const result of results) {
      const p = result.quad;

      // Pick either the left-most or right-most edge. This optimizes for
      // aligned text over centered text.
      const minOrMax = direction === "ltr" ? Math.min : Math.max;

      centers.push([
        minOrMax(p.p1.x, p.p2.x, p.p3.x, p.p4.x),
        (p.p1.y, p.p2.y, p.p3.y, p.p4.y) / 4,
      ]);
    }

    const distSq = new DistanceSquared(centers);

    // The values are ranged 0 - 1. This value might be able to be determined
    // algorithmically.
    const averageDistance = Math.sqrt(distSq.quantile(0.2));
    const clusters = densityCluster(
      centers,
      // Neighborhood radius:
      averageDistance,
      // Minimum points to form a cluster:
      2
    );

    let text = "";
    for (const cluster of clusters) {
      const pCluster = document.createElement("p");
      pCluster.className = "imageToolsTextCluster";

      for (let i = 0; i < cluster.length; i++) {
        const index = cluster[i];
        // Each cluster could be a paragraph, so add a newline to the end
        // for better copying.
        const ending = i + 1 === cluster.length ? "\n" : " ";

        const span = document.createElement("span");
        const result = results[index];
        span.innerText = result.string + ending;
        pCluster.appendChild(span);
        text += this.text += span.innerText;
      }
      this.textEl.appendChild(pCluster);
    }

    this.copy(text);
  }
}

/**
 * A two dimensional vector.
 *
 * @typedef {[number, number]} Vec2
 */

/**
 * @typedef {number} PointIndex
 */

/**
 * An implementation of the DBSCAN clustering algorithm.
 *
 * https://en.wikipedia.org/wiki/DBSCAN#Algorithm
 *
 * @param {Vec2[]} points
 * @param {number} distance
 * @param {number} minPoints
 * @returns {Array<PointIndex[]>}
 */
function densityCluster(points, distance, minPoints) {
  /**
   * A flat of array of labels that match the index of the points array. The values have
   * the following meaning:
   *
   *   undefined := No label has been assigned
   *   "noise"   := Noise is a point that hasn't been clustered.
   *   number    := Cluster index
   *
   * @type {undefined | "noise" | Index}
   */
  const labels = Array(points.length);
  const noiseLabel = "noise";

  let nextClusterIndex = 0;

  // Every point must be visited at least once. Often they will be visited earlier
  // in the interior of the loop.
  for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
    if (labels[pointIndex] !== undefined) {
      // This point is already labeled from the interior logic.
      continue;
    }

    // Get the neighbors that are within the range of the epsilon value, includes
    // the current point.
    const neighbors = getNeighborsWithinDistance(points, distance, pointIndex);

    if (neighbors.length < minPoints) {
      labels[pointIndex] = noiseLabel;
      continue;
    }

    // Start a new cluster.
    const clusterIndex = nextClusterIndex++;
    labels[pointIndex] = clusterIndex;

    // Fill the cluster. The neighbors array grows.
    for (let i = 0; i < neighbors.length; i++) {
      const nextPointIndex = neighbors[i];
      if (typeof labels[nextPointIndex] === "number") {
        // This point was already claimed, ignore it.
        continue;
      }

      if (labels[nextPointIndex] === noiseLabel) {
        // Claim this point and move on since noise has no neighbors.
        labels[nextPointIndex] = clusterIndex;
        continue;
      }

      // Claim this point as part of this cluster.
      labels[nextPointIndex] = clusterIndex;

      const newNeighbors = getNeighborsWithinDistance(
        points,
        distance,
        nextPointIndex
      );

      if (newNeighbors.length >= minPoints) {
        // Add on to the neighbors if more are found.
        for (const newNeighbor of newNeighbors) {
          if (!neighbors.includes(newNeighbor)) {
            neighbors.push(newNeighbor);
          }
        }
      }
    }
  }

  const clusters = [];

  // Pre-populate the clusters.
  for (let i = 0; i < nextClusterIndex; i++) {
    clusters[i] = [];
  }

  // Turn the labels into clusters, adding the noise to the end.
  for (let pointIndex = 0; pointIndex < labels.length; pointIndex++) {
    const label = labels[pointIndex];
    if (typeof label === "number") {
      clusters[label].push(pointIndex);
    } else if (label === noiseLabel) {
      // Add a single cluster.
      clusters.push([pointIndex]);
    } else {
      throw new Error("Logic error. Expected every point to have a label.");
    }
  }

  clusters.sort((a, b) => points[b[0]][1] - points[a[0]][1]);

  return clusters;
}

/**
 * @param {Vec2[]} points
 * @param {number} distance
 * @param {number} index,
 * @returns {Index[]}
 */
function getNeighborsWithinDistance(points, distance, index) {
  let neighbors = [index];
  // There is no reason to compute the square root here if we square the
  // original distance.
  const distanceSquared = distance * distance;

  for (let otherIndex = 0; otherIndex < points.length; otherIndex++) {
    if (otherIndex === index) {
      continue;
    }
    const a = points[index];
    const b = points[otherIndex];
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];

    if (dx * dx + dy * dy < distanceSquared) {
      neighbors.push(otherIndex);
    }
  }

  return neighbors;
}

class DistanceSquared {
  /** @type {Map<number>} */
  #distances = new Map();
  #list;
  #distancesSorted;

  /**
   * @param {Vec2[]} list
   */
  constructor(list) {
    this.#list = list;
    for (let aIndex = 0; aIndex < list.length; aIndex++) {
      for (let bIndex = aIndex + 1; bIndex < list.length; bIndex++) {
        const id = this.#getTupleID(aIndex, bIndex);
        const a = this.#list[aIndex];
        const b = this.#list[bIndex];
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        this.#distances.set(id, dx * dx + dy * dy);
      }
    }
  }

  /**
   * Returns a unique tuple ID to identify the relationship between two vectors.
   */
  #getTupleID(aIndex, bIndex) {
    return aIndex < bIndex
      ? aIndex * this.#list.length + bIndex
      : bIndex * this.#list.length + aIndex;
  }

  /**
   * Returns the distance squared between two vectors.
   *
   * @param {Index} aIndex
   * @param {Index} bIndex
   * @returns {number} The distance squared
   */
  get(aIndex, bIndex) {
    return this.#distances.get(this.#getTupleID(aIndex, bIndex));
  }

  /**
   * Returns the quantile squared.
   *
   * @param {number} percentile - Ranged between 0 - 1
   * @returns {number}
   */
  quantile(percentile) {
    if (!this.#distancesSorted) {
      this.#distancesSorted = [...this.#distances.values()].sort(
        (a, b) => a - b
      );
    }
    const index = Math.max(
      0,
      Math.min(
        this.#distancesSorted.length - 1,
        Math.round(this.#distancesSorted.length * percentile)
      )
    );
    return this.#distancesSorted[index];
  }
}
