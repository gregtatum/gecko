/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

// This is a UA widget. It runs in per-origin UA widget scope,
// to be loaded by UAWidgetsChild.jsm.

this.TextRecognitionWidget = class {
  /**
   * @param {ShadowRoot} shadowRoot
   * @param {Record<string, string | boolean | number>} _prefs
   */
  constructor(shadowRoot, _prefs) {
    /** @type {ShadowRoot} */
    this.shadowRoot = shadowRoot;
    /** @type {HTMLElement} */
    this.element = shadowRoot.host;
    /** @type {Document} */
    this.document = this.element.ownerDocument;
    /** @type {Window} */
    this.window = this.document.defaultView;
    /** @type {ResizeObserver} */
    this.resizeObserver = null;
    /** @type {Map<HTMLSpanElement, DOMRect} */
    this.spanRects = new Map();
    /** @type {boolean} */
    this.isInitialized = false;
    /** @type {null | number} */
    this.lastCanvasStyleWidth = null;
  }

  /*
   * Callback called by UAWidgets right after constructor.
   */
  onsetup() {
    this.resizeObserver = new this.window.ResizeObserver(() => {
      this.positionSpans();
    });
    this.resizeObserver.observe(this.element);
  }

  positionSpans() {
    if (!this.shadowRoot.firstChild) {
      return;
    }
    this.lazilyInitialize();

    /** @type {HTMLDivElement} */
    const div = this.shadowRoot.firstChild;
    const canvas = div.querySelector("canvas");
    const spans = div.querySelectorAll("span");

    // TODO Bug 1770438 - The <img> element does not currently let child elements be
    // sized relative to the size of the containing <img> element. It would be better
    // to teach the <img> element how to do this. For the prototype, do the more expensive
    // operation of getting the bounding client rect, and handle the positioning manually.
    const imgRect = this.element.getBoundingClientRect();
    div.style.width = imgRect.width + "px";
    div.style.height = imgRect.height + "px";
    canvas.style.width = imgRect.width + "px";
    canvas.style.height = imgRect.height + "px";

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
      imgRect.width > this.lastCanvasStyleWidth * 1.25
    ) {
      const dpr = this.window.devicePixelRatio;
      canvas.width = imgRect.width * dpr;
      canvas.height = imgRect.height * dpr;
      this.lastCanvasStyleWidth = imgRect.width;

      ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#00000088";
      ctx.fillRect(0, 0, imgRect.width, imgRect.height);

      ctx.beginPath();
    }

    for (const span of spans) {
      let spanRect = this.spanRects.get(span);
      if (!spanRect) {
        // This only needs to happen once.
        spanRect = span.getBoundingClientRect();
        this.spanRects.set(span, spanRect);
      }

      const points = span.dataset.points.split(",").map(p => Number(p));
      // Use the points in the string, e.g.
      // "0.0275349,0.14537,0.0275349,0.244662,0.176966,0.244565,0.176966,0.145273"
      //  0         1       2         3        4        5        6        7
      //  ^ bottomleft      ^ topleft          ^ topright        ^ bottomright
      let [
        bottomLeftX,
        bottomLeftY,
        topLeftX,
        topLeftY,
        topRightX,
        topRightY,
        bottomRightX,
        bottomRightY,
      ] = points;

      // Invert the Y.
      topLeftY = 1 - topLeftY;
      topRightY = 1 - topRightY;
      bottomLeftY = 1 - bottomLeftY;
      bottomRightY = 1 - bottomRightY;

      // Create a projection matrix to position the <span> relative to the bounds.
      // prettier-ignore
      const mat4 = projectPoints(
        spanRect.width,               spanRect.height,
        imgRect.width * topLeftX,     imgRect.height * topLeftY,
        imgRect.width * topRightX,    imgRect.height * topRightY,
        imgRect.width * bottomLeftX,  imgRect.height * bottomLeftY,
        imgRect.width * bottomRightX, imgRect.height * bottomRightY
      );

      span.style.transform = "matrix3d(" + mat4.join(", ") + ")";

      if (ctx) {
        const inset = 3;
        ctx.moveTo(
          imgRect.width * bottomLeftX + inset,
          imgRect.height * bottomLeftY - inset
        );
        ctx.lineTo(
          imgRect.width * topLeftX + inset,
          imgRect.height * topLeftY + inset
        );
        ctx.lineTo(
          imgRect.width * topRightX - inset,
          imgRect.height * topRightY + inset
        );
        ctx.lineTo(
          imgRect.width * bottomRightX - inset,
          imgRect.height * bottomRightY - inset
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

  destructor() {
    this.shadowRoot.firstChild.remove();
    this.resizeObserver.disconnect();
    this.spanRects.clear();
  }

  lazilyInitialize() {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    const parser = new this.window.DOMParser();
    let parserDoc = parser.parseFromString(
      `<div class="textrecognition" xmlns="http://www.w3.org/1999/xhtml" role="none">
        <link rel="stylesheet" href="chrome://global/skin/media/textrecognition.css" />
        <canvas />
        <!-- The spans will be reattached here -->
      </div>`,
      "application/xml"
    );
    if (
      this.shadowRoot.children.length !== 1 ||
      this.shadowRoot.firstChild.tagName !== "DIV"
    ) {
      throw new Error(
        "Expected the shadowRoot to have a single div as the root element."
      );
    }

    const spansDiv = this.shadowRoot.firstChild;
    // Example layout of spansDiv:
    // <div>
    //   <span data-points="0.0275349,0.14537,0.0275349,0.244662,0.176966,0.244565,0.176966,0.145273">
    //     Text that has been recognized
    //   </span>
    //   ...
    // </div>
    spansDiv.remove();

    this.shadowRoot.importNodeAndAppendChildAt(
      this.shadowRoot,
      parserDoc.documentElement,
      true /* deep */
    );

    this.shadowRoot.importNodeAndAppendChildAt(
      this.shadowRoot.firstChild,
      spansDiv,
      true /* deep */
    );
  }
};

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
      vec3[0], 0,       0,
      0,       vec3[1], 0,
      0,       0,       vec3[2]
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
    0,       0,       1, 0,
    mat3[2], mat3[5], 0, mat3[8],
  ];
}

/**
 * The MIT License
 *
 * Copyright © 2013 Abeja Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the “Software”), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * The software is provided “as is”, without warranty of any kind, express or
 * implied, including but not limited to the warranties of merchantability, fitness
 * for a particular purpose and noninfringement. In no event shall the authors or
 * copyright holders be liable for any claim, damages or other liability, whether
 * in an action of contract, tort or otherwise, arising from, out of or in
 * connection with the software or the use or other dealings in the software.
 *
 * DBSCAN - Density based clustering
 *
 * https://github.com/uhho/density-clustering/blob/master/lib/DBSCAN.js
 *
 * @author Lukasz Krawczyk <contact@lukaszkrawczyk.eu>
 * @copyright MIT
 */

class DBSCAN {
  /**
   * @param {Array} dataset
   * @param {number} epsilon
   * @param {number} minPts
   * @param {function} distanceFunction
   * @returns {DBSCAN}
   */
  constructor(dataset, epsilon, minPts, distanceFunction) {
    /** @type {Array} */
    this.dataset = [];
    /** @type {number} */
    this.epsilon = 1;
    /** @type {number} */
    this.minPts = 2;
    /** @type {function} */
    this.distance = DBSCAN.#euclideanDistance;
    /** @type {Array} */
    this.clusters = [];
    /** @type {Array} */
    this.noise = [];

    // temporary variables used during computation

    /** @type {Array} */
    this._visited = [];
    /** @type {Array} */
    this._assigned = [];
    /** @type {number} */
    this._datasetLength = 0;

    this.#init(dataset, epsilon, minPts, distanceFunction);
  }

  /**
   * Start clustering
   *
   * @param {Array} dataset
   * @param {number} epsilon
   * @param {number} minPts
   * @param {function} distanceFunction
   * @returns {undefined}
   * @access public
   */
  run(dataset, epsilon, minPts, distanceFunction) {
    this.#init(dataset, epsilon, minPts, distanceFunction);

    for (var pointId = 0; pointId < this._datasetLength; pointId++) {
      // if point is not visited, check if it forms a cluster
      if (this._visited[pointId] !== 1) {
        this._visited[pointId] = 1;

        // if closest neighborhood is too small to form a cluster, mark as noise
        var neighbors = this.#regionQuery(pointId);

        if (neighbors.length < this.minPts) {
          this.noise.push(pointId);
        } else {
          // create new cluster and add point
          var clusterId = this.clusters.length;
          this.clusters.push([]);
          this.#addToCluster(pointId, clusterId);

          this.#expandCluster(clusterId, neighbors);
        }
      }
    }

    return this.clusters;
  }

  /******************************************************************************/
  // protected functions

  /**
   * Set object properties
   *
   * @param {Array} dataset
   * @param {number} epsilon
   * @param {number} minPts
   * @param {function} distance
   * @returns {undefined}
   * @access protected
   */
  #init(dataset, epsilon, minPts, distance) {
    if (dataset) {
      if (!(dataset instanceof Array)) {
        throw Error(
          "Dataset must be of type array, " + typeof dataset + " given"
        );
      }

      this.dataset = dataset;
      this.clusters = [];
      this.noise = [];

      this._datasetLength = dataset.length;
      this._visited = new Array(this._datasetLength);
      this._assigned = new Array(this._datasetLength);
    }

    if (epsilon) {
      this.epsilon = epsilon;
    }

    if (minPts) {
      this.minPts = minPts;
    }

    if (distance) {
      this.distance = distance;
    }
  }

  /**
   * Expand cluster to closest points of given neighborhood
   *
   * @param {number} clusterId
   * @param {Array} neighbors
   * @returns {undefined}
   * @access protected
   */
  #expandCluster(clusterId, neighbors) {
    /**
     * It's very important to calculate length of neighbors array each time,
     * as the number of elements changes over time
     */
    for (var i = 0; i < neighbors.length; i++) {
      var pointId2 = neighbors[i];

      if (this._visited[pointId2] !== 1) {
        this._visited[pointId2] = 1;
        var neighbors2 = this.#regionQuery(pointId2);

        if (neighbors2.length >= this.minPts) {
          neighbors = DBSCAN.#mergeArrays(neighbors, neighbors2);
        }
      }

      // add to cluster
      if (this._assigned[pointId2] !== 1) {
        this.#addToCluster(pointId2, clusterId);
      }
    }
  }

  /**
   * Add new point to cluster
   *
   * @param {number} pointId
   * @param {number} clusterId
   */
  #addToCluster(pointId, clusterId) {
    this.clusters[clusterId].push(pointId);
    this._assigned[pointId] = 1;
  }

  /**
   * Find all neighbors around given point
   *
   * @param {number} pointId,
   * @param {number} epsilon
   * @returns {Array}
   * @access protected
   */
  #regionQuery(pointId) {
    var neighbors = [];

    for (var id = 0; id < this._datasetLength; id++) {
      var dist = this.distance(this.dataset[pointId], this.dataset[id]);
      if (dist < this.epsilon) {
        neighbors.push(id);
      }
    }

    return neighbors;
  }

  /******************************************************************************/
  // helpers

  /**
   * @param {Array} a
   * @param {Array} b
   * @returns {Array}
   * @access protected
   */
  static #mergeArrays(a, b) {
    var len = b.length;

    for (var i = 0; i < len; i++) {
      var P = b[i];
      if (!a.includes(P)) {
        a.push(P);
      }
    }

    return a;
  }

  /**
   * Calculate euclidean distance in multidimensional space
   *
   * @param {Array} p
   * @param {Array} q
   * @returns {number}
   * @access protected
   */
  static #euclideanDistance(p, q) {
    var sum = 0;
    var i = Math.min(p.length, q.length);

    while (i--) {
      sum += (p[i] - q[i]) * (p[i] - q[i]);
    }

    return Math.sqrt(sum);
  }
}
