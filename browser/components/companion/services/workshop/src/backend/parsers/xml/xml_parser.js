/* Copyright 2018 Mozilla Foundation
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

import { XMLParserBase, XMLParserErrorCode } from "xml/basic_xml_parser";

/**
 * Parse XML data: each node is mapped onto a JS object build thanks to
 * a node builder (see ./node_builder.js).
 * The node builder takes into account the current namespace to select
 * a builder for this node.
 * The node validation is made in the builder (see for example ./atom.js).
 */
class XMLParser extends XMLParserBase {
  #builder;
  #stack;
  #current;
  #errorCode;

  constructor(builder) {
    super();
    this.#builder = builder;
    this.#stack = [];
    this.#current = this.#builder.buildRoot();
    this.#errorCode = XMLParserErrorCode.NoError;
  }

  parse(data) {
    this.parseXml(data);

    if (this.#errorCode !== XMLParserErrorCode.NoError) {
      return null;
    }

    this.#current.$finalize();

    return this.#current.$dump();
  }

  onText(text) {
    this.#current.$onText(text.trim());
  }

  onCdata(text) {
    this.onText(text);
  }

  #getNameAndPrefix(name) {
    const i = name.indexOf(":");
    return [name.substring(i + 1), name.substring(0, i)];
  }

  #mkAttributes(attributes) {
    // Transform attributes into an object and get out
    // namespaces information.
    const attributesMap = new Map();

    // Set the local namespace.
    attributesMap.set("", new Map());

    for (const { name, value } of attributes) {
      const [attribute, prefix] = this.#getNameAndPrefix(name);
      let attrs = attributesMap.get(prefix);
      if (!attrs) {
        attrs = new Map();
        attributesMap.set(prefix, attrs);
      }
      attrs.set(attribute, value);
    }

    return attributesMap;
  }

  onBeginElement(tagName, attributes, isEmpty) {
    const attributesMap = this.#mkAttributes(attributes);
    const [name, nsPrefix] = this.#getNameAndPrefix(tagName);
    const node = this.#builder.build({
      nsPrefix,
      name,
      attributes: attributesMap,
    });

    if (isEmpty) {
      // No children: just push the node into its parent.
      node.$finalize();
      this.#current.$onChild(node);
      node.$clean(this.#builder);
      return;
    }

    this.#stack.push(this.#current);
    this.#current = node;
  }

  onEndElement(name) {
    const node = this.#current;
    node.$finalize();
    this.#current = this.#stack.pop();
    this.#current.$onChild(node);
    node.$clean(this.#builder);
  }

  onError(code) {
    this.#errorCode = code;
  }
}

export { XMLParser };
