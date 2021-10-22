/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * The two exported symbols: parseHFromStr and parseHFromUrl
 * are aimed to be used by the workshop backend through callOnMainThread.
 * Microformat format is based on HTML format and consequently
 * we need to parse and walk into a HTML document which is only doable
 * on the main thread.
 */
const EXPORTED_SYMBOLS = ["parseHFromStr", "parseHFromUrl"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const parserUtils = Cc["@mozilla.org/parserutils;1"].getService(
  Ci.nsIParserUtils
);

XPCOMUtils.defineLazyGlobalGetters(this, ["XMLHttpRequest"]);

/**
 * Fetch html data for a href.
 * @param {string} aUrl
 * @returns {Promise}
 */
function fetchData(aUrl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      resolve(xhr.responseXML);
    };
    xhr.onabort = xhr.onerror = xhr.ontimeout = () => {
      reject(new Error("xmlhttprequest failed"));
    };
    xhr.open("GET", aUrl);
    xhr.responseType = "document";
    xhr.overrideMimeType("text/html");
    xhr.send();
  });
}

/**
 * Parse a html stream to get h-* data or null if nothing.
 *
 * @param {string} aUrl
 * @param {string} aType can be either "feed" or "event"
 * @returns {Object|null}
 */
async function parseHFromUrl(aUrl, aType) {
  const doc = await fetchData(aUrl);
  const options = { baseUrl: aUrl };
  return parseHFromDoc(doc, options, aType);
}

/**
 * Parse a string to get h-* data or null if nothing.
 *
 * @param {string} aStr
 * @param {string} aBaseUrl
 * @param {string} aType can be either "feed" or "event"
 * @returns {Object|null}
 */
function parseHFromStr(aStr, aBaseUrl, aType) {
  const doc = new DOMParser().parseFromString(aStr, "text/html");
  const options = { baseUrl: aBaseUrl };
  return parseHFromDoc(doc, options, aType);
}

/**
 * Parse a HTML document to get h-* data or null if nothing.
 *
 * @param {Document} aDoc
 * @param {Object} aOptions
 * @param {string} aType can be either "feed" or "event"
 * @returns {Object|null}
 */
function parseHFromDoc(aDoc, aOptions, aType) {
  if (aType === "feed") {
    return parseHFeedFromDoc(aDoc, aOptions);
  } else if (aType === "event") {
    return parseHEventsFromDoc(aDoc, aOptions);
  }

  throw new Error(`Cannot parse a h-${aType}`);
}

/**
 * Parse a HTML document to get h-feed data or null if nothing.
 * h-feed format is described here:
 *   http://microformats.org/wiki/h-feed
 *
 * @param {Document} aDoc
 * @param {Object} aOptions
 * @returns {Object|null}
 */
function parseHFeedFromDoc(aDoc, aOptions) {
  const walker = aDoc.createTreeWalker(
    aDoc.documentElement,
    NodeFilter.SHOW_ELEMENT
  );
  const hfeed = Object.create(null);
  hfeed.entries = [];

  let node = walker.nextNode();
  while (true) {
    if (!node) {
      break;
    }
    if (node.classList.contains("h-feed")) {
      parseHFeed(node, hfeed, aOptions);
      break;
    }
    if (node.classList.contains("h-entry")) {
      parseHEntry(node, hfeed, aOptions);
      node = nextSiblingOrParentSibling(walker);
      continue;
    }
    node = walker.nextNode();
  }

  // If there are no entries and no hfeed info then it isn't a h-feed.
  return hfeed.entries.length === 0 &&
    Object.getOwnPropertyNames(hfeed).length === 1
    ? null
    : hfeed;
}

/**
 * Parse a HTML document to get h-event data or null if nothing.
 * h-event format is described here:
 *   http://microformats.org/wiki/h-event
 *
 * @param {Document} aDoc
 * @param {Object} aOptions
 * @returns {Array<Object>|null}
 */
function parseHEventsFromDoc(aDoc, aOptions) {
  const walker = aDoc.createTreeWalker(
    aDoc.documentElement,
    NodeFilter.SHOW_ELEMENT
  );
  const hevents = [];

  let node = walker.nextNode();
  while (true) {
    if (!node) {
      break;
    }

    if (node.classList.contains("h-event")) {
      parseHEvent(node, hevents, aOptions);
      node = nextSiblingOrParentSibling(walker);
      continue;
    }
    node = walker.nextNode();
  }

  // If there are no entries and no hfeed info then it isn't a h-feed.
  return hevents.length === 0 ? null : hevents;
}

/**
 * Get the next sibling if any, else the next parent sibling and so on.
 *
 * @param {TreeWalker} aWalker
 * @returns {Node}
 */
function nextSiblingOrParentSibling(aWalker) {
  while (!aWalker.nextSibling()) {
    if (!aWalker.parentNode()) {
      return null;
    }
  }
  return aWalker.currentNode;
}

/**
 * Check if aNode has a class name starting with p, u, dt or e
 * as specified:
 *   http://microformats.org/wiki/microformats2-parsing#parse_an_element_for_class_microformats
 *
 * @param {Node} aNode
 * @returns {boolean}
 */
function isAPropertyElement(aNode) {
  const kPrefixPattern = /^([pue]|dt)-/;
  for (const className of aNode.classList.values()) {
    if (kPrefixPattern.test(className)) {
      return true;
    }
  }
  return false;
}

/**
 * Collect the node values as specified:
 *   http://microformats.org/wiki/value-class-pattern#Basic_Parsing
 * @param {Node} aNode
 * @param {function} aAction
 * @returns {Array<*>}
 */
function collectValues(aNode, aAction) {
  const walker = aNode.ownerDocument.createTreeWalker(
    aNode,
    NodeFilter.SHOW_ELEMENT
  );
  const results = [];
  let child = walker.nextNode();
  while (true) {
    if (!child) {
      return results;
    }

    if (child.classList.contains("value")) {
      results.push(aAction(child));
      // (4) Descendants with class of value must not be parsed
      // deeper than one level.
      child = nextSiblingOrParentSibling(walker);
      continue;
    }

    if (isAPropertyElement(child)) {
      // Don't visit this child
      // See (2): ... class name value (a "value element") not inside
      // some other property element,...
      child = nextSiblingOrParentSibling(walker);
      continue;
    }

    child = walker.nextNode();
  }
}

/**
 * Get an attribute from aNode if its tag name belongs to tagNames.
 * @param {Node} aNode
 * @param {Array<string>} aTagNames
 * @param {string} aAttributeName
 * @returns {string|undefined}
 */
function getAttributeFor(aNode, aTagNames, aAttributeName) {
  return aTagNames.includes(aNode.tagName)
    ? aNode.getAttribute(aAttributeName)
    : undefined;
}

/**
 * Get an attribute from aNode if its tag name belongs to tagNames
 * and apply the action to it.
 * @param {Node} aNode
 * @param {Array<string>} aTagNames
 * @param {string} aAttributeName
 * @param {function} aAction
 * @returns {*}
 */
function getAttributeForAndApply(aNode, aTagNames, aAttributeName, aAction) {
  if (!aTagNames.includes(aNode.tagName)) {
    return undefined;
  }
  const value = aNode.getAttribute(aAttributeName);
  return value && aAction(value);
}

/**
 * Get a date-time from some values.
 * See http://microformats.org/wiki/value-class-pattern#Date_and_time_parsing
 *
 * @param {Array<string>} aValues
 * @returns {Date|undefined}
 */
function parseDateTime(aValues) {
  if (aValues.length === 0) {
    return undefined;
  }

  const MILLIS_BY_SEC = 1000;
  const MILLIS_BY_MIN = 60 * MILLIS_BY_SEC;
  const MILLIS_BY_HOUR = 60 * MILLIS_BY_MIN;
  const MILLIS_BY_DAY = 24 * MILLIS_BY_HOUR;

  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})(Z|([-+]\d{2}:?\d{2})))$/;
  let dateInMillis, timeInMillis, timeZoneInMillis;

  // Get the number of hours depending of we're using am, pm or nothing.
  const getHours = (h, ap) => {
    if (!ap) {
      return h;
    }
    return (h % 12) + (ap === "a" ? 0 : 12);
  };

  const patterns = [
    [
      // YYYY-MM-DD
      /^(\d{4})-(\d{2})-(\d{2})/,
      (y, m, d) => {
        dateInMillis ??= new Date(
          parseInt(y),
          parseInt(m) - 1,
          parseInt(d)
        ).valueOf();
      },
    ],
    [
      // YYYY-DDD
      /^(\d{4})-(\d{3})/,
      (y, d) => {
        dateInMillis ??=
          new Date(parseInt(y), 0, 1).valueOf() +
          (parseInt(d) - 1) * MILLIS_BY_DAY;
      },
    ],
    [
      // HH:MM:SS-XX:YY
      // HH:MM:SS+XX:YY
      // HH:MM:SS-XXYY
      // HH:MM:SS+XXYY
      // HH:MM:SSZ
      // HH:MM:SS
      // HH:MM-XX:YY
      // HH:MM+XX:YY
      // HH:MM-XXYY
      // HH:MM+XXYY
      // HH:MMZ
      // HH:MM
      /^(\d{2}):(\d{2})(?:([aApP])\.?[mM]\.?)?(?::(\d{2})(?:([aApP])\.?[mM]\.?))?(?:Z|([-+])(\d{2}):?(\d{2}))?/,
      (h, m, ap1, s, ap2, pm, x, y) => {
        timeInMillis ??=
          getHours(parseInt(h), (ap1 ?? ap2)?.toLowerCase()) * MILLIS_BY_HOUR +
          parseInt(m) * MILLIS_BY_MIN +
          parseInt(s || 0) * MILLIS_BY_SEC -
          (pm === "-" ? -1 : 1) *
            (parseInt(x || 0) * MILLIS_BY_HOUR +
              parseInt(y || 0) * MILLIS_BY_MIN);
      },
    ],
    [
      // -XX:YY
      // +XX:YY
      // -XXYY
      // +XXYY
      // -XX
      // +XX
      // Z
      /^Z|^([-+])(\d{2}):?(\d{2})?/,
      (pm, x, y) => {
        timeZoneInMillis ??=
          (pm === "-" ? -1 : 1) *
          (parseInt(x || 0) * MILLIS_BY_HOUR +
            parseInt(y || 0) * MILLIS_BY_MIN);
      },
    ],
  ];

  for (const value of aValues) {
    if (isoPattern.test(value)) {
      return new Date(value);
    }

    for (const [pattern, action] of patterns) {
      const match = pattern.exec(value);
      if (match) {
        action(...match.slice(1));
      }
    }
  }

  const dateTimeInMillis =
    (dateInMillis || 0) + (timeInMillis || 0) - (timeZoneInMillis || 0);
  return dateTimeInMillis ? new Date(dateTimeInMillis) : undefined;
}

/**
 * Get the string value of aNode.
 * See http://microformats.org/wiki/value-class-pattern.
 *
 * @param {Node} aNode
 * @returns {string|undefined}
 */
function valueClassPattern(aNode) {
  const values = collectValues(
    aNode,
    el =>
      getAttributeFor(el, ["IMG", "AREA"], "alt") ??
      getAttributeFor(el, ["DATA"], "value") ??
      getAttributeFor(el, ["ABBR"], "title") ??
      el.innerText
  );

  if (!values.length) {
    return undefined;
  }

  // http://microformats.org/wiki/value-class-pattern#Basic_Parsing
  // (3.1) if the microformats property expects a simple string, enumerated
  // value, or telephone number, then the values extracted from the value
  // elements should be concatenated without inserting additional characters
  // or white-space.
  return values.join("").trim();
}

/**
 * Get the string value of aNode and apply a function.
 *
 * @param {Node} aNode
 * @param {function} aAction
 * @returns {*}
 */
function valueClassPatternAndApply(aNode, aAction) {
  const value = valueClassPattern(aNode);
  return value && aAction(value);
}

/**
 * Get the dateTime value of aNode.
 * See http://microformats.org/wiki/value-class-pattern.
 *
 * @param {Node} aNode
 * @returns {Date|undefined}
 */
function valueClassPatternDateTime(aNode) {
  const values = collectValues(
    aNode,
    el =>
      getAttributeFor(el, ["IMG", "AREA"], "alt") ??
      getAttributeFor(el, ["DATA"], "value") ??
      getAttributeFor(el, ["ABBR"], "title") ??
      getAttributeFor(el, ["DEL", "INS", "TIME"], "datetime") ??
      el.innerText
  );

  if (!values.length) {
    return undefined;
  }

  // http://microformats.org/wiki/value-class-pattern#Basic_Parsing
  // See (3.2).
  return parseDateTime(values);
}

/**
 * Get an URL from an IMG if any.
 * See http://microformats.org/wiki/microformats2-parsing#parse_an_img_element_for_src_and_alt
 *
 * @param {Node} aNode
 * @param {function} aGetURL
 * @returns {string|undefined}
 */
function parseImageURL(aNode, aGetURL) {
  if (aNode.tagName !== "IMG") {
    return undefined;
  }

  const alt = aNode.getAttribute("alt");
  const value = aGetURL(aNode.getAttribute("src"));
  return alt ? { alt, value } : value;
}

/**
 * Parse a p-* property.
 * See http://microformats.org/wiki/microformats2-parsing#parsing_a_p-_property.
 *
 * @param {Node} aNode
 * @returns {string}
 */
function parseP(aNode) {
  return (
    valueClassPattern(aNode) ??
    getAttributeFor(aNode, ["ABBR", "LINK"], "title") ??
    getAttributeFor(aNode, ["DATA", "INPUT"], "value") ??
    getAttributeFor(aNode, ["IMG", "AREA"], "alt") ??
    aNode.innerText
  );
}

/**
 * Parse a u-* property.
 * See http://microformats.org/wiki/microformats2-parsing#parsing_a_u-_property.
 *
 * @param {Node} aNode
 * @param {Object} aOptions
 * @returns {string|Object}
 */
function parseU(aNode, aOptions) {
  const { baseUrl } = aOptions;
  const getURL = value => {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return baseUrl;
    }
  };
  return (
    getAttributeForAndApply(aNode, ["A", "AREA", "LINK"], "href", getURL) ??
    parseImageURL(aNode, getURL) ??
    getAttributeForAndApply(
      aNode,
      ["AUDIO", "VIDEO", "SOURCE", "IFRAME"],
      "src",
      getURL
    ) ??
    getAttributeForAndApply(aNode, ["VIDEO"], "poster", getURL) ??
    getAttributeForAndApply(aNode, ["OBJECT"], "data", getURL) ??
    valueClassPatternAndApply(aNode, getURL) ??
    getAttributeForAndApply(aNode, ["ABBR"], "title", getURL) ??
    getAttributeForAndApply(aNode, ["DATA", "INPUT"], "value", getURL) ??
    getURL(aNode.innerText)
  );
}

/**
 * Parse a dt-* property.
 * See http://microformats.org/wiki/microformats2-parsing#parsing_a_dt-_property.
 *
 * @param {Node} aNode
 * @returns {Date}
 */
function parseDt(aNode) {
  const getDate = value => new Date(value);
  return (
    valueClassPatternDateTime(aNode) ??
    getAttributeForAndApply(
      aNode,
      ["TIME", "INS", "DEL"],
      "datetime",
      getDate
    ) ??
    getAttributeForAndApply(aNode, ["ABBR"], "title", getDate) ??
    getAttributeForAndApply(aNode, ["DATA", "INPUT"], "value", getDate) ??
    getDate(aNode.innerText)
  );
}

/**
 * Parse a e-* property.
 * See http://microformats.org/wiki/microformats2-parsing#parsing_a_e-_property
 *
 * @param {Node} aNode
 * @returns {string}
 */
function parseE(aNode) {
  const SanitizerFlags =
    parserUtils.SanitizerDropForms |
    parserUtils.SanitizerDropMedia |
    parserUtils.SanitizerDropNonCSSPresentation;

  // TODO: it's a bit useless and time consuming to serialize and
  // sanitize (== parse + filter + serialize).
  // So we should likely add the ability to sanitize a node.
  const serialized = aNode.innerHtml;
  const html = parserUtils.sanitize(serialized, SanitizerFlags).trim();

  return {
    value: aNode.innerText.trim(),
    html,
  };
}

/**
 * Parse aNode for the given property (p-*, u-*, dt-* and e-*).
 * @param {Node} aNode
 * @param {Object} aData
 * @param {string} aHPropertyName
 * @param {Object} aOptions
 */
function parseNodeForProperty(aNode, aData, aHPropertyName, aOptions) {
  const idx = aHPropertyName.indexOf("-");
  const type = aHPropertyName.slice(0, idx);
  const propertyName = aHPropertyName.slice(idx + 1);
  let results = aData[propertyName];
  if (!results) {
    aData[propertyName] = results = [];
  }

  switch (type) {
    case "p":
      results.push(parseP(aNode));
      break;
    case "u":
      results.push(parseU(aNode, aOptions));
      break;
    case "dt":
      results.push(parseDt(aNode));
      break;
    case "e":
      results.push(parseE(aNode));
      break;
  }
}

/**
 * Search the valid properties and parse them.
 * @param aNode
 * @param aProperties
 * @param aData
 * @param aOptions
 */
function parseNodeForProperties(aNode, aProperties, aData, aOptions) {
  for (const property of aProperties) {
    if (aNode.classList.contains(property)) {
      parseNodeForProperty(aNode, aData, property, aOptions);
    }
  }
}

/**
 * Parse a h-feed element.
 * See http://microformats.org/wiki/h-feed
 *
 * @param {Node} aRoot
 * @param {Object} aHfeed
 * @param {Object} aOptions
 */
function parseHFeed(aRoot, aHfeed, aOptions) {
  const walker = aRoot.ownerDocument.createTreeWalker(
    aRoot,
    NodeFilter.SHOW_ELEMENT
  );
  const validProperties = ["p-name", "p-author", "u-url", "u-photo"];
  let node = walker.nextNode();

  while (true) {
    if (!node) {
      return;
    }

    parseNodeForProperties(node, validProperties, aHfeed, aOptions);

    if (node.classList.contains("h-entry")) {
      parseHEntry(node, aHfeed, aOptions);
      node = nextSiblingOrParentSibling(walker);
      continue;
    }

    node = walker.nextNode();
  }
}

/**
 * Parse a h-* element.
 *
 * @param {Node} aRoot
 * @param {Array<string>} aValidProperties
 * @param {Object} aData
 * @param {Object} aOptions
 */
function parseHNode(aRoot, aValidProperties, aData, aOptions) {
  const walker = aRoot.ownerDocument.createTreeWalker(
    aRoot,
    NodeFilter.SHOW_ELEMENT
  );

  while (true) {
    const node = walker.nextNode();
    if (!node) {
      return;
    }

    parseNodeForProperties(node, aValidProperties, aData, aOptions);
  }
}

/**
 * Parse a h-entry element.
 * See http://microformats.org/wiki/h-entry
 *
 * @param {Node} aRoot
 * @param {Object} aHfeed
 * @param {Object} aOptions
 */
function parseHEntry(aRoot, aHfeed, aOptions) {
  const kValidProperties = [
    "p-name",
    "p-summary",
    "e-content",
    "dt-published",
    "dt-updated",
    "p-author",
    "p-category",
    "u-url",
    "u-uid",
    "p-location",
    "u-syndication",
    "u-in-reply-to",
    "p-rsvp",
    "u-like-of",
    "u-repost-of",
  ];
  const hentry = Object.create(null);
  aHfeed.entries.push(hentry);
  parseHNode(aRoot, kValidProperties, hentry, aOptions);
}

/**
 * Parse a h-event element.
 * See http://microformats.org/wiki/h-event
 *
 * @param {Node} aRoot
 * @param {Array<Object>} aHevents
 * @param {Object} aOptions
 */
function parseHEvent(aRoot, aHevents, aOptions) {
  const kValidProperties = [
    "p-name",
    "p-summary",
    "dt-start",
    "dt-end",
    "dt-duration",
    "p-description",
    "u-url",
    "p-category",
    "p-location",
  ];
  const hevent = Object.create(null);
  aHevents.push(hevent);
  parseHNode(aRoot, kValidProperties, hevent, aOptions);
}
