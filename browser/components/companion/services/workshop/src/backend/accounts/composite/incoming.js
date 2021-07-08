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

import * as $acctmixins from "../../accountmixins";

/**
 * A base class for IMAP and POP accounts.
 *
 * A lot of the functionality related to handling folders,
 * orchestrating jobs, etc., is common to both IMAP and POP accounts.
 * This class factors out the common functionality, allowing the
 * ImapAccount and Pop3Account classes to only provide
 * protocol-specific code.
 *
 * @param {Class} FolderSyncer The class to instantiate for folder sync.
 *
 * The rest of the parameters match those passed to Pop3Account and
 * ImapAccount.
 */
export function CompositeIncomingAccount(
  universe,
  compositeAccount,
  accountId,
  credentials,
  connInfo,
  foldersTOC,
  dbConn /*, existingProtoConn */
) {
  // our logic scope is defined by our subclass

  this.universe = universe;
  this.compositeAccount = compositeAccount;
  this.id = accountId;
  this.accountDef = compositeAccount.accountDef;
  this.enabled = true;
  this._alive = true;
  this._credentials = credentials;
  this._connInfo = connInfo;
  this._engineData = this.accountDef.engineData;
  this._db = dbConn;

  this.foldersTOC = foldersTOC;
  // this is owned by the TOC.  Do not mutate!
  this.folders = this.foldersTOC.items;
}
CompositeIncomingAccount.prototype = {
  ////////////////////////////////////////////////////////////////
  // ACCOUNT OVERRIDES
  runOp: $acctmixins.runOp,
  getFirstFolderWithType: $acctmixins.getFirstFolderWithType,
  getFolderByPath: $acctmixins.getFolderByPath,

  /**
   * We receive this notification from our _backoffEndpoint.
   */
  onEndpointStateChange(state) {
    console.log("endpoint state change:", state);
    /*
    switch (state) {
      case 'healthy':
        this.universe.__removeAccountProblem(this.compositeAccount,
                                             'connection', 'incoming');
        break;
      case 'unreachable':
      case 'broken':
        this.universe.__reportAccountProblem(this.compositeAccount,
                                             'connection', 'incoming');
        break;
      default:
        break;
    }
    */
  },
};
