/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is a UA widget. It runs in per-origin UA widget scope,
// to be loaded by UAWidgetsChild.jsm.

this.TextRecognitionWidget = class {
  constructor(shadowRoot, prefs) {
    this.shadowRoot = shadowRoot;
    this.prefs = prefs;
    this.element = shadowRoot.host;
    this.document = this.element.ownerDocument;
    this.window = this.document.defaultView;
    this.observer = null;
    this.spanRects = new Map();
    this.imageWidth = this.element.width;
    this.imageHeight = this.element.height;
  }

  /*
   * Callback called by UAWidgets right after constructor.
   */
  onsetup() {
    this.observer = new this.window.ResizeObserver(() => {
      this.window.requestAnimationFrame(() => {
        this.positionSpans();
      });
    });
    this.observer.observe(this.element);
  }

  positionSpans() {
    if (this.shadowRoot.children.length === 0) {
      return;
    }
    const [div] = this.shadowRoot.children;
    const spans = [...div.children];
    // TODO - Add mutation observer.
    const imgRect = this.element.getBoundingClientRect();
    Object.assign(div.style, {
      width: imgRect.width + "px",
      height: imgRect.height + "px",
      position: "absolute",
      outline: "red 1px solid",
      overflow: "clip",
      /* Prevent inheritance */
      lineHeight: "1.3",
      textAlign: "left",
      font: "normal normal normal 100%/normal sans-serif !important",
      textDecoration: "none !important",
      whiteSpace: "normal !important",
    });
    for (const span of spans) {
      const points = span.dataset.points.split(",").map(p => Number(p));
      // Use the points in the string, e.g.
      // "0.0275349,0.14537,0.0275349,0.244662,0.176966,0.244565,0.176966,0.145273"
      //  0         1       2         3        4        5        6        7
      //  ^ bottomleft      ^ topleft          ^ topright        ^ bottomright
      const [
        bottomLeftX,
        bottomLeftY,
        topLeftX,
        topLeftY,
        topRightX,
        topRightY,
        bottomRightX,
        bottomRightY,
      ] = points;
      // Don't account for skew yet, assume the text is orthogonal to the screen.

      const left = (points[0] + points[2]) / 2;
      const right = (points[4] + points[6]) / 2;
      const top = 1 - (points[3] + points[5]) / 2;
      const bottom = 1 - (points[1] + points[7]) / 2;
      const width = right - left;
      const height = bottom - top;
      let spanRect = this.spanRects.get(span);
      if (!spanRect) {
        // This only needs to happen once.
        spanRect = span.getBoundingClientRect();
        this.spanRects.set(span, spanRect);
      }
      const scaleX = (width * this.imageWidth) / spanRect.width;
      const scaleY = (height * this.imageHeight) / spanRect.height;

      // prettier-ignore
      const mat4 = projectPoints(
        spanRect.width,               spanRect.height,
        imgRect.width * topLeftX,     imgRect.height * (1 - topLeftY),
        imgRect.width * topRightX,    imgRect.height * (1 - topRightY),
        imgRect.width * bottomLeftX,  imgRect.height * (1 - bottomLeftY),
        imgRect.width * bottomRightX, imgRect.height * (1 - bottomRightY)
      );

      Object.assign(span.style, {
        position: "absolute",
        transformOrigin: "0 0",
        transform: "matrix3d(" + mat4.join(", ") + ")",
        color: "transparent",
        borderRadius: "3px",
      });
    }
  }

  /*
   * Callback called by UAWidgets when the "controls" property changes.
   */
  onchange() {
    this.positionSpans();
  }

  destructor() {
    this.shadowRoot.firstChild.remove();
    this.observer.disconnect();
    this.spanRects.clear();
  }

  onPrefChange(prefName, prefValue) {
    this.prefs[prefName] = prefValue;
  }
};

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

function multiplyMat3Vec3(m, v) {
  // prettier-ignore
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
  let mat3 = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  let vec3 = multiplyMat3Vec3(computeAdjugate(mat3), [x4, y4, 1]);
  return multiplyMat3(
    mat3,
    // prettier-ignore
    [vec3[0], 0, 0, 0,
    vec3[1], 0, 0, 0, vec3[2]]
  );
}

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
