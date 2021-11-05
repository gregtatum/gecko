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

import logic from "logic";

import { NOW } from "shared/date";
import { makeGlobalNamespacedConvId } from "shared/id_conversions";

/**
 * See `README.md`.
 */
export default class FeedSyncStateHelper {
  constructor(ctx, rawSyncState, accountId, why) {
    logic.defineScope(this, "FeedSyncState", { ctxId: ctx.id, why });

    if (!rawSyncState) {
      logic(ctx, "creatingDefaultSyncState", {});
      rawSyncState = {
        lastChangeDatestamp: NOW(),
        requestCacheState: null,
      };
    }

    this._accountId = accountId;
    this.rawSyncState = rawSyncState;

    this.tasksToSchedule = [];
  }

  _makeItemConvTask({ convId, item }) {
    const task = {
      type: "sync_item",
      accountId: this._accountId,
      convId,
      item,
    };
    this.tasksToSchedule.push(task);
    return task;
  }

  _makeDefaultData() {
    return {
      author: "No author",
      title: "No title",
      description: "",
      contentType: "plain",
    };
  }

  /**
   * This function ingests an item coming from a RSS feed:
   *   https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt
   */
  ingestHEntry(entry) {
    const data = this._makeDefaultData();
    data.guid = entry.uid?.[0] || entry.name?.[0] || entry.summary?.[0];

    data.date = (entry.published?.[0] || NOW()).valueOf();
    data.dateModified = (entry.updated?.[0] || NOW()).valueOf();
    data.author = entry.author?.[0] || data.author;
    data.title = entry.name?.[0] || entry.summary?.[0] || data.title;

    const content = entry.content?.[0] || {};
    if (content.html) {
      data.description = content.html;
      data.contentType = "html";
    } else {
      data.description = content.value || "";
      data.contentType = "plain";
    }

    const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
    this._makeItemConvTask({
      convId,
      item: data,
    });
  }

  /**
   * This function ingests an item coming from a RSS feed:
   *   https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt
   */
  ingestItem(item) {
    const data = this._makeDefaultData();
    if (item.guid) {
      data.guid =
        typeof item.guid === "string" ? item.guid : item.guid["#content"];
    } else {
      // No guid so create one from title or description (according to RSS
      // specifications, at least one of them is required).
      data.guid = item.title || item.description;
    }
    data.date = data.dateModified = (item.pubDate || NOW()).valueOf();
    data.author = item.author || data.author;
    data.title = item.title || data.title;
    data.description = item.description || data.description;
    data.contentType = "html";

    const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
    this._makeItemConvTask({
      convId,
      item: data,
    });
  }

  /**
   * This function ingests an item coming from a Json feed:
   *   https://www.jsonfeed.org/version/1.1/#items-a-name-items-a
   */
  ingestJsonItem(item) {
    const data = this._makeDefaultData();
    data.guid = item.id;
    data.date = (item.date_published || NOW()).valueOf();
    data.dateModified = (item.date_modified || NOW()).valueOf();
    data.author = item.authors?.[0]?.name || data.author;
    data.title = item.title || data.title;
    if (item.content_html) {
      data.description = item.content_html;
      data.contentType = "html";
    } else {
      data.description = item.content_text;
      data.contentType = "plain";
    }

    const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
    this._makeItemConvTask({
      convId,
      item: data,
    });
  }

  /**
   * This function ingests an entry coming from an Atom feed:
   *   https://datatracker.ietf.org/doc/html/rfc4287#section-4.1.2
   */
  ingestEntry(entry) {
    // When a node which contains a single value (string, number, ...) has some
    // attributes then the dumped node has the following structure:
    //   {attr1: ... , attr2: ..., #content: ...}
    const getContent = value => value?.["#content"] || value;
    const data = this._makeDefaultData();
    for (const fieldName of [
      "title",
      "summary",
      "id",
      "published",
      "updated",
    ]) {
      entry[fieldName] = getContent(entry[fieldName]);
    }

    // Normally we should always have an id.
    data.guid =
      entry.id ||
      entry.title ||
      entry.summary ||
      NOW()
        .valueOf()
        .toString();
    data.date = (entry.published || entry.updated || NOW()).valueOf();
    data.dateModified = entry.updated?.valueOf() || data.date;
    const author = entry.author?.[0];
    if (author?.name && author?.email) {
      data.author = `${getContent(author.name)} (${getContent(author.email)})`;
    } else {
      data.author =
        getContent(author?.name) || getContent(author?.email) || data.author;
    }
    data.title = entry.title || data.title;
    if (entry.content) {
      if (entry.content.type === "text") {
        data.description = getContent(entry.content);
        data.contentType = "plain";
      } else {
        data.description = entry.content.div;
        data.contentType = "html";
      }
    }

    const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
    this._makeItemConvTask({
      convId,
      item: data,
    });
  }
}
