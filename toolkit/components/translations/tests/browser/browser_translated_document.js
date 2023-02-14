/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Checks that the page renders without issue, and that the expected elements
 * are there.
 */
add_task(async function test_translated_document() {
  const { TranslatedDocument } = ChromeUtils.importESModule(
    "chrome://global/content/translations/translated-document.sys.mjs"
  );
  ok(TranslatedDocument, "Imported");
});
