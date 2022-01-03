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

class MapiBackoff extends Backoff {
  isCandidateForBackoff(status, { error }) {
    // https://docs.microsoft.com/en-us/graph/errors
    return [
      423, // The resource that is being accessed is locked.
      429 /* Client application has been throttled and should not attempt to
                    repeat the request until an amount of time has elapsed. */,
      500, // There was an internal server error while processing the request.
      503 /* The service is temporarily unavailable for maintenance or is
                    overloaded. You may repeat the request after a delay, the length
                    of which may be specified in a Retry-After header. */,
      504 /* The server, while acting as a proxy, did not receive a timely
                    response from the upstream server it needed to access in
                    attempting to complete the request. May occur together with
                    503. */,
      509 /* Your app has been throttled for exceeding the maximum bandwidth
                    cap. Your app can retry the request again after more time has
                    elapsed. */,
    ].includes(status);
  }
}

export const MapiBackoffInst = new MapiBackoff();

export default class MapiAccount {
  constructor(universe, accountDef, foldersTOC, dbConn /*, receiveProtoConn*/) {
    this.universe = universe;
    this.id = accountDef.id;
    this.accountDef = accountDef;

    this._db = dbConn;

    this.enabled = true;
    this.problems = [];

    this.identities = accountDef.identities;

    this.foldersTOC = foldersTOC;
    this.folders = this.foldersTOC.items;

    this.client = new ApiClient(accountDef.credentials, this.id);
  }

  toString() {
    return `[MapiAccount: ${this.id}]`;
  }

  // TODO: evaluate whether the account actually wants to be a RefedResource
  // with some kind of reaping if all references die and no one re-acquires it
  // within some timeout horizon.
  __acquire() {
    return Promise.resolve(this);
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

MapiAccount.type = "mapi";
MapiAccount.supportsServerFolders = false;
