/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * @typedef {import("../translations").NodeVisibility} NodeVisibility
 * @typedef {(message: string) => Promise<string>} TranslationFunction
 */

const UPDATE_INTERVAL = 0;

/**
 * These tags are excluded from translation.
 */
const EXCLUDED_TAGS = new Set([
  // code-type elements generally don't translate well.
  "code",
  "kbd",
  "samp",
  "var",
  "dir", // Deprecated

  // debatable
  "acronym",

  /*
   * embedded media, lets not just yet. Maybe svg might be fun? Think
   * of inline diagrams that contain labels that we could translate.
   */
  "svg",
  "math",
  "embed",
  "object",
  "applet", // Deprecated
  "iframe",

  /*
   * elements that are treated as opaque by Firefox which causes their
   * innerHTML property to be just the raw text node behind it. So
   * no guarantee that the HTML is valid, which makes bergamot-
   * translator very unhappy.
   * (https://searchfox.org/mozilla-central/source/parser/html/nsHtml5Tokenizer.cpp#176)
   */
  "noscript",
  "noembed",
  "noframes",

  // title is already a special case, other than that I can't think of
  // anything in <head> that needs translating
  "head",

  // don't attempt to translate any inline script or style
  "style",
  "script",

  // let's stay away from translating prefilled forms
  "textarea",

  // Don't enter templates. We'll translate them once they become
  // part of the page proper.
  "template",
]);

// Tags that are treated as assumed inline. This list is has been created by heuristics
// and excludes some commonly inline tags, due to how they are used practically.
//
// An actual list of inline elements is available here:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Inline_elements#list_of_inline_elements
const INLINE_TAGS = new Set([
  "abbr",
  "b",
  "em",
  "i",
  "kbd",
  "code",
  "mark",
  "math",
  "output",
  "q",
  "ruby",
  "small",
  "strong",
  "sub",
  "sup",
  "time",
  "u",

  "var", // Variable
  "wbr", // Line breaking opportunity
  "ins", // Text inserted into a document.
  "del", // Text deleted into a document.

  // not really but for testing, also bergamot-translator treats them as sentence-breaking anyway
  "th",
  "td",
  "li",
  "br",
]);

/**
 * Tags that can't reliably be assumed to be inline or block elements. They default
 * to inline, but are often used as block elements.
 */
const GENERIC_TAGS = new Set(["a", "span"]);

/*
 * This class manages a translation of the DOM.
 */
export class TranslatedDocument {
  /**
   * Used to generate a unique ID for each translation.
   *
   * @type {number}
   */
  translationsCounter = 0;

  /**
   * The two-letter BCP 47 language tag that is used on the page.
   *
   * @type {string} */
  fromLanguage;

  /**
   * The timeout between the first translation received and the call to update the DOM
   * with translations.
   */
  updateTimeout = null;

  /**
   * The nodes that need translations. They are queued when the document tree is walked,
   * and then they are dispatched for translation based on their visibility. The viewport
   * nodes are given the highest priority.
   *
   * @type {Map<Node, {
   *   id: number,
   *   visibility: NodeVisibility,
   * }>
   */
  queuedNodes = new Map();

  /**
   * The count of how many pending translations have been sent to the translations
   * engine.
   */
  pendingTranslationsCount = 0;

  /**
   * The list of nodes that need updating with the translated HTML. These are batched
   * into an update.
   *
   * @type {Set<{ node: Node, translatedHTML: string }}
   */
  nodesWithTranslatedHTML = new Set();

  /**
   * The set of elements that have been walked and processed for translation. They
   * should not be submitted again unless their contents have been changed.
   *
   * @type {WeakSet<Node>}
   */
  processedNodes = new WeakSet();

  /**
   * All root elements we're trying to translate. This should be the `document.body`
   * and the the `title` element.
   *
   * @type {Set<Node>}
   */
  rootNodes = new Set();

  /**
   * Report words in the viewport only for the initially loaded content.
   */
  initialWordsInViewportReported = false;

  /**
   * This promise gets resolved when the initial viewport translations are done.
   * This is a key user-visible performance metric. It represents what the user
   * actually sees.
   *
   * @type {Promise<void> | null}
   */
  viewportTranslated = null;

  /**
   * @param {Document} document
   * @param {string} fromLanguage
   *  The two letter BCP 47 language tag.
   * @param {TranslationFunction} translateHTML
   * @param {TranslationFunction} translateText
   */
  constructor(document, fromLanguage, translateHTML, translateText) {
    // The language of the page. If elements are found that do not match this language,
    // then they are skipped.
    if (fromLanguage.length !== 2) {
      throw new Error(
        "Expected the language to be a valid 2 letter BCP 47 language tag."
      );
    }
    /** @type {string} */
    this.fromLanguage = fromLanguage;

    /** @type {TranslationFunction} */
    this.translateHTML = translateHTML;

    /** @type {TranslationFunction} */
    this.translateText = translateText;

    /** @type {DOMParser} */
    this.domParser = new document.ownerGlobal.DOMParser();

    /**
     * Construct the excluded node selector.

     * Note: [lang]:not([lang...]) is too strict as it also matches slightly
     * different language code. In that case the tree walker will drill down
     * and still accept the element in isExcludedNode. Just not as part of
     * a block.
     * @type {string}
     */
    this.excludedNodeSelector = [
      `[lang]:not([lang|="${this.fromLanguage}"])`,
      `[translate=no]`,
      `.notranslate`,
      `[contenteditable="true"]`,
      `[contenteditable=""]`,
      [...EXCLUDED_TAGS].join(","),
    ].join(",");

    this.debug = Services.prefs.getBoolPref(
      "browser.translations.debug",
      false
    );

    this.observer = new document.ownerGlobal.MutationObserver(mutationsList => {
      for (const mutation of mutationsList) {
        switch (mutation.type) {
          case "childList":
            for (const node of mutation.addedNodes) {
              this.restartTreeWalker(node);
            }
            break;
          case "characterData":
            this.restartTreeWalker(mutation.target);
            break;
          default:
            break;
        }
      }
    });

    if (this.debug) {
      addDebugStylesheet(document);
    }
  }

  /**
   * Add a new element to start translating. This root is tracked for mutations and
   * kept up to date with translations.
   *
   * @param {Element} [node]
   */
  addRootElement(node) {
    if (!node) {
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      // This node is not an element, do not add it.
      return;
    }

    if (this.rootNodes.has(node)) {
      // Exclude nodes that are already targetted.
      return;
    }

    this.rootNodes.add(node);

    this.startTreeWalker(node);

    this.observer.observe(node, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  /**
   * Start walking from a root Node down through the DOM tree and decide which
   * elements to queue for translation.
   *
   * @param {Node} root
   */
  startTreeWalker(root) {
    // TODO - This looks like it can be removed.
    /*
     * if the parent itself is rejected, we don't translate any children.
     * However, if this is a specifically targeted node, we don't do this
     * check. Mainly so we can exclude <head>, but include <title>.
     */
    if (!this.rootNodes.has(root)) {
      for (let parent of getAncestorsIterator(root)) {
        if (this.validateNode(parent) === NodeFilter.FILTER_REJECT) {
          return;
        }
      }
    }

    /*
     * bit of added complicated logic to include `root` in the set
     * of nodes that is being evaluated. Normally TreeWalker will only
     * look at the descendants.
     */
    switch (this.validateNodeForQueue(root)) {
      // if even the root is already rejected, no need to look further
      case NodeFilter.FILTER_REJECT:
        return;

      /*
       * if the root itself is accepted, we don't need to drill down
       * either. But we do want to call dispatchQueuedTranslations().
       */
      case NodeFilter.FILTER_ACCEPT:
        this.queueTranslation(root);
        break;

      /*
       * if we skip the root (because it's a block element and we want to
       * cut it into smaller chunks first) then start tree walking to
       * those smaller chunks.
       */
      case NodeFilter.FILTER_SKIP:
        {
          const nodeIterator = root.ownerDocument.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            this.validateNodeForQueue
          );

          let currentNode;

          while ((currentNode = nodeIterator.nextNode())) {
            this.queueTranslation(currentNode);
          }
        }
        break;

      default:
        // here because of linter, this point is never reached.
        break;
    }

    this.reportWordsInViewport();
    this.dispatchQueuedTranslations();
  }

  /**
   * A mutation has been observed for a node, abandon the previous translation attempt,
   * and restart the tree walking.
   *
   * @param {Node} root
   */
  restartTreeWalker(root) {
    // Remove the previous translation attempt.
    this.processedNodes.delete(root);

    // Restart the walker.
    this.startTreeWalker(root);
  }

  /**
   * Test whether this is an element we do not want to translate. These are things like
   * <code> elements, elements with a different "lang" attribute, and elements that
   * have a `translate=no` attribute.
   *
   * @param {Node} node
   */
  isExcludedNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Text nodes are never excluded.
      return false;
    }

    if (EXCLUDED_TAGS.has(node.nodeName.toLowerCase())) {
      // This is an excluded tag.
      return true;
    }

    if (!this.matchesFromLanguage(node)) {
      // Exclude nodes that don't match the fromLanguage.
      return true;
    }

    if (node.getAttribute("translate") === "no") {
      // This element has a translate="no" attribute.
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate
      return true;
    }

    if (node.classList.contains("notranslate")) {
      // Google Translate skips translations if the classList contains "notranslate"
      // https://cloud.google.com/translate/troubleshooting
      return true;
    }

    if (node.isContentEditable) {
      // This field is editable, and so exclude it similar to the way that form input
      // fields are excluded.
      return true;
    }

    return false;
  }

  /**
   * Runs `validateNode` for any nodes that have not yet been processed.
   *
   * @param {Node} node
   * @return {NodeFilter['FILTER_ACCEPT'] | NodeFilter['FILTER_SKIP'] | NodeFilter['FILTER_REJECT']}
   */
  validateNodeForQueue = node => {
    if (this.processedNodes.has(node)) {
      // Skip nodes that have already been processed.
      return NodeFilter.FILTER_REJECT;
    }

    return this.validateNode(node);
  };

  /**
   * Used by TreeWalker to determine whether to ACCEPT, REJECT or SKIP a
   * subtree. Only checks if the element is acceptable. It does not check
   * whether the element has been translated already, which makes it usable
   * on parent nodes to validate whether a child node is in a translatable
   * context.
   *
   * Returns:
   *   - FILTER_ACCEPT: this subtree should be a translation request.
   *   - FILTER_SKIP  : this node itself should not be a translation request
   *                    but subtrees beneath it could be!
   *   - FILTER_REJECT: skip this node and everything beneath it.
   *
   * @param {Node} node
   * @returns {NodeFilter['FILTER_ACCEPT'] | NodeFilter['FILTER_SKIP'] | NodeFilter['FILTER_REJECT']}
   */
  validateNode(node) {
    // Add annotations for CSS debugging.
    const debugMark = value => {
      if (!this.debug) {
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.setAttribute("x-bergamot-translated", value);
      }
    };

    if (isNodeQueued(node, this.queuedNodes)) {
      // This node or its parent was already queued, reject it.
      return NodeFilter.FILTER_REJECT;
    }

    if (this.isExcludedNode(node)) {
      debugMark("rejected is-excluded-node");
      return NodeFilter.FILTER_REJECT;
    }

    if (node.textContent.trim().length === 0) {
      // Skip over subtrees that don't have text.
      debugMark("rejected empty-text-content");
      return NodeFilter.FILTER_REJECT;
    }

    if (!hasPresumedInlineContent(node)) {
      // Skip this node, and dig deeper into its tree to cut off smaller pieces
      // to translate. It is presumed not to contain inline content.
      debugMark("skipped does-not-have-text-of-its-own");
      return NodeFilter.FILTER_SKIP;
    }

    if (
      containsExcludedNode(node, this.excludedNodeSelector) &&
      !hasTextNodes(node)
    ) {
      // Skip this node, and dig deeper into its tree to cut off smaller pieces
      // to translate.
      debugMark("skipped contains-excluded-node");
      return NodeFilter.FILTER_SKIP;
    }

    // This node can be treated as entire block to submit for translation.
    return NodeFilter.FILTER_ACCEPT;
  }

  /**
   * Queue a node for translation.
   * @param {Node} node
   */
  queueTranslation(node) {
    const id = this.translationsCounter++;

    // debugging: mark the node so we can add CSS to see them
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.setAttribute("x-bergamot-translated", id);
    }

    /** @type {NodeVisibility} */
    let visibility = "out-of-viewport";
    if (isNodeHidden(node)) {
      visibility = "hidden";
    } else if (isNodeInViewport(node)) {
      visibility = "in-viewport";
    }

    this.queuedNodes.set(node, { id, visibility });
  }

  /**
   * Submit the translations giving priority to visible nodes.
   */
  async dispatchQueuedTranslations() {
    let inViewportCounts = 0;
    let outOfViewportCounts = 0;
    let hiddenCounts = 0;

    let inViewportTranslations;
    if (!this.viewportTranslated) {
      inViewportTranslations = [];
    }

    for (const [node, { id, visibility }] of this.queuedNodes) {
      if (visibility === "in-viewport") {
        inViewportCounts++;
        const promise = this.submitTranslation(id, node);
        if (inViewportTranslations) {
          inViewportTranslations.push(promise);
        }
      }
    }
    for (const [node, { id, visibility }] of this.queuedNodes) {
      if (visibility === "out-of-viewport") {
        outOfViewportCounts++;
        this.submitTranslation(id, node);
      }
    }
    for (const [node, { id, visibility }] of this.queuedNodes) {
      if (visibility === "hidden") {
        hiddenCounts++;
        this.submitTranslation(id, node);
      }
    }

    ChromeUtils.addProfilerMarker(
      "Translations",
      null,
      `Translate ${this.queuedNodes.size} nodes.\n\n` +
        `In viewport: ${inViewportCounts}\n` +
        `Out of viewport: ${outOfViewportCounts}\n` +
        `Hidden: ${hiddenCounts}\n`
    );

    this.queuedNodes.clear();

    if (!this.viewportTranslated && inViewportTranslations) {
      this.viewportTranslated = Promise.allSettled(inViewportTranslations);
    }
  }

  /**
   * Record how many words were in the viewport, as this is the most important
   * user-visible translation content.
   */
  reportWordsInViewport() {
    if (
      // This promise gets created for the first dispatchQueuedTranslations
      this.viewportTranslated ||
      this.queuedNodes.size === 0
    ) {
      return;
    }

    // Only report once.
    this.initialWordsInViewportReported = true;

    // TODO - Add telemetry.
    // TODO - This will not work in CJK-like languages. This requires a segmenter
    // for a proper implementation.

    const whitespace = /\s+/;
    let wordCount = 0;
    for (const [node, message] of this.queuedNodes) {
      if (message.visibility === "in-viewport") {
        wordCount += node.textContent.trim().split(whitespace).length;
      }
    }
    const message = wordCount + " words are in the viewport.";
    lazy.console.log(message);
    ChromeUtils.addProfilerMarker("Translation", null, message);
  }

  /**
   * @param {number} id
   * @param {Node} node
   */
  async submitTranslation(id, node) {
    // Give each element an id that gets passed through the translation so it can be
    // reunited later on.
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.querySelectorAll("*").forEach((el, i) => {
        el.dataset.xBergamotId = i;
      });
    }

    let text, translate;
    if (node.nodeType === Node.ELEMENT_NODE) {
      text = node.innerHTML;
      translate = this.translateHTML;
    } else {
      text = node.textContent;
      translate = this.translateText;
    }

    if (text.trim().length === 0) {
      return;
    }

    // Mark this node as not to be translated again unless the contents are changed
    // (which the observer will pick up on)
    this.processedNodes.add(node);

    this.pendingTranslationsCount++;
    try {
      const [translatedHTML] = await translate(text);
      this.pendingTranslationsCount--;
      this.scheduleCompletedTranslation(node, translatedHTML);
    } catch (error) {
      this.pendingTranslationsCount--;
      lazy.console.error("Translation failed", error);
    }
  }

  startMutationObserver() {
    for (const node of this.rootNodes) {
      this.observer.observe(node, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  stopMutationObserver() {
    this.observer.disconnect();
  }

  /**
   * This is called every `UPDATE_INTERVAL` ms with translations for nodes.
   */
  updateNodesWithTranslations() {
    // Stop the mutations so that the updates won't trigger observations.
    this.stopMutationObserver();

    for (const { node, translatedHTML } of this.nodesWithTranslatedHTML) {
      switch (node.nodeType) {
        case Node.TEXT_NODE: {
          if (translatedHTML.trim().length !== 0) {
            // Only update the node if there is new text.
            node.textContent = translatedHTML;
          }
          break;
        }
        case Node.ELEMENT_NODE: {
          const translatedDocument = this.domParser.parseFromString(
            `<div>${translatedHTML}</div>`,
            "text/html"
          );
          updateElement(translatedDocument, node);
          break;
        }
      }
    }

    this.nodesWithTranslatedHTML.clear();
    this.updateTimeout = null;

    // Done mutating the DOM.
    this.startMutationObserver();
  }

  /**
   * Queue an element to be updated with a translation.
   *
   * @param {Node} node
   * @param {string} translatedHTML
   */
  scheduleCompletedTranslation(node, translatedHTML) {
    // Add the nodes to be populated with the next translation update.
    this.nodesWithTranslatedHTML.add({ node, translatedHTML });

    if (this.pendingTranslationsCount === 0) {
      // No translations are pending, update the elements.
      this.updateNodesWithTranslations();
    } else if (!this.updateTimeout) {
      // Schedule an update.
      this.updateTimeout = lazy.setTimeout(
        this.updateNodesWithTranslations.bind(this),
        UPDATE_INTERVAL
      );
    } else {
      // An update has been previously scheduled, do nothing here.
    }
  }

  /**
   * Check to see if a language matches the fromLanguage.
   *
   * @param {Node} node
   */
  matchesFromLanguage(node) {
    if (!node.lang) {
      // No `lang` was present, so assume it matches the language.
      return true;
    }

    // First, cheaply check if language tags match, without canonicalizing.
    if (langTagsMatch(this.fromLanguage, node.lang)) {
      return true;
    }

    try {
      // Make sure the local is in the canonical form, and check again. This function
      // throws, so don't trust that the language tags are formatting correctly.
      const [language] = Intl.getCanonicalLocales(node.lang);

      return langTagsMatch(this.fromLanguage, language);
    } catch (_error) {
      return false;
    }
  }
}

/**
 * @param {Node} node
 */
function isNodeHidden(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  if (node.offsetParent === null) {
    // Bail out early so that we don't have to compute the style, which can be expensive.
    return true;
  }

  const window = node.ownerGlobal;
  const { display, visibility } = window.getComputedStyle(node);
  return display === "none" || visibility === "hidden";
}

/**
 * Add stylesheets to debug the bergamot translations.
 *
 * @param {Document} document
 */
function addDebugStylesheet(document) {
  const element = document.createElement("style");
  element.textContent = "";
  document.head.appendChild(element);
  if (!element.sheet) {
    return;
  }
  const sheet = element.sheet;
  sheet.insertRule(
    "html[x-bergamot-debug] [x-bergamot-translated] { outline: 2px solid red; }",
    0
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated~="skipped"] { outline: 2px solid purple; }',
    1
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated~="rejected"] { outline: 2px solid yellow; }',
    2
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated=""] { outline: 2px solid blue; }',
    3
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated=""] [x-bergamot-translated~="is-excluded-node"] { outline: 4px dashed red; }',
    4
  );
}

/**
 * This function cheaply checks that language tags match.
 *
 * @param {string} knownLanguage
 * @param {string} otherLanguage
 */
function langTagsMatch(knownLanguage, otherLanguage) {
  if (knownLanguage === otherLanguage) {
    // A simple direct match.
    return true;
  }
  if (knownLanguage.length !== 2) {
    throw new Error("Expected the knownLanguage to be of length 2.");
  }
  // Check if the language tags part match, e.g. "en" and "en-US".
  return (
    knownLanguage[0] === otherLanguage[0] &&
    knownLanguage[1] === otherLanguage[1] &&
    otherLanguage[2] === "-"
  );
}

/**
 * @param {node} node
 */
function isNodeInViewport(node) {
  const window = node.ownerGlobal;
  const document = node.ownerDocument;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  const rect = node.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * @param {Document} translatedDocument
 * @param {Element} element
 * @returns {void}
 */
function updateElement(translatedDocument, element) {
  element.setAttribute("x-bergamot-translated", "");

  // This text should have the same layout as the target, but it's not completely
  // guaranteed since the content page could change at any time, and the translation process is async.
  //
  // The document has the following structure:
  //
  // <html>
  //   <head>
  //   <body>{translated content}</body>
  // </html>

  const originalHTML = element.innerHTML;

  /**
   * The Set of translation IDs for nodes that have been cloned.
   * @type {Set<number>}
   */
  const clonedNodes = new Set();

  merge(element, translatedDocument.body.firstChild);

  /**
   * Merge the live tree with the translated tree by re-using elements from the live tree.
   *
   * @param {Node} liveTree
   * @param {Node} translatedTree
   */
  function merge(liveTree, translatedTree) {
    /** @type {Map<number, Element>} */
    const liveElementsById = new Map();

    /** @type {Array<Text>} */
    const liveTextNodes = [];

    // Remove all the nodes from the liveTree, and categorize them by
    // Text node or Element node.
    for (const node of [...liveTree.childNodes]) {
      node.remove();

      if (node.nodeType === Node.ELEMENT_NODE) {
        liveElementsById.set(node.dataset.xBergamotId, node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        liveTextNodes.push(node);
      }
    }

    // The translated tree dictates the order.
    const translatedNodes = [...translatedTree.childNodes];
    for (
      let translatedIndex = 0;
      translatedIndex < translatedNodes.length;
      translatedIndex++
    ) {
      const translatedNode = translatedNodes[translatedIndex];

      if (translatedNode.nodeType === Node.TEXT_NODE) {
        // Copy the translated text to the original Text node and re-append it.
        let liveTextNode = liveTextNodes.shift();

        if (liveTextNode) {
          liveTextNode.data = translatedNode.data;
        } else {
          liveTextNode = translatedNode;
        }

        liveTree.appendChild(liveTextNode);
      } else if (translatedNode.nodeType === Node.ELEMENT_NODE) {
        const translationId = translatedNode.dataset.xBergamotId;
        // Element nodes try to use the already existing DOM nodes.

        // Find the element in the live tree that matches the one in the translated tree.
        let liveElement = liveElementsById.get(translationId);

        if (!liveElement) {
          lazy.console.warn("Could not find a corresponding live element", {
            path: createNodePath(translatedNode, translatedDocument.body),
            translationId,
            liveElementsById,
            translatedNode,
          });
          continue;
        }

        // Has this element already been added to the list? Then duplicate it and re-add
        // it as a clone. The Translations Engine can sometimes duplicate HTML.
        if (liveElement.parentNode) {
          liveElement = liveElement.cloneNode(true /* deep clone */);
          clonedNodes.add(translationId);
          lazy.console.warn(
            "Cloning a node because it was already inserted earlier",
            {
              path: createNodePath(translatedNode, translatedDocument.body),
              translatedNode,
              liveElement,
            }
          );
        }

        if (isNodeTextEmpty(translatedNode)) {
          // The original node had text, but the one that came out of translation
          // didn't have any text. Report this issue.
          lazy.console.warn(
            "The translated element has no text even though the original did.",
            {
              path: createNodePath(translatedNode, translatedDocument.body),
              translatedNode,
              liveElement,
            }
          );

          // This scenario might be caused by one of two causes:
          //
          //   1) The element was duplicated by translation but then not given text
          //      content. This happens on Wikipedia articles for example.
          //
          //   2) The translator messed up and could not translate the text. This
          //      happens on Youtube in the language selector. In that case, having the
          //      original text is much better than no text at all.
          //
          // To make sure it is case 1 and not case 2 check whether this is the only occurrence.
          if (
            translatedNodes.some(
              (sibling, i) =>
                sibling.nodeType === Node.ELEMENT_NODE &&
                translatedIndex !== i &&
                translatedNode.dataset.xBergamotId ===
                  sibling.dataset.xBergamotId
            )
          ) {
            removeTextNodes(liveElement);
          }
        } else if (!isNodeTextEmpty(liveElement)) {
          // There are still text nodes to find and update, recursively merge.
          merge(liveElement, translatedNode);
        }

        // Put the live node back in the live branch. But now t has been synced with the
        // translated text and order.
        liveTree.appendChild(liveElement);
      }
    }

    const unhandledElements = [...liveElementsById].filter(
      ([, element]) => !element.parentNode
    );

    if (unhandledElements.length) {
      lazy.console.warn(
        `${createNodePath(
          translatedTree,
          translatedDocument.body
        )} Not all nodes unified`,
        {
          unhandledElements,
          clonedNodes,
          originalHTML,
          translatedHTML: translatedDocument.body.innerHTML,
          liveTree: liveTree.outerHTML,
          translatedTree: translatedTree.outerHTML,
        }
      );
    }
  }
}

/**
 * For debug purposes, compute a string path to an element.
 *
 * e.g. "div/div#header/p.bold.string/a"
 *
 * @param {Node} node
 * @param {Node | null} root
 */
function createNodePath(node, root) {
  if (root === null) {
    root = node.ownerDocument.body;
  }
  let path =
    node.parentNode && node.parentNode !== root
      ? createNodePath(node.parentNode)
      : "";
  path += `/${node.nodeName}`;
  if (node.id) {
    path += `#${node.id}`;
  } else if (node.className) {
    for (const className of node.classList) {
      path += "." + className;
    }
  }
  return path;
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isNodeTextEmpty(node) {
  if ("innerText" in node) {
    return node.innerText.trim().length === 0;
  }
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    return node.nodeValue.trim().length === 0;
  }
  return true;
}

/**
 * @param {Node} node
 */
function removeTextNodes(node) {
  for (const child of node.childNodes) {
    switch (child.nodeType) {
      case Node.TEXT_NODE:
        node.removeChild(child);
        break;
      case Node.ELEMENT_NODE:
        removeTextNodes(child);
        break;
      default:
        break;
    }
  }
}

/**
 * Test whether any of the direct child text nodes of are non-whitespace
 * text nodes.
 *
 * For example:
 *   - `<p>test</p>`: yes
 *   - `<p> </p>`: no
 *   - `<p><b>test</b></p>`: no
 * @param {Node} node
 * @returns {boolean}
 */
function hasTextNodes(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    // Only check element nodes.
    return false;
  }

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent.trim() === "") {
        // This is just whitespace.
        continue;
      }
      // A text node with content was found.
      return true;
    }
  }

  // No text nodes were found.
  return false;
}

/**
 * Like `isExcludedNode` but looks at the full subtree. Used to see whether
 * we can submit a subtree, or whether we should split it into smaller
 * branches first to try to exclude more of the non-translatable content.
 *
 * @param {Node} node
 * @param {string} excludedNodeSelector
 * @returns {boolean}
 */
function containsExcludedNode(node, excludedNodeSelector) {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    node.querySelector(excludedNodeSelector)
  );
}

/**
 * Check if this node has already been queued to be translated. This can be because
 * the node is itself is queued, or its parent node is queued.
 *
 * @param {Node} node
 * @param {Set<Node>} queuedNodes
 * @returns {boolean}
 */
function isNodeQueued(node, queuedNodes) {
  if (queuedNodes.has(node)) {
    return true;
  }

  // If the immediate parent is the body, it is allowed.
  if (node.parentNode === node.ownerDocument.body) {
    return false;
  }

  // let's iterate until we find either the body or if the parent was sent
  let lastNode = node;
  while (lastNode.parentNode) {
    if (queuedNodes.has(lastNode.parentNode)) {
      return lastNode.parentNode;
    }
    lastNode = lastNode.parentNode;
  }

  return false;
}

/**
 * Test whether this node should be treated as a wrapper of text, e.g.
 * a `<p>`, or as a wrapper for block elements, e.g. `<div>`, based on
 * its ratio of assumed inline elements, and assumed "block" elements. This algorithm
 * is based on heuristics and is a best effort attempt at sorting contents without
 * actually computing the style of every element.
 *
 * If it's a Text node, it's inline.
 *
 *  "Lorem ipsum"
 *
 * If it is mostly filled with assumed "inline" elements, treat it as inline.
 *   <p>
 *     Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 *     <b>Nullam ut finibus nibh</b>, at tincidunt tellus.
 *   </p>
 *
 *   Since it has 3 "inline" elements.
 *     1. "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
 *     2. <b>Nullam ut finibus nibh</b>
 *     3. ", at tincidunt tellus."
 *
 * If it's mostly filled with block elements, do not treat it as inline.
 *
 *   <section>
 *     Lorem ipsum <strong>dolor sit amet.</strong>
 *     <div>Nullam ut finibus nibh, at tincidunt tellus.</div>
 *     <div>Morbi pharetra mauris sed nisl mollis molestie.</div>
 *     <div>Donec et nibh sit amet velit tincidunt auctor.</div>
 *   </section>
 *
 *   This node has 2 presumed "inline" elements:
 *       1 "Lorem ipsum"
 *       2. <strong>dolor sit amet.</strong>.
 *
 *   And the 3 div "block" elements. Since 3 "block" elements > 2 "inline" elements,
 *   it is presumed to be "inline".
 *
 * @param {Node} node
 * @returns {boolean}
 */
function hasPresumedInlineContent(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return true;
  }

  let inlineElements = 0;
  let blockElements = 0;

  for (let child of node.childNodes) {
    switch (child.nodeType) {
      case Node.TEXT_NODE:
        if (!isNodeTextEmpty(child)) {
          inlineElements += 1;
        }
        break;
      case Node.ELEMENT_NODE: {
        const tagName = child.nodeName.toLowerCase();
        if (INLINE_TAGS.has(tagName)) {
          inlineElements += 1;
        } else if (
          GENERIC_TAGS.has(tagName) &&
          hasPresumedInlineContent(child)
        ) {
          inlineElements += 1;
        } else {
          blockElements += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  return inlineElements >= blockElements;
}

/**
 * Returns an iterator of a node's ancestors.
 *
 * @param {Node} node
 * @returns {Generator<ParentNode>}
 */
function* getAncestorsIterator(node) {
  const document = node.ownerDocument;
  for (
    let parent = node.parentNode;
    parent && parent !== document.documentElement;
    parent = parent.parentNode
  ) {
    yield parent;
  }
}
