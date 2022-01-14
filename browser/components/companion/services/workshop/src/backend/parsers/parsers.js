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

import { parseGmailFeed, parseFeed } from "./xml/feed_parser.js";
import { parseJsonFeed } from "./json/feed_parser.js";
import { parseHFeed } from "./html/feed_parser.js";

export async function TEST_parseFeed(parserType, code, url) {
  switch (parserType) {
    case "rss":
      return parseFeed(code);
    case "hfeed":
      return parseHFeed(code, url);
    case "jsonfeed":
      return parseJsonFeed(code, url);
    case "gmailfeed":
      return parseGmailFeed(code);
  }
  return null;
}
