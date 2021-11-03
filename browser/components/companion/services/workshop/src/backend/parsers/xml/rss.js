/* Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NamespaceIds } from "./namespaces";
import { StringObject, XMLObject, XMLObjectArray } from "./xml_object";

const RSS_NS_ID = NamespaceIds.get("local").id;
const DEFAULT_IMG_WIDTH = 88;
const DEFAULT_IMG_HEIGHT = 31;
const MAX_IMG_WIDTH = 144;
const MAX_IMG_HEIGHT = 400;

/**
 * The specification of RSS xml format can be found here:
 *   https://www.rssboard.org/rss-specification
 *
 * Node in the XML tree is represented by an object which validates its
 * properties and children. By default a node only accept a child from
 * the same namespace (local ones) but in overriding $onChild method
 * it's possible to accept whatever we want.
 */

class Rss extends XMLObject {
  constructor(attributes) {
    super(RSS_NS_ID, "rss");
    this.version = attributes.get("version") || "";
    this.channel = null;
  }

  $onChildCheck(child) {
    return !child.$isInvalid && super.$onChildCheck(child);
  }
}

/**
 * https://www.rssboard.org/rss-specification#requiredChannelElements
 * https://www.rssboard.org/rss-specification#optionalChannelElements
 */
class Channel extends XMLObject {
  constructor(attributges) {
    super(RSS_NS_ID, "channel");

    // Required.
    this.title = null;
    this.link = null;
    this.description = null;

    // Optional.
    this.language = null;
    this.copyright = null;
    this.managingEditor = null;
    this.webMaster = null;
    this.pubDate = null;
    this.lastBuildDate = null;
    this.category = null;
    this.generator = null;
    this.docs = null;
    this.cloud = null;
    this.ttl = null;
    this.image = null;
    this.textInput = null;
    this.skipHours = null;
    this.skipDays = null;
    this.item = new XMLObjectArray();
  }

  $onChildCheck(child) {
    return !child.$isInvalid && super.$onChildCheck(child);
  }

  $finalize() {
    this.$isInvalid = !(this.title && this.link && this.description);
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltpubdategtSubelementOfLtitemgt
 */
class PubDate extends StringObject {
  constructor() {
    super(RSS_NS_ID, "pubDate");
  }

  $finalize() {
    this.$content = new Date(this.$content);
    this.$isInvalid = isNaN(this.$content);
  }
}

class LastBuildDate extends StringObject {
  constructor() {
    super(RSS_NS_ID, "lastBuildDate");
  }

  $finalize() {
    this.$content = new Date(this.$content);
    this.$isInvalid = isNaN(this.$content);
  }
}

class Category extends StringObject {
  constructor(attributes) {
    super(RSS_NS_ID, "category");
    this.domain = attributes.get("domain") || "";
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltcloudgtSubelementOfLtchannelgt
 */
class Cloud extends StringObject {
  constructor(attributes) {
    super(RSS_NS_ID, "cloud");
    this.domain = attributes.get("domain") || "";
    this.port = attributes.get("port") || "";
    this.path = attributes.get("path") || "";
    this.registerProcedure = attributes.get("registerProcedure") || "";
    this.protocol = attributes.get("protocol") || "";
  }

  $onText(text) {}
}

/**
 * https://www.rssboard.org/rss-specification#ltttlgtSubelementOfLtchannelgt
 */
class Ttl extends StringObject {
  constructor(attributes) {
    super(RSS_NS_ID, "ttl");
  }

  $finalize() {
    this.$content = parseInt(this.$content);
    if (isNaN(this.$content)) {
      this.$isInvalid = true;
    }
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltimagegtSubelementOfLtchannelgt
 */
class Image extends XMLObject {
  constructor(attributes) {
    super(RSS_NS_ID, "image");

    // Required.
    this.url = null;
    this.title = null;
    this.link = null;

    // Optional.
    this.width = null;
    this.height = null;
    this.description = null;
  }

  $onChild(child) {
    if (!this.$onChildCheck(child)) {
      return;
    }

    switch (child.$nodeName) {
      case "width":
        this.width = child.$content || DEFAULT_IMG_WIDTH;
        break;
      case "height":
        this.height = child.$content || DEFAULT_IMG_HEIGHT;
        break;
    }
  }

  $finalize() {
    this.$isInvalid = !(this.url && this.title && this.link);
  }
}

class Width extends StringObject {
  constructor() {
    super(RSS_NS_ID, "width");
  }

  $finalize() {
    this.$content = parseInt(this.$content);
    this.$content = isNaN(this.$content)
      ? null
      : Math.min(MAX_IMG_WIDTH, Math.max(0, this.$content));
  }
}

class Height extends StringObject {
  constructor() {
    super(RSS_NS_ID, "height");
  }

  $finalize() {
    this.$content = parseInt(this.$content);
    this.$content = isNaN(this.$content)
      ? null
      : Math.min(MAX_IMG_HEIGHT, Math.max(0, this.$content));
  }
}

/**
 * https://www.rssboard.org/rss-specification#lttextinputgtSubelementOfLtchannelgt
 */
class TextInput extends XMLObject {
  constructor(attributes) {
    super(RSS_NS_ID, "textInput");
    this.title = null;
    this.description = null;
    this.name = null;
    this.link = null;
  }
}

/**
 * https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt
 */
class Item extends XMLObject {
  constructor(attributes) {
    super(RSS_NS_ID, "item");
    this.title = null;
    this.description = null;
    this.link = null;
    this.author = null;
    this.category = new XMLObjectArray();
    this.comments = null;
    this.enclosure = null;
    this.guid = null;
    this.pubDate = null;
    this.source = null;
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltenclosuregtSubelementOfLtitemgt
 */
class Enclosure extends XMLObject {
  constructor(attributes) {
    super(RSS_NS_ID, "enclosure");
    this.url = attributes.get("url") || "";
    this.length = attributes.get("length") || "";
    this.type = attributes.get("type") || "";
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltguidgtSubelementOfLtitemgt
 */
class Guid extends StringObject {
  constructor(attributes) {
    super(RSS_NS_ID, "guid");
    this.isPermaLink = attributes.get("isPermaLink") || "";
  }
}

/**
 * https://www.rssboard.org/rss-specification#ltsourcegtSubelementOfLtitemgt
 */
class Source extends StringObject {
  constructor(attributes) {
    super(RSS_NS_ID, "source");
    this.url = attributes.get("url") || "";
  }
}

class RssNamespace {
  static $buildXMLObject(name, attributes) {
    attributes = attributes.get("");
    if (RssNamespace.hasOwnProperty(name)) {
      return RssNamespace[name](attributes);
    }

    if (
      [
        "title",
        "link",
        "description",
        "name",
        "language",
        "copyright",
        "managingEditor",
        "webMaster",
        "generator",
        "docs",
        "author",
        "comments",
      ].includes(name)
    ) {
      return new StringObject(RSS_NS_ID, name);
    }

    return undefined;
  }

  static rss(attributes) {
    return new Rss(attributes);
  }

  static channel(attributes) {
    return new Channel(attributes);
  }

  static pubDate(attributes) {
    return new PubDate(attributes);
  }

  static lastBuildDate(attributes) {
    return new LastBuildDate(attributes);
  }

  static category(attributes) {
    return new Category(attributes);
  }

  static cloud(attributes) {
    return new Cloud(attributes);
  }

  static ttl(attributes) {
    return new Ttl(attributes);
  }

  static image(attributes) {
    return new Image(attributes);
  }

  static width(attributes) {
    return new Width(attributes);
  }

  static height(attributes) {
    return new Height(attributes);
  }

  static textInput(attributes) {
    return new TextInput(attributes);
  }

  static item(attributes) {
    return new Item(attributes);
  }

  static enclosure(attributes) {
    return new Enclosure(attributes);
  }

  static guid(attributes) {
    return new Guid(attributes);
  }

  static source(attributes) {
    return new Source(attributes);
  }
}

export { RssNamespace };
