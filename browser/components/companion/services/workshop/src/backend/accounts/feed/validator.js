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

import { isHFeed, parseHFeed } from "../../parsers/html/feed_parser";
import { isJsonFeed, parseJsonFeed } from "../../parsers/json/feed_parser";
import { parseFeed } from "../../parsers/xml/feed_parser";

/**
 * Validate an atom URL by verifying it parses fine and then
 * extracting metadata to help name the calendar.
 */
export default async function validateFeed({
  userDetails,
  credentials,
  connInfoFields,
}) {
  const { feedUrl } = connInfoFields;

  try {
    const feedReq = new Request(feedUrl, {});
    const feedResp = await fetch(feedReq);
    if (feedResp.status >= 400) {
      return {
        error: "unknown",
        errorDetails: {
          status: feedResp.status,
          feedUrl,
        },
      };
    }

    const feedText = await feedResp.text();
    const headers = await feedResp.headers;
    let parsed;
    if (isJsonFeed(headers)) {
      parsed = parseJsonFeed(feedText);
      connInfoFields.feedType = "json";
    } else if (isHFeed(headers)) {
      parsed = await parseHFeed(feedText, feedUrl);
      connInfoFields.feedType = "html";
    } else {
      parsed = parseFeed(feedText);
      connInfoFields.feedType = "xml";
    }
    if (!parsed) {
      throw new Error("Cannot parse the feed stream");
    }
  } catch (ex) {
    return {
      error: "unknown",
      errorDetails: {
        message: ex.toString(),
      },
    };
  }

  return {
    engineFields: {
      engine: "feed",
      engineData: {},
      receiveProtoConn: null,
    },
  };
}
