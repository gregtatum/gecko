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
import { validateString } from "./utils";

const ATOM_NS_ID = NamespaceIds.get("atom").id;
const XHTML_NS_ID = NamespaceIds.get("xhtml").id;

/**
 * The specification of Atom xml format can be found here:
 *   https://datatracker.ietf.org/doc/html/rfc4287
 * and a RELAX NG schema here:
 *   https://datatracker.ietf.org/doc/html/rfc4287#appendix-B
 *
 * Node in the XML tree is represented by an object which validates its
 * properties and children. By default a node only accept a child from
 * the same namespace (Atom ones) but in overriding $onChild method
 * it's possible to accept whatever we want.
 */

/**
 * Helper class to handle element with default attributes of an Atom.
 */
class Atom extends XMLObject {
  constructor(name, attributes) {
    super(ATOM_NS_ID, name);
    this.base = attributes.get("base") || "";
    this.lang = validateString({
      data: attributes.get("lang"),
      defaultValue: "",
      validate: s => s.match(/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/),
    });
  }

  $onChildCheck(child) {
    return !child.$isInvalid && super.$onChildCheck(child);
  }
}

/**
 * Helper class to handle element which just contain a string
 * and may have default attributes of an Atom.
 */
class StringAtom extends Atom {
  constructor(name, attributes) {
    super(name, attributes);
    this.$content = "";
  }

  $onChild(child) {}

  $onText(text) {
    this.$content += text;
  }
}

/**
 * Helper class to handle element containing some plain text.
 */
class PlainTextConstruct extends StringAtom {
  constructor(name, attributes) {
    super(name, attributes);
    this.$content = "";

    this.type = validateString({
      data: attributes.get("type"),
      defaultValue: "",
      validate: s => s === "text" || s === "html",
    });
  }
}

/**
 * Helper class to handle element containing some xhtml.
 */
class XHTMLTextConstruct extends Atom {
  constructor(name, attributes) {
    super(name, attributes);
    this.type = validateString({
      data: attributes.get("type"),
      defaultValue: "xhtml",
      validate: s => false,
    });
    this.div = null;
  }

  $onChild(child) {
    if (child.$namespaceId === XHTML_NS_ID && child.$nodeName === "div") {
      this.div = child;
    }
  }
}

/**
 * Helper class to handle a person construct.
 */
class PersonConstruct extends Atom {
  constructor(name, attributes) {
    super(name, attributes);
    this.name = null;
    this.uri = null;
    this.email = null;
  }

  $finalize() {
    for (const propr of ["name", "uri", "email"]) {
      if (this[propr]) {
        this[propr] = this[propr].$content;
      }
    }
  }
}

/**
 * Element part of person construct.
 */
class Name extends StringObject {
  constructor() {
    super(ATOM_NS_ID, "name");
  }
}

/**
 * Element part of person construct.
 */
class Uri extends StringObject {
  constructor() {
    super(ATOM_NS_ID, "uri");
  }
}

/**
 * Element part of person construct.
 */
class Email extends StringObject {
  constructor() {
    super(ATOM_NS_ID, "email");
  }

  $finalize() {
    if (!this.$content.match(/^.+@.+$/)) {
      this.$content = "";
    }
  }
}

/**
 * Helper class to handle a date construct.
 */
class DateConstruct extends StringAtom {
  $finalize() {
    try {
      this.$content = new Date(this.$content);
    } catch {
      this.$isInvalid = true;
    }
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.1.1
 */
class Feed extends Atom {
  constructor(attributes) {
    super("feed", attributes);
    this.author = new XMLObjectArray();
    this.category = new XMLObjectArray();
    this.contributor = new XMLObjectArray();
    this.generator = null;
    this.icon = null;
    this.id = null;
    this.link = new XMLObjectArray();
    this.logo = null;
    this.rights = null;
    this.subtitle = null;
    this.title = null;
    this.updated = null;
    this.entry = new XMLObjectArray();
  }

  $finalize() {
    // Required properties.
    for (const propr of ["id", "title", "updated"]) {
      if (this[propr] === null) {
        console.warn(`Atom - Required field ${propr} is not present.`);
      }
    }

    if (
      this.author.isEmpty() &&
      this.entry.children.some(e => e.author.isEmpty())
    ) {
      console.warn(
        "An atom:feed must have an atom:author unless all of its atom:entry children have an atom:author."
      );
    }
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.1.2
 */
class Entry extends Atom {
  constructor(attributes) {
    super("entry", attributes);
    this.author = new XMLObjectArray();
    this.category = new XMLObjectArray();
    this.content = null;
    this.contributor = new XMLObjectArray();
    this.id = null;
    this.link = new XMLObjectArray();
    this.published = null;
    this.rights = null;
    this.source = null;
    this.summary = null;
    this.title = null;
    this.updated = null;
  }

  $finalize() {
    // Required properties.
    for (const propr of ["id", "title", "updated"]) {
      if (this[propr] === null) {
        console.warn(`Atom - Required field ${propr} is not present.`);
      }
    }

    if (
      !this.link.children.some(e => e.rel === "alternate") &&
      this.content === null
    ) {
      console.warn(
        "An atom:entry must have at least one atom:link element with a rel attribute of 'alternate' or an atom:content."
      );
    }
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.1.3
 *
 * The next four classes represent the variation of the
 * same node (content). The variation is selected in
 * AtomNamespace::content.
 */
class InlineTextContent extends PlainTextConstruct {
  constructor(attributes) {
    super("content", attributes);
  }
}

class InlineXHTMLContent extends XHTMLTextConstruct {
  constructor(attributes) {
    super("content", attributes);
  }
}

class InlineOtherContent extends Atom {
  constructor(attributes) {
    super("content", attributes);
    this.$content = "";

    this.type = validateString({
      data: attributes.get("type"),
      defaultValue: "",
      validate: s => s.match(/^.+\/.+$/),
    });
  }

  $onText(text) {
    if (typeof this.$content === "string") {
      this.$content += text;
    } else {
      this.$content = text;
    }
  }

  $onChild(child) {
    this.$content = child;
  }
}

class OutOfLineContent extends Atom {
  constructor(attributes) {
    super("content", attributes);
    this.type = validateString({
      data: attributes.get("type"),
      defaultValue: "",
      validate: s => s.match(/^.+\/.+$/),
    });
    this.src = attributes.get("src") || "";
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.1
 */
class Author extends PersonConstruct {
  constructor(attributes) {
    super("author", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.2
 */
class Category extends Atom {
  constructor(attributes) {
    super("category", attributes);
    this.term = attributes.get("term") || "";
    this.scheme = attributes.get("scheme") || "";
    this.label = attributes.get("label") || "";
  }

  $onChild(child) {}
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.3
 */
class Contributor extends PersonConstruct {
  constructor(attributes) {
    super("contributor", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.4
 */
class Generator extends StringAtom {
  constructor(attributes) {
    super("generator", attributes);
    this.uri = attributes.get("uri") || "";
    this.version = attributes.get("version") || "";
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.5
 */
class Icon extends StringAtom {
  constructor(attributes) {
    super("icon", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.6
 */
class Id extends StringAtom {
  constructor(attributes) {
    super("id", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.7
 */
class Link extends Atom {
  constructor(attributes) {
    super("link", attributes);
    this.href = attributes.get("href") || "";
    this.rel = attributes.get("rel") || "";
    this.type = attributes.get("type") || "";
    this.title = attributes.get("title") || "";
    this.length = attributes.get("length") || "";
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.8
 */
class Logo extends StringAtom {
  constructor(attributes) {
    super("logo", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.9
 */
class Published extends DateConstruct {
  constructor(attributes) {
    super("published", attributes);
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.11
 */
class Source extends Atom {
  constructor(attributes) {
    super("source", attributes);
    this.author = new XMLObjectArray();
    this.category = new XMLObjectArray();
    this.contributor = new XMLObjectArray();
    this.generator = null;
    this.icon = null;
    this.link = new XMLObjectArray();
    this.logo = null;
    this.rights = null;
    this.subtitle = null;
    this.updated = null;
  }
}

/**
 * https://datatracker.ietf.org/doc/html/rfc4287#section-4.2.15
 */
class Updated extends DateConstruct {
  constructor(attributes) {
    super("updated", attributes);
  }
}

class AtomNamespace {
  static $buildXMLObject(name, attributes) {
    // For now, only local namespace is supported for attributes.
    attributes = attributes.get("");
    if (AtomNamespace.hasOwnProperty(name)) {
      return AtomNamespace[name](attributes);
    }
    if (["rights", "subtitle", "summary", "title"].includes(name)) {
      if (attributes.get("type") === "xhtml") {
        return new XHTMLTextConstruct(name, attributes);
      }
      return new PlainTextConstruct(name, attributes);
    }

    return undefined;
  }

  static name(attributes) {
    return new Name(attributes);
  }

  static uri(attributes) {
    return new Uri(attributes);
  }

  static email(attributes) {
    return new Email(attributes);
  }

  static feed(attributes) {
    return new Feed(attributes);
  }

  static entry(attributes) {
    return new Entry(attributes);
  }

  static content(attributes) {
    switch (attributes.get("type")) {
      case "text":
      case "html":
        return new InlineTextContent(attributes);
      case "xhtml":
        return new InlineXHTMLContent(attributes);
    }

    if (attributes.has("src")) {
      return new OutOfLineContent(attributes);
    }
    return new InlineOtherContent(attributes);
  }

  static author(attributes) {
    return new Author(attributes);
  }

  static category(attributes) {
    return new Category(attributes);
  }

  static contributor(attributes) {
    return new Contributor(attributes);
  }

  static generator(attributes) {
    return new Generator(attributes);
  }

  static icon(attributes) {
    return new Icon(attributes);
  }

  static id(attributes) {
    return new Id(attributes);
  }

  static logo(attributes) {
    return new Logo(attributes);
  }

  static link(attributes) {
    return new Link(attributes);
  }

  static published(attributes) {
    return new Published(attributes);
  }

  static source(attributes) {
    return new Source(attributes);
  }

  static updated(attributes) {
    return new Updated(attributes);
  }
}

export { AtomNamespace };
