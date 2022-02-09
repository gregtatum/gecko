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

export class CriticalError extends Error {
  constructor(problem) {
    super(problem.credentials || problem.permissions || problem.queries);
    this.name = "CriticalError";
    this.problem = problem;
  }
}

export class SuperCriticalError extends CriticalError {
  constructor(problem) {
    super(problem);
    this.name = "SuperCriticalError";
  }
}

/**
 * Implement a truncated exponential backoff strategy:
 * https://en.wikipedia.org/wiki/Exponential_backoff#Binary_exponential_backoff_/_truncated_exponential_backoff
 *
 * In case of network errors or api errors the waitAMoment method will block for
 * few seconds depending of the number of retries.
 */
export class Backoff {
  constructor(account) {
    this.account = account;

    // Used to query again immediately
    this.max_backoff_ms = 3200;
    this.max_retries = 3;

    // Used to stop querying for few minutes
    this.criticalErrorsCounter = 0;
    this.maxCriticalError = 4;
    this.criticalBackoffStep = 0;
    this.maxCriticalBackoffSteps = 7;
    // 1 hour
    this.max_backoff_ms_critical = 1 * 60 * 60 * 1000;
  }

  /**
   * Some api errors can lead to immediate retries.
   * @param {number} status - response status.
   * @param {Object|undefined} result - returned by the REST api.
   * @param {string|undefined} context - gives an hint to know the context where the error
   * occured.
   * @returns {boolean}
   */
  isCandidateForBackoff(status, result, context) {
    return true;
  }

  /**
   * Some errors can be potentially more severe.
   * @param {number} status - response status.
   * @param {Object|undefined} result - returned by the REST api.
   * @param {string|undefined} context - gives an hint to know the context where the error
   * occured.
   * @returns {Object|null} a problem if any.
   */
  handleError(status, result, context) {
    this.handleCriticalError(null, null);
  }

  /**
   * Deal with critical errors:
   *  - credentials or scopes issues requires an action from the user:
   *    - in this case, some resources are just made unavailable and consequently
   *      all subsequent task will be deferred until something happens from the
   *      front-end.
   *  - other errors are likely due to server issues so in this case we can
   *    disable fetch tasks for few minutes in using a exponential backoff.
   *
   * If the function throws then the fetch stuff is just stoped and the error
   * should be propagated to the task in order to stop it (and potentially
   * schedule a new one) and update the account.problems field. This way, an
   * event will be emitted (tocChange) and the associated MailAccount
   * (see clientapi/mail_account.js) will be aware of this change.
   *
   * @param {Object|null} problem
   * @param {String|null} resource
   * @throws {CriticalError}
   */
  handleCriticalError(problem, resource) {
    if (!problem) {
      this.criticalErrorsCounter = Math.max(this.criticalErrorsCounter - 1, 0);
      return;
    }

    const isSuperCritical = !!problem.superCritical;
    delete problem.superCritical;

    if (!this.account) {
      if (isSuperCritical) {
        throw new SuperCriticalError(problem);
      } else {
        throw new CriticalError(problem);
      }
    }

    // Credential or scopes issues are super critical so we just disable the
    // resources and we wait for an action from the front-end.
    if (isSuperCritical) {
      this.account.universe.taskResources.resourcesNoLongerAvailable([
        resource,
      ]);
      throw new SuperCriticalError(problem);
    }

    this.criticalErrorsCounter++;
    // We had consecutively maxCriticalError errors so likely something is
    // wrong on the server.
    // Consequently, we remove temporarly the resource in order to avoid
    // any further attempts.
    if (this.criticalErrorsCounter === this.maxCriticalError) {
      const exponent = this.criticalBackoffStep;
      this.criticalBackoffStep = Math.max(
        this.criticalBackoffStep + 1,
        this.maxCriticalBackoffSteps
      );
      const time_ms = Math.min(
        this.max_backoff_ms_critical,
        Math.ceil((2 ** exponent + Math.random()) * 60 * 1000)
      );
      this.criticalErrorsCounter = 0;

      // We remove the resource for a certain amount of time...
      this.account.universe.taskResources.resourcesNoLongerAvailable([
        resource,
      ]);

      // ...and we make it available later.
      setTimeout(
        () => this.account.universe.taskResources.resourceAvailable([resource]),
        time_ms
      );
    }

    throw new CriticalError(problem);
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
      Math.ceil((2 ** step + Math.random()) * 100)
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
  constructor(credentials, accountId, backoff) {
    logic.defineScope(this, "ApiClient", { accountId });
    this.credentials = credentials;
    this._dirtyCredentials = false;
    this.backoff = backoff;
    this.abortController = new AbortController();
  }

  credentialsUpdated() {
    this._dirtyCredentials = true;
  }

  /**
   * Get date from an api endpoint.
   * @param {String} endpointUrl
   *   URL of the API endpoint to use.  For example, Google APIs have different domains for
   *   different services (Ex: calendar uses https://www.googleapis.com and
   *   gmail uses https://gmail.googleapis.com/) so we need the full URL.
   * @param {Object} params
   *   Object dictionary whose keys/values will be encoded into the GET url.
   * @param {string|undefined} context
   *   The context of this api call (could be calendar, docs, ...)
   * @returns {Promise}
   * @throws {CriticalError} in case something really wrong happens.
   */
  async apiGetCall(endpointUrl, params, context) {
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

    let result, resp;
    for (let retries = 0; retries < this.backoff.max_retries; retries++) {
      result = resp = undefined;
      try {
        resp = await Promise.race([
          fetch(url, {
            credentials: "omit",
            headers,
            signal: this.abortController.signal,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Fetch is too long")),
              FETCH_TIMEOUT
            )
          ),
        ]);

        result = await resp.json();
        if (this.backoff.isCandidateForBackoff(resp.status, result, context)) {
          throw new Error(this.backoff.getErrorMessage(result));
        }

        this.backoff.handleError(resp.status, result, context);
        break;
      } catch (e) {
        if (e instanceof CriticalError) {
          // Really bad so log and rethrow.
          logic(this, "apiCall", {
            endpointUrl,
            _params: params,
            _result: e.message,
          });
          this.abortController.abort(e);
          this.abortController = new AbortController();
          throw e;
        }

        // We got an error but it's likely not a drama so just wait a little
        // and try again.
        logic(this, "fetchError", { error: e.message });
        await this.backoff.waitAMoment(retries);
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
   * @param {string|undefined} context
   *   The context of this api call (could be calendar, docs, ...)
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
    context
  ) {
    let apiUrl = url;
    let useParams = Object.assign({}, params);
    const resultsSoFar = [];
    while (true) {
      const thisResult = await this.apiGetCall(apiUrl, useParams, context);
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
