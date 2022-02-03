/* eslint-disable no-fallthrough */
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

export class MapiBackoff extends Backoff {
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

  handleError(status, results) {
    let resource = null,
      problem = null;
    const id = this.account?.id ?? -1;

    switch (status) {
      case 401:
        resource = `credentials!${id}`;
        problem = {
          superCritical: true,
          credentials:
            "Required authentication information is either missing or not valid for the resource.",
        };
        break;
      case 403:
        resource = `permissions!${id}`;
        problem = {
          superCritical: true,
          permissions:
            "Access is denied to the requested resource. The user might not have enough permission.",
        };
        break;
      case 404:
        resource = `queries!${id}`;
        problem = { queries: "The requested resource doesn't exist" };
        break;
      case 405:
        resource = `queries!${id}`;
        problem = {
          queries:
            "The HTTP method in the request is not allowed on the resource.",
        };
        break;
      case 406:
        resource = `queries!${id}`;
        problem = {
          queries:
            "This service doesn't support the format requested in the Accept header.",
        };
        break;
      case 409:
        resource = `queries!${id}`;
        problem = {
          queries:
            "The current state conflicts with what the request expects. For example, the specified parent folder might not exist.",
        };
        break;
      case 410:
        resource = `queries!${id}`;
        problem = {
          queries:
            "The requested resource is no longer available at the server.",
        };
        break;
      case 411:
        resource = `queries!${id}`;
        problem = {
          queries: "A Content-Length header is required on the request.",
        };
        break;
      case 412:
        resource = `queries!${id}`;
        problem = {
          queries:
            "A precondition provided in the request (such as an if-match header) does not match the resource's current state.",
        };
        break;
      case 413:
        resource = `queries!${id}`;
        problem = { queries: "The request size exceeds the maximum limit." };
        break;
      case 415:
        resource = `queries!${id}`;
        problem = {
          queries:
            "The content type of the request is a format that is not supported by the service.",
        };
        break;
      case 416:
        resource = `queries!${id}`;
        problem = {
          queries: "The specified byte range is invalid or unavailable.",
        };
        break;
      case 422:
        resource = `queries!${id}`;
        problem = {
          queries:
            "Cannot process the request because it is semantically incorrect.",
        };
        break;
    }

    this.handleCriticalError(problem, resource);
  }
}

export default class MapiAccount {
  constructor(universe, accountDef, foldersTOC, dbConn /*, receiveProtoConn*/) {
    this.universe = universe;
    this.id = accountDef.id;
    this.accountDef = accountDef;

    this._db = dbConn;

    this.enabled = true;
    this.identities = accountDef.identities;

    this.foldersTOC = foldersTOC;
    this.folders = this.foldersTOC.items;

    const backoff = new MapiBackoff(this);
    this.client = new ApiClient(accountDef.credentials, this.id, backoff);
  }

  get problems() {
    return this.accountDef.problems;
  }

  toString() {
    return `[MapiAccount: ${this.id}]`;
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

MapiAccount.type = "mapi";
MapiAccount.supportsServerFolders = false;
