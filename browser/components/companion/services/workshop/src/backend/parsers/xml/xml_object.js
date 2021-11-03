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

import { encodeToXmlString } from "./utils";

// Generally we use some name starting with a dollar for fields
// or methods which aren't part of a xml tag.

class XMLObject {
  constructor(nsId, name) {
    this.$namespaceId = nsId;
    this.$nodeName = name;
  }

  /**
   * Called by the parser when a new child is ready.
   */
  $onChild(child) {
    if (!this.$onChildCheck(child)) {
      return;
    }

    const name = child.$nodeName;
    const node = this[name];

    if (node instanceof XMLObjectArray) {
      node.push(child);
    } else {
      this[name] = child;
    }
  }

  /**
   * Check if the child must be added to this node.
   */
  $onChildCheck(child) {
    return (
      this.hasOwnProperty(child.$nodeName) &&
      child.$namespaceId === this.$namespaceId
    );
  }

  /**
   * Called to add some text to this node.
   */
  $onText(_) {}

  /**
   * Called just before to be passed to its parent.
   * It's the right place to check that the node properties are correct.
   */
  $finalize() {}

  /**
   * Mainly for internal use, e.g. pop namespaces.
   */
  $clean(builder) {
    if (this.$cleanup) {
      builder.clean(this.$cleanup);
      delete this.$cleanup;
    }
  }

  /**
   * Strip out all OO stuff to get a very basic object.
   */
  $dump() {
    const dumped = Object.create(null);
    let empty = true;
    for (const name of Object.getOwnPropertyNames(this)) {
      if (name.startsWith("$")) {
        continue;
      }

      const value = this[name];
      const dumpedValue = value?.$dump?.() || value;
      if (
        dumpedValue === null ||
        dumpedValue === undefined ||
        dumpedValue === "" ||
        (Array.isArray(dumpedValue) && dumpedValue.length === 0)
      ) {
        continue;
      }

      empty = false;
      dumped[name] = dumpedValue;
    }

    if (!this.$content) {
      return empty ? null : dumped;
    }

    const content = this.$content?.$dump?.() || this.$content;
    if (empty) {
      return content;
    }

    dumped["#content"] = content;
    return dumped;
  }
}

/**
 * Basic structure to store a limited number of nodes.
 */
class XMLObjectArray {
  #max;

  constructor(max = Infinity) {
    this.#max = max;
    this.children = [];
  }

  push(child) {
    if (this.children.length <= this.#max) {
      this.children.push(child);
    }
  }

  isEmpty() {
    return this.children.length === 0;
  }

  $dump() {
    return this.children.map(v => v.$dump());
  }
}

/**
 * Basic object to support <foo>blah blah</foo>.
 */
class StringObject extends XMLObject {
  constructor(nsId, name) {
    super(nsId, name);
    this.$content = "";
  }

  $onChild(child) {}

  $onText(text) {
    this.$content += text;
  }
}

class XmlNodeObject extends XMLObject {
  constructor(nsId, name, attributes = null) {
    super(nsId, name);
    this.$content = "";
    if (name !== "#text") {
      this.$attributes = attributes;
    }
    this.$children = [];
  }

  $serialize(buf) {
    const tagName = this.$nodeName;
    if (tagName === "#text") {
      buf.push(encodeToXmlString(this.$content));
      return;
    }
    buf.push(`<${tagName}`);
    if (this.$attributes) {
      for (const [ns, map] of this.$attributes) {
        const prefix = !ns ? "" : `${ns}:`;
        for (const [name, value] of map) {
          buf.push(` ${prefix}${name}="${encodeToXmlString(value)}"`);
        }
      }
    }
    if (!this.$content && this.$children.length === 0) {
      buf.push("/>");
      return;
    }

    buf.push(">");
    if (this.$content) {
      if (typeof this.$content === "string") {
        buf.push(encodeToXmlString(this.$content));
      } else {
        this.$content.$serialize(buf);
      }
    } else {
      for (const child of this.$children) {
        child.$serialize?.(buf);
      }
    }
    buf.push(`</${tagName}>`);
  }

  $onChild(child) {
    if (this.$content) {
      const node = new XmlNodeObject(this.$namespaceId, "#text");
      this.$children.push(node);
      node.$content = this.$content;
      this.$content = "";
    }
    this.$children.push(child);
  }

  $onText(str) {
    this.$content += str;
  }

  $finalize() {
    if (this.$content && this.$children.length) {
      const node = new XmlNodeObject(this.$namespaceId, "#text");
      this.$children.push(node);
      node.$content = this.$content;
      delete this.$content;
    }
  }

  $dump() {
    const buffer = [];
    this.$serialize(buffer);
    return buffer.join("");
  }
}

export { StringObject, XmlNodeObject, XMLObject, XMLObjectArray };
