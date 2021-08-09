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

/**
 * Fetch helper to provide cache headers and allow the server to return a 304
 * if the data is the same as what we retrieved last time.
 * The 2nd argument is the previous state returned (in the requestCacheState property)
 * by a previous call to this function, it can be null or undefined on the first call.
 * These checks will operate regardless of the state of the HTTP cache.
 **/
export async function fetchCacheAware(request, state) {
  if (typeof request === "string") {
    request = new Request(request);
  }

  // From MDN: the response may not be stored in any cache.
  request.cache = "no-store";

  if (!state) {
    state = Object.create(null);
  }

  const result = {
    response: null,
    requestCacheState: state,
  };

  const { etag, lastModified } = state;

  const headers = request.headers;

  if (etag) {
    headers.set("If-None-Match", etag);
  }

  if (lastModified) {
    headers.set("If-Modified-Since", lastModified);
  }

  const response = await fetch(request);
  if (response.status === 304) {
    // Not modified: nothing to do.
    return result;
  }

  const newEtag = response.headers.get("ETag");
  if (newEtag) {
    state.etag = newEtag;
  }

  const newLastModified = response.headers.get("Last-Modified");
  if (newLastModified) {
    state.lastModified = newLastModified;
  }

  result.response = response;
  return result;
}
