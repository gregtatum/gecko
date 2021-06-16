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

import WindowedListView from './windowed_list_view';
import RawItem from './raw_item';

/**
 * Windowed list view that contains `RawItem` instances that expose their wire
 * rep verbatim as their `data` field.  Used in cases where we don't (yet) need
 * helper APIs, abstraction firewalls, or any of that stuff.  Great for first
 * steps, experimental hacks, and the like.
 *
 * This is based on a WindowedListView and has no EntireListView variant right
 * now (although we could) because the EntireListView use-cases are well defined
 * and allow us to make desirable simplifying assumptions.  By definition we
 * have no idea about what goes in here.  In most cases, if you want an
 * EntireListView experience, the caller can just issue a very wide seek window.
 */
export default function RawListView(api, handle) {
  WindowedListView.call(this, api, RawItem, handle);
}
RawListView.prototype = Object.create(WindowedListView.prototype);
