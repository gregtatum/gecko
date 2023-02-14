/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * @type {typeof import("../../content/translated-document.sys.mjs")}
 */
const { TranslatedDocument } = ChromeUtils.importESModule(
  "chrome://global/content/translations/translated-document.sys.mjs"
);

/**
 * @param {string} html
 */
async function createDoc(html) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.translations.enable", true],
      ["browser.translations.logLevel", "All"],
    ],
  });

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  /**
   * Fake translations by converting them to uppercase.
   * @param {string} message
   */
  async function fakeTranslator(message) {
    /**
     * @param {Node} node
     */
    function upperCaseNode(node) {
      if (typeof node.nodeValue === "string") {
        node.nodeValue = node.nodeValue.toUpperCase();
      }
      for (const childNode of node.childNodes) {
        upperCaseNode(childNode);
      }
    }
    const translatedDoc = parser.parseFromString(message, "text/html");
    upperCaseNode(translatedDoc.body);
    return [translatedDoc.body.innerHTML];
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
    const expected = naivelyPrettify(html);
    try {
      await BrowserTestUtils.waitForCondition(
        () => naivelyPrettify(document.body.innerHTML) === expected,
        "Waiting for HTML to match."
      );
      ok(true, message);
    } catch (error) {
      console.error(error);

      // Provide a nice error message.
      const actual = naivelyPrettify(document.body.innerHTML);
      ok(
        false,
        `${message}\n\nExpected HTML:\n\n${expected}\n\nActual HTML:\n\n${actual}\n\n`
      );
    }
  }

  function cleanup() {
    SpecialPowers.popPrefEnv();
  }

  return { document, translated, htmlMatches, cleanup };
}

add_task(async function test_translated_div_element() {
  const {
    document,
    translated,
    htmlMatches,
    cleanup,
  } = await createDoc(/* html */ `
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

  info("Adding document with a single div to the TranslatedDocument.");
  translated.addRootElement(document.body);

  await htmlMatches(
    "A single element with a single text node is translated into uppercase.",
    /* html */ `
      <div x-bergamot-translated="">
        THIS IS A SIMPLE TRANSLATION.
      </div>
    `
  );

  cleanup();
});

add_task(async function test_translated_textnode() {
  const { document, translated, htmlMatches, cleanup } = await createDoc(
    "This is a simple text translation."
  );

  info("Adding document with just a Text node to the TranslatedDocument.");
  translated.addRootElement(document.body);

  await htmlMatches(
    "A Text node at the root is translated into all caps",
    "THIS IS A SIMPLE TEXT TRANSLATION."
  );

  cleanup();
});

add_task(async function test_translated_textnode() {
  const {
    document,
    translated,
    htmlMatches,
    cleanup,
  } = await createDoc(/* html */ `
    <div class="menu-main-menu-container">
      <ul class="menu-list">
        <li class="menu-item menu-item-top-level">
          <a href="/">Latest Work</a>
        </li>
        <li class="menu-item menu-item-top-level">
          <a href="/category/interactive/">Creative Coding</a>
        </li>
        <li id="menu-id-categories" class="menu-item menu-item-top-level">
          <a href="#"><span class='category-arrow'>Categories</span></a>
        </li>
      </ul>
    </div>
  `);

  info("Adding document to the TranslatedDocument.");
  translated.addRootElement(document.body);

  await htmlMatches(
    "The nested elements are translated into all caps.",
    /* html */ `
      <div class="menu-main-menu-container">
        <ul class="menu-list" x-bergamot-translated="">
          <li class="menu-item menu-item-top-level" data-x-bergamot-id="0">
            <a href="/" data-x-bergamot-id="1">LATEST WORK</a>
          </li>
          <li class="menu-item menu-item-top-level" data-x-bergamot-id="2">
            <a href="/category/interactive/" data-x-bergamot-id="3">CREATIVE CODING</a>
          </li>
          <li id="menu-id-categories" class="menu-item menu-item-top-level" data-x-bergamot-id="4">
            <a href="#" data-x-bergamot-id="5">
              <span class="category-arrow" data-x-bergamot-id="6">CATEGORIES</span>
            </a>
          </li>
        </ul>
      </div>
    `
  );

  cleanup();
});

// Test lang mismatches.
// Test translate=no
// Test notranslation
// Test contenteditable
// Test subtrees with no text
// Test behavior of presumed inline
// Test the xBergamotId behavior

/**
 * Naively prettify's html based on the opening and closing tags. This is not robust
 * for general usage, but should be adequate for these tests.
 * @param {string} html
 * @returns {string}
 */
function naivelyPrettify(html) {
  let result = "";
  let indent = 0;

  function addText(actualEndIndex) {
    const text = html.slice(startIndex, actualEndIndex).trim();
    if (text) {
      for (let i = 0; i < indent; i++) {
        result += "  ";
      }
      result += text + "\n";
    }
    startIndex = actualEndIndex;
  }

  let startIndex = 0;
  let endIndex = 0;
  for (; endIndex < html.length; endIndex++) {
    if (
      html[endIndex] === " " ||
      html[endIndex] === "\t" ||
      html[endIndex] === "n"
    ) {
      // Skip whitespace.
      // "   <div>foobar</div>"
      //  ^^^
      startIndex = endIndex;
      continue;
    }

    // Find all of the text.
    // "<div>foobar</div>"
    //       ^^^^^^
    while (endIndex < html.length && html[endIndex] !== "<") {
      endIndex++;
    }

    addText(endIndex);

    if (html[endIndex] === "<") {
      if (html[endIndex + 1] === "/") {
        // "<div>foobar</div>"
        //             ^
        while (endIndex < html.length && html[endIndex] !== ">") {
          endIndex++;
        }
        indent--;
        addText(endIndex + 1);
      } else {
        // "<div>foobar</div>"
        //  ^
        while (endIndex < html.length && html[endIndex] !== ">") {
          endIndex++;
        }
        // "<div>foobar</div>"
        //      ^
        addText(endIndex + 1);
        indent++;
      }
    }
  }

  return result.trim();
}
