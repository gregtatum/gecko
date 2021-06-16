/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import makeNamespaceProvider from './static_toc_namespace_provider';

/**
 * Simple registry of TOC namespaces that extensions can provide.  Exists to
 * avoid the ExtensionManager getting huge on its own and to allow us to think
 * about normalizing the other first-class TOC implementations.  They were
 * intentionally created without a lot of generic hoopla to hopefully make it
 * easier to understand what's going on as a response to the gloda abstractions,
 * but maybe generic is the way to go.  For experimental account types we'll
 * be hewing more generic and we'll see how that goes.
 */
export default function TOCManager() {
  this._namespaceProviders = new Map();
}
TOCManager.prototype = {
  /**
   * Register a namespace provider.  This can either be a function like
   * `function acquireTOC({ ctx, name })` or a normal object whose keys
   * are names and values are static arrays or a function of the form
   * `function acquireWhatever({ ctx })`.
   */
  registerNamespaceProvider: function(namespace, provider) {
    switch (typeof(provider)) {
      case 'object':
        provider = makeNamespaceProvider(provider);
        break;

      case 'function':
        // hooray!
        break;

      default:
        throw new Error('Bad provider!');
    }

    this._namespaceProviders.set(namespace, provider);
  },

  acquireExtensionTOC: function(ctx, namespace, name) {
    const provider = this._namespaceProviders.get(namespace);
    if (!provider) {
      throw new Error('No such namespace:' + namespace);
    }

    return provider({ ctx, name });
  },
};
