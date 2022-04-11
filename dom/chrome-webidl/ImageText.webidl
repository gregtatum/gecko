/* -*- Mode: IDL; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

[ChromeOnly, Exposed=Window]
interface ImageText {
  readonly attribute float confidence;
  readonly attribute DOMString string;
  readonly attribute float bottomLeftX;
  readonly attribute float bottomLeftY;
  readonly attribute float topLeftX;
  readonly attribute float topLeftY;
  readonly attribute float topRightX;
  readonly attribute float topRightY;
  readonly attribute float bottomRightX;
  readonly attribute float bottomRightY;
};
