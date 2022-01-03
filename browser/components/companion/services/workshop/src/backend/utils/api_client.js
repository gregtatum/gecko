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

import { ensureUpdatedCredentials } from "../oauth";

const FETCH_TIMEOUT = 32000;

/**
 * Implement a truncated exponential backoff strategy:
 * https://en.wikipedia.org/wiki/Exponential_backoff#Binary_exponential_backoff_/_truncated_exponential_backoff
 *
 * In case of network errors or api errors the waitAMoment method will block for
 * few seconds depending of the number of retries.
 */
export class Backoff {
  constructor() {
    this.max_backoff_ms = 32000;
    this.max_retries = 6;
  }

  /**
   * Some api errors can lead to retries.
   * @param {number} status - response status.
   * @param {Object} result - returned by the REST api.
   * @returns {boolean}
   */
  isCandidateForBackoff(status, result) {
    return true;
  }

  /**
   * Get the error message from an object returned by the api.
   * @param {Object} result - returned by the REST api.
   * @returns {string}
   */
  getErrorMessage(result) {
    return result.error.message;
  }

  /**
   * Wait few seconds depending of the number of retries already done.
   * @param {number} step - the number of retries.
   * @returns {Promise<undefined>}
   */
  waitAMoment(step) {
    const time_ms = Math.min(
      this.max_backoff_ms,
      Math.ceil((2 ** step + Math.random()) * 1000)
    );
    return new Promise(resolve => setTimeout(resolve, time_ms));
  }
}

/**
 * API layer for talking to calendars through a rest service, handling oauth
 * tokens and (optionally) paged results.
 *
 * ### Paged Result Note
 *
 * The intent for paged result handling right now is to avoid a situation where
 * we don't handle it and suddenly we have gaps in our data.  By definition,
 * unless the server is forcing pagination to make sure people handle
 * pagination, then pagination should correlate with cases where there's a lot
 * of data to handle.  Our naively gathering up all the data has the potential
 * to create overload situations where things fall over due to excessive
 * resource use (OOM, in theory IDB IPC sizes if we actually had a batch put
 * API).  Longer term, it likely would make sense to have any tasks that might
 * involve pagination on potentially massive result sets be pagination aware
 * and reschedule itself to process the next page.  For example, mail sync at a
 * folder level could see a massive inflow of new messages that could benefit
 * from chunking, but it still could be fine for conversation sync to consume
 * all of the messages in a thread because the worst-case there is likely to be
 * less bad (and I believe the server may arbitrarily break up conversations for
 * its own benefit exactly for this reason).
 */
export class ApiClient {
  constructor(credentials, accountId) {
    logic.defineScope(this, "ApiClient", { accountId });
    this.credentials = credentials;
    this._dirtyCredentials = false;
  }

  credentialsUpdated() {
    this._dirtyCredentials = true;
  }

  /**
   *
   * @param {String} endpointUrl
   *   URL of the API endpoint to use.  For example, Google APIs have different domains for
   *   different services (Ex: calendar uses https://www.googleapis.com and
   *   gmail uses https://gmail.googleapis.com/) so we need the full URL.
   * @param {Object} params
   *   Object dictionary whose keys/values will be encoded into the GET url.
   * @param {Backoff} backoff parameters.
   * @returns {Promise}
   */
  async apiGetCall(endpointUrl, params, backoff) {
    await ensureUpdatedCredentials(this.credentials, () => {
      this.credentialsUpdated();
    });
    const accessToken = this.credentials.oauth2.accessToken;

    const url = new URL(endpointUrl);
    for (const [key, value] of Object.entries(params || {})) {
      url.searchParams.set(key, value);
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    let result;
    for (let retries = 0; retries < backoff.max_retries; retries++) {
      try {
        const resp = await Promise.race([
          fetch(url, {
            credentials: "omit",
            headers,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Fetch is too long")),
              FETCH_TIMEOUT
            )
          ),
        ]);

        result = await resp.json();
        if (backoff.isCandidateForBackoff(resp.status, result)) {
          throw new Error(backoff.getErrorMessage(result));
        }
        break;
      } catch (e) {
        logic(this, "fetchError", { error: e.message });
        await backoff.waitAMoment(retries);
      }
    }

    logic(this, "apiCall", { endpointUrl, _params: params, _result: result });
    return result;
  }

  /**
   * Variant of apiCall that will automatically handle `nextPageToken` in the
   * results and successively issue the additional page requests, returning
   * a merged list of all results.
   *
   * @param {String} url
   *   Api url
   * @param {Object} params
   *   Api parameters
   * @param {String} resultPropertyName
   *   Property of the result object structure where we expect to find the
   *   actual set of results in each individual request.
   * @param {Function} nextPageGetter
   *   Get the next { url, params } to use from the result from an api call.
   * @param {Backoff} backoff parameters.
   * @returns {Promise}
   *   The last network result with the contents of the `resultPropertyName`
   *   property replaced by the concatenated contents of that field across all
   *   network results.
   */
  async pagedApiGetCall(
    url,
    params,
    resultPropertyName,
    nextPageGetter,
    backoff
  ) {
    let apiUrl = url;
    let useParams = Object.assign({}, params);
    const resultsSoFar = [];
    while (true) {
      const thisResult = await this.apiGetCall(apiUrl, useParams, backoff);
      if (thisResult.error) {
        return thisResult;
      }

      resultsSoFar.push(...thisResult[resultPropertyName]);

      const connectionInfo = nextPageGetter(thisResult);
      if (!connectionInfo) {
        thisResult[resultPropertyName] = resultsSoFar;
        return thisResult;
      }

      useParams = Object.assign({}, connectionInfo.params || params);
      apiUrl = connectionInfo.url || url;
    }
    // (control never falls out the bottom of the loop)
  }
}
