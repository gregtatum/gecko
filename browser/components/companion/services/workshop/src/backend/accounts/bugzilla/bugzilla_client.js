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
 * Thin API layer for talking to Bugzilla.
 */
export default class BugzillaClient {
  constructor({ serverUrl, apiToken }) {
    this.serverUrl = new URL(serverUrl);
    this.apiToken = apiToken;
  }

  async restCall(restPath, urlSearchParams) {
    let url = `${this.serverUrl.origin}/rest/${restPath}`;
    if (urlSearchParams) {
      url += "?" + urlSearchParams.toString();
    }

    const headers = {
      Accept: "application/json",
      "X-BUGZILLA-API-KEY": this.apiToken,
    };

    // Although this fetch would normally be cross-origin and therefore require
    // CORS, we have explicitly listed the Mozilla Bugzilla instance in our
    // permissions list and so BasePrincipal::IsThirdPartyURI will return false
    // because BasePrincipal::AddonAllowsLoad will return true.
    const resp = await fetch(url, {
      credentials: "omit",
      method: "GET",
      headers,
    });
    const result = await resp.json();
    return result;
  }

  /**
   * Convert a JS Date to Bugzilla's REST API's desired datetime representation.
   *
   * Bugzilla wants the `toISOString` representation of date except for the
   * fractional seconds, so we substring them out.  Cutting at the fractional
   * decimal removes the Z suffix, so we manually re-add that.
   */
  dateToString(date) {
    return date.toISOString().substring(0, 19) + "Z";
  }
}
