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

import { ApiClient, Backoff } from "../../utils/api_client";

export class GapiBackoff extends Backoff {
  isCandidateForBackoff(status, { error }, context) {
    // https://developers.google.com/calendar/api/guides/errors
    return (
      error &&
      ((error.code === 403 &&
        [
          "User Rate Limit Exceeded",
          "Rate Limit Exceeded",
          "Calendar usage limits exceeded.",
        ].includes(error.errors?.[0]?.reason)) ||
        // It's very likely a temporary issue.
        (error.code === 404 && context !== "document-title") ||
        error.code === 429 ||
        error.code === 500)
    );
  }

  handleError(status, result, context) {
    if (!result || !result.error) {
      return;
    }

    let resource = null,
      problem = null;
    const id = this.account?.id ?? -1;
    const { error } = result;

    switch (error.code) {
      case 401:
        resource = `credentials!${id}`;
        problem = {
          superCritical: true,
          credentials: error.message || "Invalid Credentials",
        };
        break;
    }

    this.handleCriticalError(problem, resource);
  }
}

export default class GapiAccount {
  constructor(universe, accountDef, foldersTOC, dbConn /*, receiveProtoConn*/) {
    this.universe = universe;
    this.id = accountDef.id;
    this.accountDef = accountDef;

    this._db = dbConn;

    this.enabled = true;

    this.identities = accountDef.identities;

    this.foldersTOC = foldersTOC;
    this.folders = this.foldersTOC.items;

    const backoff = new GapiBackoff(this);
    this.client = new ApiClient(accountDef.credentials, this.id, backoff);
  }

  get problems() {
    return this.accountDef.problems;
  }

  toString() {
    return `[GapiAccount: ${this.id}]`;
  }

  // TODO: evaluate whether the account actually wants to be a RefedResource
  // with some kind of reaping if all references die and no one re-acquires it
  // within some timeout horizon.
  async __acquire() {
    return this;
  }
  __release() {}

  // TODO: Other account types use a callback argument, they will need to be
  // adapted.
  async checkAccount() {
    return null;
  }

  shutdown() {
    // Nothing to actually shutdown.
  }
}

GapiAccount.type = "gapi";
GapiAccount.supportsServerFolders = false;
