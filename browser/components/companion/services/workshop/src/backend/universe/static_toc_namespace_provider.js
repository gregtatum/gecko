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

import StaticTOC from '../db/static_toc';

export default function makeStaticTOCNamespaceProvider(staticMap) {
  const tocCache = new Map();
  return function(args) {
    const { name } = args;
    const entry = staticMap[name];
    if (!entry) {
      throw new Error('bad namespace key name: ' + name);
    }
    if (typeof(entry) === 'function') {
      return entry(args);
    }
    if (!Array.isArray(entry)) {
      throw new Error('namespace entry data not an array');
    }

    let toc = tocCache.get(name);
    if (!toc) {
      toc = new StaticTOC({
        items: entry,
        onForgotten: () => {
          tocCache.delete(name);
        }
      });
      tocCache.set(name, toc);
    }
    return args.ctx.acquire(toc);
  };
}
