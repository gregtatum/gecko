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

  /** @type {null | number} */
  lastCanvasStyleWidth = null;

  /**
   * @param {ImageInfo} imageInfo
   */
  constructor(imageInfo) {
    this.imageInfo = imageInfo;

    /** @type {HTMLDivElement} */
    this.imageWrapperEl = document.querySelector(".imageToolsImage");

    /** @type {HTMLCanvasElement} */
    this.canvasEl = this.imageWrapperEl.querySelector("canvas");

    /** @type {HTMLDivElement} */
    this.textEl = document.querySelector(".imageToolsText");

    /** @type {HTMLDivElement} */
    this.textClustersEl = document.querySelector(".imageToolsTextClusters");

    /** @type {HTMLDivElement} */
    this.imageToolsName = document.querySelector(".imageToolsName");

    this.loadingEL = document.querySelector(".imageToolsTextLoading");

    const parts = this.imageInfo.currentSrc.split("/");
    this.imageToolsName.innerText = decodeURIComponent(parts[parts.length - 1]);

    this.setupImage();
  }

  setupImage() {
    const { imageInfo, imageWrapperEl } = this;
    const img = document.createElement("img");
    img.onload = async () => {
      if (img.width > img.height) {
        img.classList.add("imageToolsHorizontal");
      } else {
        img.classList.add("imageToolsVertical");
      }

      /** @type {TextRecognitionResult[]} */
      const results = await img.recognizeCurrentImageText();

      // TODO - Remove this. This is a hack to remove the shadow root functionality.
      img.openOrClosedShadowRoot.children[0].remove();

      this.loadingEL.style.display = "none";

      const spans = this.runClustering(results);
      requestAnimationFrame(() => {
        this.positionSpans(results, spans, img);
      });
    };
    img.src = imageInfo.currentSrc;
    img.setAttribute("alt", imageInfo.imageText);
    imageWrapperEl.prepend(img);
  }

  /**
   * @param {TextRecognitionResult[]} results
   * @param {HTMLSpanElement[]} spans
   * @param {HTMLImageElement} img
   */
  positionSpans(results, spans, img) {
    /** @type {Map<HTMLSpanElement, DOMRect>} */
    const spanRects = new Map();
    const { textClustersEl, canvasEl, textEl } = this;

    const rect = this.imageWrapperEl
      .querySelector("img")
      .getBoundingClientRect();
    textClustersEl.style.top = rect.top + "px";
    textClustersEl.style.left = rect.left + "px";
    textClustersEl.style.width = rect.width + "px";
    textClustersEl.style.height = rect.height + "px";
    canvasEl.style.top = rect.top + "px";
    canvasEl.style.left = rect.left + "px";
    canvasEl.style.width = rect.width + "px";
    canvasEl.style.height = rect.height + "px";
    canvasEl.style.opacity = 1;
    textEl.style.opacity = 1;

    // The ctx is only available when redrawing the canvas. This is operation is only
    // done when necessary, as it can be expensive.
    /** @type {null | CanvasRenderingContext2D} */
    let ctx = null;

    if (
      // The canvas hasn't been drawn to yet.
      this.lastCanvasStyleWidth === null ||
      // Only redraw when the image has grown 25% larger. This percentage was chosen
      // as it visually seemed to work well, with the canvas never appearing blurry
      // when manually testing it.
      rect.width > this.lastCanvasStyleWidth * 1.25
    ) {
      const dpr = window.devicePixelRatio;
      this.canvasEl.width = rect.width * dpr;
      this.canvasEl.height = rect.height * dpr;
      this.lastCanvasStyleWidth = rect.width;

      ctx = this.canvasEl.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#00000088";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.beginPath();
    }

    if (results.length !== spans.length) {
      throw new Error("Expected results and spans to have the same length.");
    }
    for (let i = 0; i < results.length; i++) {
      const span = spans[i];
      const {
        quad: { p1, p2, p3, p4 },
      } = results[i];
      let spanRect = spanRects.get(span);
      if (!spanRect) {
        // This only needs to happen once.
        spanRect = span.getBoundingClientRect();
        spanRects.set(span, spanRect);
      }

      let bottomLeftX = p1.x;
      let bottomLeftY = 1 - p1.y; // Invert the Ys.
      let topLeftX = p2.x;
      let topLeftY = 1 - p2.y;
      let topRightX = p3.x;
      let topRightY = 1 - p3.y;
      let bottomRightX = p4.x;
      let bottomRightY = 1 - p4.y;

      // Create a projection matrix to position the <span> relative to the bounds.
      // prettier-ignore
      const mat4 = projectPoints(
        spanRect.width, spanRect.height,
        rect.width * topLeftX, rect.height * topLeftY,
        rect.width * topRightX, rect.height * topRightY,
        rect.width * bottomLeftX, rect.height * bottomLeftY,
        rect.width * bottomRightX, rect.height * bottomRightY
      );

      span.style.transform = "matrix3d(" + mat4.join(", ") + ")";

      if (ctx) {
        const inset = 3;
        ctx.moveTo(
          rect.width * bottomLeftX + inset,
          rect.height * bottomLeftY - inset
        );
        ctx.lineTo(
          rect.width * topLeftX + inset,
          rect.height * topLeftY + inset
        );
        ctx.lineTo(
          rect.width * topRightX - inset,
          rect.height * topRightY + inset
        );
        ctx.lineTo(
          rect.width * bottomRightX - inset,
          rect.height * bottomRightY - inset
        );
        ctx.closePath();
      }
    }

    if (ctx) {
      // This composite operation will cut out the quads. The color is arbitrary.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Creating a round line will grow the selection slightly, and round the corners.
      ctx.lineWidth = 10;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  /**
   * @param {TextRecognitionResult[]} results
   * @param {"ltr" | "rtl"} direction
   * @returns {HTMLSpanElement[]}
   */
  runClustering(results, direction = "ltr") {
    // Cluster close groups of text to allow for better text selection.
    //
    // Before:
    //
    // <div>
    //   <span /><span /><span /><span />...
    // </div>
    //
    // After clustering:
    //
    // <div>
    //   <div> <!-- Cluster -->
    //     <span />
    //     <span />
    //   </div>>
    //   <div> <!-- Cluster -->
    //     <span />
    //     <span />
    //   </div>>
    //   ...
    // </div>

    /** @type {Vec2[]} */
    const centers = [];

    /** @type {HTMLSpanElement[]} */
    const spans = [];

    for (const result of results) {
      const p = result.quad;

      // Pick either the left-most or right-most edge. This optimizes for
      // aligned text over centered text.
      const minOrMax = direction === "ltr" ? Math.min : Math.max;

      centers.push([
        minOrMax(p.p1.x, p.p2.x, p.p3.x, p.p4.x),
        (p.p1.y, p.p2.y, p.p3.y, p.p4.y) / 4,
      ]);

      // The span will be placed into a new cluster.
      const span = document.createElement("span");
      span.innerText = result.string;
      spans.push(span);
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

    for (const cluster of clusters) {
      const divCluster = document.createElement("div");
      divCluster.className = "imageToolsImageCluster";

      const pCluster = document.createElement("p");
      pCluster.className = "imageToolsTextCluster";

      for (let i = 0; i < cluster.length; i++) {
        const index = cluster[i];
        // Each cluster could be a paragraph, so add a newline to the end
        // for better copying.
        const ending = i + 1 === cluster.length ? "\n" : " ";

        {
          // Handle the span inside of the image.
          const span = spans[index];
          if (!span) {
            throw new Error(
              "Logic error, expected to find a span at that index."
            );
          }
          span.className = "imageToolsImageSpan";
          span.innerText += ending;
          divCluster.appendChild(span);
        }
        {
          // Handle the span inside of the text-only area.
          const span = document.createElement("span");
          const result = results[index];
          span.innerText = result.string + ending;
          pCluster.appendChild(span);
        }
      }
      this.textClustersEl.appendChild(divCluster);
      this.textEl.appendChild(pCluster);
    }

    return spans;
  }
}

/**
 * A two dimensional vector.
 *
 * @typedef {[number, number]} Vec2
 */

/**
 * A three dimensional vector.
 *
 * @typedef {[number, number, number]} Vec3
 */

/**
 * A 3x3 matrix.
 *
 * @typedef {[number, number, number,
 *            number, number, number,
 *            number, number, number]} Matrix3
 */

/**
 * A 4x4 matrix.
 *
 * @typedef {[number, number, number, number,
 *            number, number, number, number,
 *            number, number, number, number,
 *            number, number, number, number]} Matrix4
 */

/**
 * Compute the adjugate matrix.
 * https://en.wikipedia.org/wiki/Adjugate_matrix
 *
 * @param {Matrix3} m
 * @returns {Matrix3}
 */
function computeAdjugate(m) {
  // prettier-ignore
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}

/**
 * @param {Matrix3} a
 * @param {Matrix3} b
 * @returns {Matrix3}
 */
function multiplyMat3(a, b) {
  let out = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += a[3 * i + k] * b[3 * k + j];
      }
      out[3 * i + j] = sum;
    }
  }
  return out;
}

/**
 * @param {Matrix3} m
 * @param {Vec3} v
 * @returns {Vec3}
 */
function multiplyMat3Vec3(m, v) {
  // prettier-ignore
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/**
 * @returns {Matrix3}
 */
function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
  /** @type {Matrix3} */
  let mat3 = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  let vec3 = multiplyMat3Vec3(computeAdjugate(mat3), [x4, y4, 1]);
  // prettier-ignore
  return multiplyMat3(
    mat3,
    [
      vec3[0], 0, 0,
      0, vec3[1], 0,
      0, 0, vec3[2]
    ]
  );
}

/**
 * @type {(...Matrix4) => Matrix3}
 */
// prettier-ignore
function general2DProjection(
  x1s, y1s, x1d, y1d,
  x2s, y2s, x2d, y2d,
  x3s, y3s, x3d, y3d,
  x4s, y4s, x4d, y4d
) {
  let s = basisToPoints(x1s, y1s, x2s, y2s, x3s, y3s, x4s, y4s);
  let d = basisToPoints(x1d, y1d, x2d, y2d, x3d, y3d, x4d, y4d);
  return multiplyMat3(d, computeAdjugate(s));
}

/**
 * Given a width and height, compute a projection matrix to points 1-4.
 *
 * The points (x1,y1) through (x4, y4) use the following ordering:
 *
 *         w
 *      ┌─────┐      project     1 ─────── 2
 *    h │     │       -->        │        /
 *      └─────┘                  │       /
 *                               3 ──── 4
 *
 * @returns {Matrix4}
 */
function projectPoints(w, h, x1, y1, x2, y2, x3, y3, x4, y4) {
  // prettier-ignore
  const mat3 = general2DProjection(
    0, 0, x1, y1,
    w, 0, x2, y2,
    0, h, x3, y3,
    w, h, x4, y4
  );

  for (let i = 0; i < 9; i++) {
    mat3[i] = mat3[i] / mat3[8];
  }

  // prettier-ignore
  return [
    mat3[0], mat3[3], 0, mat3[6],
    mat3[1], mat3[4], 0, mat3[7],
    0, 0, 1, 0,
    mat3[2], mat3[5], 0, mat3[8],
  ];
}

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
