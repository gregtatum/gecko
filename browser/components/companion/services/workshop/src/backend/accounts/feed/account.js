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

export default class FeedAccount {
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

    this.feedUrl = accountDef.feedUrl;
    this.feedType = accountDef.feedType;
  }

  toString() {
    return `[FeedAccount: ${this.id}]`;
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

FeedAccount.type = "Feed";
FeedAccount.supportsServerFolders = false;
