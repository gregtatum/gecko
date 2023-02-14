/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * @typedef {import("../../content/translated-document.sys.mjs").TranslatedDocument} TranslatedDocument
 */

/**
 * @param {string} html
 */
function createDoc(html) {
  /**
   * @type {typeof import("../../content/translated-document.sys.mjs")}
   */
  const { TranslatedDocument } = ChromeUtils.importESModule(
    "chrome://global/content/translations/translated-document.sys.mjs"
  );
  ok(TranslatedDocument, "Imported");

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  /**
   * Fake translations by converting them to uppercase.
   * @param {string} message
   */
  async function fakeTranslator(message) {
    return [message.toUpperCase()];
  }

  const translated = new TranslatedDocument(
    document,
    "en",
    fakeTranslator,
    fakeTranslator
  );

  /**
   * Test utility to check that the document matches the expected markup
   *
   * @param {string} html
   */
  async function htmlMatches(message, html) {
    const expected = getNormalizedHTML(html);
    try {
      await BrowserTestUtils.waitForCondition(
        () => getNormalizedHTML(document.body.innerHTML) === expected,
        "Waiting for HTML to match."
      );
      ok(true, message);
    } catch (error) {
      console.error(error);

      // Provide a nice error message.
      const actual = getNormalizedHTML(document.body.innerHTML);
      ok(
        false,
        `${message}\n\nExpected HTML:\n\n${expected}\n\nActual HTML:\n\n${actual}\n\n`
      );
    }
  }

  return { document, translated, htmlMatches };
}

/**
 * Recursively normalize a tree.
 *
 * @param {Node} node
 */
function normalizeTree(node) {
  node.normalize();
  for (const childNode of node.childNodes) {
    normalizeTree(childNode);
  }
}

/**
 * Normalizes text HTML for better error reporting. It removes whitespace.
 *
 * @param {string} html
 */
function getNormalizedHTML(html) {
  const domParser = new DOMParser();
  const document = domParser.parseFromString(html, "text/html");
  normalizeTree(document.body);
  const text = document.body.innerHTML;
  // Remove whitespace on lines.
  return text
    .split("\n")
    .map(text => text.trim())
    .join("\n");
}

/**
 * Unit tests for the translated document.
 */
add_task(async function test_translated_document() {
  const { document, translated, htmlMatches } = createDoc(/* html */ `
    <div>
      This is a simple translation.
    </div>
  `);

  await htmlMatches(
    "The document starts out as expected.",
    /* html */ `
      <div>
        This is a simple translation.
      </div>
    `
  );

  translated.addRootElement(document.querySelector("div"));

  await htmlMatches(
    "The document is translated into all caps",
    /* html */ `
      <div x-bergamot-translated="">
        THIS IS A SIMPLE TRANSLATION.
      </div>
    `
  );
});

// Test lang mismatches.
// Test translate=no
// Test notranslation
// Test contenteditable
// Test subtrees with no text
// Test behavior of presumed inline
// Test the xBergamotId behavior
