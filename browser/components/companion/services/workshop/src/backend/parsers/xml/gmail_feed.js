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

const GMAIL_NS_ID = NamespaceIds.get("gmail").id;

/**
 * The only document I found about this feed is:
 *   https://developers.google.com/gmail/gmail_inbox_feed
 *
 * Anyway, we just need to get the fullcount (number of unread emails) so it
 * doesn't hurt that much to not have a full description of the xml.
 */

/**
 * Helper class to handle element with default attributes of an Atom.
 */
class Atom extends XMLObject {
  constructor(name, attributes) {
    super(GMAIL_NS_ID, name);
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
 * Helper class to handle element which just contain an integer.
 */
class IntegerAtom extends StringAtom {
  $finalize() {
    this.$content = parseInt(this.$content);
    this.$isInvalid = isNaN(this.$content);
  }
}

class Fullcount extends IntegerAtom {
  constructor(attributes) {
    super("fullcount", attributes);
  }
}

class Feed extends Atom {
  constructor(attributes) {
    super("feed", attributes);

    // For now only this child is interesting so skip all the others.
    this.fullcount = null;
  }
}

class GmailNamespace {
  static $buildXMLObject(name, attributes) {
    // For now, only local namespace is supported for attributes.
    attributes = attributes.get("");
    if (
      GmailNamespace.hasOwnProperty(name) &&
      typeof GmailNamespace[name] === "function"
    ) {
      return GmailNamespace[name](attributes);
    }

    return undefined;
  }

  static feed(attributes) {
    return new Feed(attributes);
  }

  static fullcount(attributes) {
    return new Fullcount(attributes);
  }
}

export { GmailNamespace };
