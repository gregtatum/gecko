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
 * Common code for creating and working with various account types.
 *
 * @module
 **/

define(
  [
    'shared/a64',
    'logic',
    'shared/allback',
    'require',
    'module',
    'exports'
  ],
  function(
    $a64,
    logic,
    allback,
    require,
    $module,
    exports
  ) {
'use strict';

var latchedWithRejections = allback.latchedWithRejections;

/**
 * Recreate an existing account, e.g. after a database upgrade.
 *
 * @param universe the MailUniverse
 * @param oldVersion the old database version, to help with migration
 * @param accountInfo the old account info
 * @param callback a callback to fire when we've completed recreating the
 *        account
 */
function recreateAccount(universe, oldVersion, accountInfo) {
  return new Promise((resolve, reject) => {
    requireConfigurator(accountInfo.def.type, function (mod) {
      // resolve the promise with the promise returned by the configurator
      resolve(mod.configurator.recreateAccount(universe, oldVersion,
                                               accountInfo));
    });
  });
}
exports.recreateAccount = recreateAccount;

function tryToManuallyCreateAccount(universe, userDetails, domainInfo) {
  return new Promise((resolve, reject) => {
    requireConfigurator(domainInfo.type, function (mod) {
      // resolve the promise with the promise returned by the configurator
      resolve(
        mod.configurator.tryToCreateAccount(universe, userDetails, domainInfo));
    });
  });
}
exports.tryToManuallyCreateAccount = tryToManuallyCreateAccount;

}); // end define
