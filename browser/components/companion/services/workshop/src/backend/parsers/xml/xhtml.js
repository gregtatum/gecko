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

import { XmlNodeObject } from "./xml_object";
import { NamespaceIds } from "./namespaces";

const XHTML_NS_ID = NamespaceIds.get("xhtml").id;

// TODO: Validate or not the xhtml: it isn't hard but just long to do.

class XhtmlNamespace {
  static $buildXFAObject(name, attributes) {
    return new XmlNodeObject(XHTML_NS_ID, name, attributes);
  }
}

export { XhtmlNamespace };
