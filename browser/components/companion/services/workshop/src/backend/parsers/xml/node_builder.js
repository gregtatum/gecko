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
import { XMLObject } from "./xml_object";

/**
 * We use it for not handled namespaces.
 */
class Empty extends XMLObject {
  constructor() {
    super(-1, "");
  }

  $onChild() {}
}

/**
 * namespace where it lives and the JS representation of the node.
 * The node is validated when the representation is fed with the data.
 */
class NodeBuilder {
  #namespaceStack;
  #namespaceSetup;
  #rootNode;
  #currentNamespace;
  #namespacePrefixes;
  #namespaces;

  constructor(namespaceSetup, rootNode, localNamespace = null) {
    this.#namespaceStack = [];
    this.#namespaceSetup = namespaceSetup;
    this.#rootNode = rootNode;
    this.#currentNamespace = localNamespace;

    // Each prefix has its own stack
    this.#namespacePrefixes = new Map();
    this.#namespaces = new Map();
  }

  buildRoot() {
    return this.#rootNode;
  }

  /**
   * Build a JS object according to the node name and the current namespace.
   */
  build({ nsPrefix, name, attributes }) {
    const namespace = attributes.get("").get("xmlns");
    const prefixes = attributes.get("xmlns");
    if (namespace) {
      // Define the current namespace to use.
      this.#namespaceStack.push(this.#currentNamespace);
      this.#currentNamespace = this.#searchNamespace(namespace);
    }

    if (prefixes) {
      // The xml node may have namespace prefix definitions
      this.#addNamespacePrefix(prefixes);
    }

    const namespaceToUse = this.#getNamespaceToUse(nsPrefix);
    const node =
      namespaceToUse?.$buildXMLObject(name, attributes) || new Empty();

    // In case the node has some namespace things,
    // we must pop the different stacks.
    if (namespace || prefixes) {
      node.$cleanup = {
        hasNamespace: !!namespace,
        prefixes,
      };
    }

    return node;
  }

  #searchNamespace(nsName) {
    let ns = this.#namespaces.get(nsName);
    if (ns) {
      return ns;
    }
    for (const [name, { check }] of NamespaceIds) {
      if (!check(nsName)) {
        continue;
      }

      ns = this.#namespaceSetup[name];
      if (ns) {
        this.#namespaces.set(nsName, ns);
        return ns;
      }
      // The namespace is known but not handled.
      break;
    }
    return null;
  }

  #addNamespacePrefix(prefixes) {
    for (const [prefix, value] of prefixes) {
      const namespace = this.#searchNamespace(value);
      let prefixStack = this.#namespacePrefixes.get(prefix);
      if (!prefixStack) {
        prefixStack = [];
        this.#namespacePrefixes.set(prefix, prefixStack);
      }
      prefixStack.push(namespace);
    }
  }

  #getNamespaceToUse(prefix) {
    if (!prefix) {
      return this.#currentNamespace;
    }
    const prefixStack = this.#namespacePrefixes.get(prefix);
    if (prefixStack?.length) {
      return prefixStack[prefixStack.length - 1];
    }

    return null;
  }

  /**
   * This method is called when the node is closed: the goal
   * to pop any pushed namespace definitions when the node was entered.
   */
  clean(data) {
    const { hasNamespace, prefixes } = data;
    if (hasNamespace) {
      this.#currentNamespace = this.#namespaceStack.pop();
    }
    if (prefixes) {
      for (const prefix of prefixes.keys()) {
        this.#namespacePrefixes.get(prefix).pop();
      }
    }
  }
}

export { NodeBuilder };
