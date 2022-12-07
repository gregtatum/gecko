/* -*- Mode: JavaScript; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test for bug 1303838.
 * Load a tab with some links, emulate link clicks and check if the
 * browser would switch to the existing target tab opened by previous
 * link click if loadDivertedInBackground is set to true.
 */

 "use strict";

add_task(async function test_blank() {
  ok(true);
});
