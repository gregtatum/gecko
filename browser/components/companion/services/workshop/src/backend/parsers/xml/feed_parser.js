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

import { AtomNamespace } from "./atom";
import { NamespaceIds } from "./namespaces";
import { NodeBuilder } from "./node_builder";
import { RssNamespace } from "./rss";
import { XhtmlNamespace } from "./xhtml";
import { XMLObject } from "./xml_object";
import { XMLParser } from "./xml_parser";

/**
 * Root of the document.
 */
class Root extends XMLObject {
  constructor() {
    super(-1, "root");
  }

  $onChild(child) {
    const name = child.$nodeName;
    switch (name) {
      case "feed":
      case "entry":
        if (child.$namespaceId === NamespaceIds.get("atom").id && !this[name]) {
          this[name] = child;
        }
        break;
      case "rss":
        if (child.$namespaceId === NamespaceIds.get("local").id) {
          this.rss = child;
        }
        break;
    }
  }
}

/**
 * Parse a XML-based feed.
 * The root node (see above) accepts either a node in
 * the Atom namespace or one in the local namespace called rss.
 *
 * The idea is that Rss or Atom are the detail of implementation of
 * the same thing: feeds.
 */
function parseFeed(str) {
  const nsSetUp = {
    atom: AtomNamespace,
    xhtml: XhtmlNamespace,
  };
  const nodeBuilder = new NodeBuilder(
    nsSetUp,
    new Root(),
    /* localNamespace = */ RssNamespace
  );
  const parser = new XMLParser(nodeBuilder);
  return parser.parse(str);
}

export { parseFeed };
