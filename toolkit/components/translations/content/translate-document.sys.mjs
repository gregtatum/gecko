/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/*
 * This class manages a translation of the DOM.
 */
export class TranslateDocument {
  /**
   * Used to generate a unique ID for each translation.
   *
   * @type {number}
   */
  translationsCounter = 0;

  /** @type {boolean} */
  started = false;

  /** @type {string} */
  fromLanguage;

  // The timeout between the first franslation received and the call to update the DOM
  // with translations.
  updateTimeout = null;
  UI_UPDATE_INTERVAL = 500;

  /**
   * table of [Element]:Object to be submitted, and some info about them.
   * Filled by queueTranslation(), emptied by dispatchTranslation().
   *
   * @type {Map<Node, {
   *   id: number,
   *   priority: number,
   * }>
   */
  queuedNodes = new Map();

  /*
   * table of [Number]:Element of nodes that have been submitted, and are
   * waiting for a translation.
   */
  pendingTranslations = new Map();

  /*
   * table of [Element]:Number, inverse of pendingTranslations for easy
   * cancelling of incoming responses when the node changed after
   * submission of the request.
   */
  submittedNodes = new Map();

  /*
   * queue with the translation text that they should
   * be filled with once updateTimeout is reached. Filled by
   * `queueTranslationResponse()` and emptied by `updateElements()`.
   */
  translatedNodes = new Map();

  /*
   * set of elements that have been translated and should not be submitted
   * again unless their contents changed.
   */
  processedNodes = new WeakSet();

  // all elements we're actively trying to translate.
  targetNodes = new Set();

  initialWordsInViewportReported = false;

  observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      switch (mutation.type) {
        case "childList":
          mutation.addedNodes.forEach(this.restartTreeWalker.bind(this));
          break;
        case "characterData":
          this.restartTreeWalker(mutation.target);
          break;
        default:
          break;
      }
    }
  });

  /**
   * @param {Document} document
   * @param {string} fromLanguage The two letter BCP 47 language tag.
   */
  constructor(document, fromLanguage) {
    // The language of the page. If elements are found that do not match this language,
    // then they are skipped.
    if (fromLanguage.length !== 2) {
      throw new Error(
        "Expected the language to be a valid 2 letter BCP 47 language tag."
      );
    }
    this.fromLanguage = fromLanguage;

    /** @type {DOMParser} */
    this.domParser = document.ownerGlobal.DOMParser();
  }

  /**
   * Add a new element to start translating.
   *
   * @param {Node} node
   */
  addElement(node) {
    // exclude non elements
    if (!Element.isInstance(node)) {
      return;
    }

    // exclude nodes we're already tracking
    if (this.targetNodes.has(node)) {
      return;
    }

    this.targetNodes.add(node);

    if (this.started) {
      this.startTreeWalker(node);
      this.observer.observe(node, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Start the translation process.
   * @param {Document} document
   */
  start(document) {
    if (this.started) {
      console.warn("TranslateDocument was already started.");
      return;
    }

    this.started = true;

    if (Services.prefs.getBoolPref("browser.translations.debug", false)) {
      this.addDebugStylesheet(document);
    }

    /*
     * pre-construct the excluded node selector. Doing it here since it
     * needs to know `language`. See `containsExcludedNode()`.
     * Note: [lang]:not([lang...]) is too strict as it also matches slightly
     * different language code. In that case the tree walker will drill down
     * and still accept the element in isExcludedNode. Just not as part of
     * a block.
     */
    this.excludedNodeSelector = `[lang]:not([lang|="${
      this.fromLanguage
    }"]),[translate=no],.notranslate,[contenteditable],${Array.from(
      this.excludedTags
    ).join(",")},#OTapp`;

    for (let node of this.targetNodes) {
      this.startTreeWalker(node);
    }

    this.startMutationObserver();
  }

  /*
   * stops the InPageTranslation process, stopping observing and regard any
   * in-flight translation request as lost.
   */
  stop() {
    if (!this.started) {
      return;
    }

    /*
     * todo: cancel translation requests? Not really necessary at this level
     * because stop() is called on disconnect from the background-script,
     * and that script on its own will cancel translation requests from
     * pages it is no longer connected to.
     */

    this.stopMutationObserver();

    /*
     * remove all elements for which we haven't received a translation yet
     * from the 'sent' list.
     */
    this.submittedNodes.clear();

    this.pendingTranslations.forEach(node => {
      this.processedNodes.delete(node);
      this.queueTranslation(node);
    });

    this.pendingTranslations.clear();

    this.started = false;
  }

  /**
   * start walking from `root` down through the DOM tree and decide which
   * elements to enqueue for translation.
   * @param {Node} root
   */
  startTreeWalker(root) {
    /*
     * if the parent itself is rejected, we don't translate any children.
     * However, if this is a specifically targeted node, we don't do this
     * check. Mainly so we can exclude <head>, but include <title>.
     */
    if (!this.targetNodes.has(root)) {
      for (let parent of this.ancestors(root)) {
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
       * either. But we do want to call dispatchTranslations().
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
            this.validateNodeForQueue.bind(this)
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

    this.dispatchTranslations();
  }

  /*
   * like startTreeWalker, but without the "oh ignore this element if it has
   * already been submitted" bit. Use this one for submitting changed elements.
   */
  restartTreeWalker(root) {
    /*
     * remove node from sent map: if it was send, we don't want it to update
     * with an old translation once the translation response comes in.
     */
    const id = this.submittedNodes.get(root);
    if (id) {
      this.submittedNodes.delete(root);
      this.pendingTranslations.delete(id);
    }

    // remove node from processed list: we want to reprocess it.
    this.processedNodes.delete(root);

    // start submitting it again
    this.startTreeWalker(root);
  }

  /*
   * test whether any of the parent nodes are already in the process of being
   * translated. If the parent of the node is already translating we should
   * reject it since we already sent it to translation.
   */
  isParentQueued(node) {
    const document = node.ownerDocument;
    // if the immediate parent is the body we just allow it
    if (node.parentNode === document.body) {
      return false;
    }

    // let's iterate until we find either the body or if the parent was sent
    let lastNode = node;
    while (lastNode.parentNode) {
      if (this.queuedNodes.has(lastNode.parentNode)) {
        return lastNode.parentNode;
      }
      lastNode = lastNode.parentNode;
    }

    return false;
  }

  /*
   * test whether this node should be treated as a wrapper of text, e.g.
   * a `<p>`, or as a wrapper for block elements, e.g. `<div>`, based on
   * its contents. The first we submit for translation, the second we try to
   * split into smaller chunks of HTML for better latency.
   */
  hasInlineContent(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return true;
    }

    let inlineElements = 0;
    let blockElements = 0;

    for (let child of node.childNodes) {
      switch (child.nodeType) {
        case Node.TEXT_NODE:
          if (isNodeTextEmpty(child)) {
            inlineElements += 1;
          }
          break;
        case Node.ELEMENT_NODE: // element
          if (this.inlineTags.has(child.nodeName.toLowerCase())) {
            inlineElements += 1;
          } else if (
            this.genericTags.has(child.nodeName.toLowerCase()) &&
            this.hasInlineContent(child)
          ) {
            inlineElements += 1;
          } else {
            blockElements += 1;
          }
          break;
        default:
          break;
      }
    }

    return inlineElements >= blockElements;
  }

  /*
   * test whether any of the direct text nodes of this node are non-whitespace
   * text nodes.
   *
   * For example:
   *   - `<p>test</p>`: yes
   *   - `<p> </p>`: no
   *   - `<p><b>test</b></p>`: no
   */
  hasTextNodes(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    // there is probably a quicker way to do this
    for (let child of node.childNodes) {
      switch (child.nodeType) {
        case Node.TEXT_NODE: // textNode
          if (child.textContent.trim() !== "") {
            return true;
          }
          break;
        default:
          break;
      }
    }

    return false;
  }

  /**
   * Test whether this is an element we do not want to translate. These are things like
   * <code> elements, elements with a different "lang" attribute, and elements that
   * have a `translate=no` attribute.
   *
   * @param {Node} node
   */
  isExcludedNode(node) {
    // text nodes are never excluded
    if (node.nodeType === Node.TEXT_NODE) {
      return false;
    }

    // exclude certain elements
    if (this.excludedTags.has(node.nodeName.toLowerCase())) {
      return true;
    }

    /*
     * exclude elements that have a lang attribute that mismatches the
     * language we're currently translating. Run it through
     * getCanonicalLocales() because pages get creative.
     */
    try {
      return this.matchesFromLanguage(node);
    } catch (err) {
      if (err.name !== "RangeError") {
        throw err;
      }
    }

    /*
     * exclude elements that have an translate=no attribute
     * (See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate)
     */
    if (node.translate === false || node.getAttribute("translate") === "no") {
      return true;
    }

    // we should explicitly exclude the outbound translations widget
    if (node.id === "OTapp") {
      return true;
    }

    /*
     * exclude elements with the notranslate class which is also honoured
     * by Google Translate
     */
    if (node.classList.contains("notranslate")) {
      return true;
    }

    /*
     * exclude editable elements for the same reason we don't translate the
     * contents of form input fields.
     */
    if (node.contenteditable) {
      return true;
    }

    return false;
  }

  /*
   * like `isExcludedNode` but looks at the full subtree. Used to see whether
   * we can submit a subtree, or whether we should split it into smaller
   * branches first to try to exclude more of the non-translatable content.
   */
  containsExcludedNode(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      node.querySelector(this.excludedNodeSelector)
    );
  }

  /*
   * used by TreeWalker to determine whether to ACCEPT, REJECT or SKIP a
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
   */
  validateNode(node) {
    // little helper to add markings to elements for debugging
    const mark = value => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.setAttribute("x-bergamot-translated", value);
      }
    };

    /*
     * don't resubmit subtrees that are already in progress (unless their
     * contents have been changed
     */
    if (this.queuedNodes.has(node) || this.isParentQueued(node)) {
      // node.setAttribute("x-bergamot-translated", "rejected is-parent-translating");
      return NodeFilter.FILTER_REJECT;
    }

    // exclude nodes that we don't want to translate
    if (this.isExcludedNode(node)) {
      mark("rejected is-excluded-node");
      return NodeFilter.FILTER_REJECT;
    }

    // skip over subtrees that don"t have text
    if (node.textContent.trim().length === 0) {
      mark("rejected empty-text-content");
      return NodeFilter.FILTER_REJECT;
    }

    if (!this.hasInlineContent(node)) {
      mark("skipped does-not-have-text-of-its-own");
      return NodeFilter.FILTER_SKIP; // otherwise dig deeper
    }

    if (this.containsExcludedNode(node) && !this.hasTextNodes(node)) {
      mark("skipped contains-excluded-node");
      return NodeFilter.FILTER_SKIP; // otherwise dig deeper
    }

    return NodeFilter.FILTER_ACCEPT; // send whole node as 1 block
  }

  /*
   * used by TreeWalker to determine whether to ACCEPT, REJECT or SKIP a
   * subtree. Checks whether element is acceptable, and hasn't been
   * translated already.
   */
  validateNodeForQueue(node) {
    // skip nodes already seen (for the partial subtree change, or restart of the whole InPageTranslation process.)
    if (this.processedNodes.has(node)) {
      return NodeFilter.FILTER_REJECT;
    }

    return this.validateNode(node);
  }

  /*
   * enqueue a node for translation. Called during startTreeWalker. Queues
   * are emptied by dispatchTranslation().
   */
  queueTranslation(node) {
    const id = this.translationsCounter++;

    // debugging: mark the node so we can add CSS to see them
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.setAttribute("x-bergamot-translated", id);
    }

    let priority = 2;
    if (isNodeHidden(node)) {
      priority = 3;
    } else if (isNodeInViewport(node)) {
      priority = 1;
    }

    this.queuedNodes.set(node, { id, priority });
  }

  dispatchTranslations() {
    this.reportWordsInViewport();

    const queuesPerPriority = [null, [], [], []]; // priorities 1 to 3
    this.queuedNodes.forEach((message, node) => {
      queuesPerPriority[message.priority].push({ message, node });
    });

    for (let priority = 1; priority <= 3; priority += 1) {
      queuesPerPriority[priority].forEach(({ message, node }) => {
        this.submitTranslation(message, node);
      });
    }

    this.queuedNodes.clear();
  }

  reportWordsInViewport() {
    if (this.initialWordsInViewportReported || this.queuedNodes.size === 0) {
      return;
    }

    let viewPortWordsNum = 0;
    for (const [message, value] of this.queuedNodes.entries()) {
      if (message.priority === 3) {
        viewPortWordsNum += value.textContent.trim().split(/\s+/).length;
      }
    }

    this.notifyMediator("reportViewPortWordsNum", viewPortWordsNum);
    // report words in viewport only for initially loaded content
    this.initialWordsInViewportReported = true;
  }

  submitTranslation({ id }, node) {
    // give each element an id that gets passed through the translation so we can later on reunite it.
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.querySelectorAll("*").forEach((el, i) => {
        el.dataset.xBergamotId = i;
      });
    }

    const text =
      node.nodeType === Node.ELEMENT_NODE ? node.innerHTML : node.textContent;
    if (text.trim().length === 0) {
      return;
    }

    this.notifyMediator("translate", {
      text,
      isHTML: node.nodeType === Node.ELEMENT_NODE,
      type: "inpage",
      attrId: [id],
    });

    // keep reference to this node for once we receive a translation response.
    this.pendingTranslations.set(id, node);
    this.submittedNodes.set(node, id);

    // also mark this node as not to be translated again unless the contents are changed (which the observer will pick up on)
    this.processedNodes.add(node);
  }

  notifyMediator(command, payload) {
    this.mediator.contentScriptsMessageListener(this, { command, payload });
  }

  startMutationObserver() {
    for (let node of this.targetNodes) {
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

  mediatorNotification(translationMessage) {
    /*
     * notification received from the mediator with our request.
     * the only possible notification can be a translation response,
     * so let's schedule the update of the original node with its new content
     */
    this.enqueueElement(translationMessage);
  }

  updateElements() {
    // pause observing mutations
    this.stopMutationObserver();

    try {
      for (const [node, { translatedHTML }] of this.translatedNodes) {
        switch (node.nodeType) {
          case Node.TEXT_NODE: {
            if (translatedHTML.trim().length !== 0) {
              // Only update the node if there is new text.
              node.textContent = translatedHTML;
            }
            break;
          }
          case Node.ELEMENT_NODE: {
            const translatedDOM = this.domParser.parseFromString(
              translatedHTML,
              "text/html"
            );
            updateElement(translatedDOM, node);
            break;
          }
        }
      }
      this.translatedNodes.clear();
      this.updateTimeout = null;
    } finally {
      this.startMutationObserver();
    }
  }

  enqueueElement(translationMessage) {
    const [id] = translationMessage.attrId;
    const translatedHTML = translationMessage.translatedParagraph;

    // look up node by message id. This can fail
    const node = this.pendingTranslations.get(id);
    if (typeof node === "undefined") {
      lazy.console.debug(`Message ${id} is not found in pendingTranslations`);
      return;
    }

    // prune it.
    this.pendingTranslations.delete(id);

    // node still exists! Remove node -> (pending) message mapping
    this.submittedNodes.delete(node);

    // queue node to be populated with translation next update.
    this.translatedNodes.set(node, { id, translatedHTML });

    // we schedule the UI update
    if (!this.updateTimeout) {
      this.updateTimeout = setTimeout(
        this.updateElements.bind(this),
        this.submittedNodes.size === 0 ? 0 : this.UI_UPDATE_INTERVAL
      );
    }
  }

  /**
   * @param {Node} node
   */
  *ancestors(node) {
    const document = node.ownerDocument;
    for (
      let parent = node.parentNode;
      parent && parent !== document.documentElement;
      parent = parent.parentNode
    ) {
      yield parent;
    }
  }

  removeTextNodes(node) {
    Array.from(node.childNodes).forEach(child => {
      switch (child.nodeType) {
        case Node.TEXT_NODE:
          node.removeChild(child);
          break;
        case Node.ELEMENT_NODE:
          this.removeTextNodes(child);
          break;
        default:
          break;
      }
    });
  }

  /**
   * Check to see if a language matches the fromLanguage.
   *
   * @param {Node} node
   */
  matchesFromLanguage(node) {
    if (!node.lang) {
      return true;
    }

    // First cheaply check if language tags match, without canonicalizing.
    if (langTagsMatch(this.fromLanguage, node.lang)) {
      return true;
    }

    try {
      // Make sure the local is in the canonical form, and check again. This function
      // throws, so don't trust that the language tags are formatting correctly.
      const [language] = Intl.getCanonicalLocales(node.lang);

      return langTagsMatch(language);
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
    "html[x-bergamot-debug] [x-bergamot-translated] { border: 2px solid red; }",
    0
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated~="skipped"] { border: 2px solid purple; }',
    1
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated~="rejected"] { border: 2px solid yellow; }',
    2
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated=""] { border: 2px solid blue; }',
    3
  );
  sheet.insertRule(
    'html[x-bergamot-debug] [x-bergamot-translated=""] [x-bergamot-translated~="is-excluded-node"] { border: 4px dashed red; }',
    4
  );
}

/**
 * This function cheaply checks that language tags match.
 *
 * @param {string} langA
 * @param {string} langB
 */
function langTagsMatch(langA, langB) {
  if (langA === langB) {
    // A simple direct match.
    return true;
  }
  // Check if the language tags part match, e.g. "en" and "en-US".
  return langA[0] === langB[0] && langA[1] === langB[1] && langB[2] === "-";
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
 * @param {HTMLCollection} translatedDocument
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

  merge(element, translatedDocument.body);

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

    // Remove all the nodes from the dst, and categorize them by text node or element.
    for (const childNode of liveTree.childNodes) {
      const node = childNode.remove();

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
      const translationId = translatedNode.dataset.xBergamotId;
      if (translatedNode.nodeType === Node.ELEMENT_NODE) {
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

        // Is this element duplicated in the translated and needs to be cloned?
        if (liveElement.parentNode) {
          // If it already has a parentNode, we already used it with appendChild. This
          // can happen, bergamot-translator can duplicate HTML in the same branch.
          liveElement = liveElement.cloneNode(true);
          clonedNodes.add(translationId);
          lazy.console.warn(
            "Cloning a node because it was already inserted earlier",
            {
              path: createNodePath(translatedNode, translatedDocument.body),
              liveElement,
            }
          );
        }

        /*
         * only attempt a recursive merge if there is anything
         * to merge (I mean any translated text)
         */
        if (isNodeTextEmpty(translatedNode)) {
          merge(liveElement, translatedNode);
        } else if (isNodeTextEmpty(liveElement)) {
          /*
           * oh this is bad. The original node had text, but
           * the one that came out of translation doesn't?
           */
          lazy.console.warn(
            `${createNodePath(translatedNode, translatedDocument.body)} Child ${
              translatedNode.outerHTML
            } has no text but counterpart ${liveElement.outerHTML} does`
          );

          // TODO: This scenario might be caused by one of two causes:
          //   1) The element was duplicated by translation but then not given text
          //      content. This happens on Wikipedia articles for example.
          //   2) The translator messed up and could not translate the text. This
          //      happens on Youtube in the language selector. In that case, having the
          //      original text is much better than no text at all.
          //
          // To make sure it is this case, and not option 2 we check whether this is
          // the only occurrence.
          if (
            translatedNodes.some(
              (sibling, i) =>
                sibling.nodeType === Node.ELEMENT_NODE &&
                translatedIndex !== i &&
                translatedNode.dataset.xBergamotId ===
                  sibling.dataset.xBergamotId
            )
          ) {
            this.removeTextNodes(liveElement);
          }
        }

        // Put the live node back in the live branch. But now t has been synced with the
        // translated text and order.
        liveTree.appendChild(liveElement);
      } else if (translatedNode.nodeType === Node.TEXT_NODE) {
        let counterpart = liveTextNodes.shift();

        if (typeof counterpart !== "undefined") {
          counterpart.data = translatedNode.data;
        } else {
          counterpart = translatedNode;
        }

        liveTree.appendChild(counterpart);
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
