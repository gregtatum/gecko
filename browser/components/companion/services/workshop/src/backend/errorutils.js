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

define(['exports'], function(exports) {

  /**
   * Helpers to deal with our normalized error strings. Provides
   * metadata such as whether we should retry or report errors given
   * an error string.
   *
   * For a full description of each of these errors and why they might
   * be raised, see `mailapi.js`.
   */

  var ALL_ERRORS = {

    // Transient Errors
    'offline': { reachable: false, retry: true, report: false },
    'server-maintenance': { reachable: true, retry: true, report: false },
    'unresponsive-server': { reachable: false, retry: true, report: false },
    'port-not-listening': { reachable: false, retry: true, report: false },

    // Permanent Account Errors (user intervention required)
    'bad-user-or-pass': { reachable: true, retry: false, report: true },
    'needs-oauth-reauth': { reachable: true, retry: false, report: true },
    'imap-disabled': { reachable: true, retry: false, report: true },
    'pop3-disabled': { reachable: true, retry: false, report: true },
    'not-authorized': { reachable: true, retry: false, report: true },

    // Account Configuration Errors
    'bad-security': { reachable: true, retry: false, report: true },
    'no-config-info': { reachable: false, retry: false, report: false },
    'user-account-exists': { reachable: false, retry: false, report: false },
    'pop-server-not-great': { reachable: true, retry: false, report: false },
    'no-dns-entry': { reachable: false, retry: false, report: false },

    // Action-Specific Errors
    'bad-address': { reachable: true, retry: false, report: false },
    'server-problem': { reachable: true, retry: false, report: false },
    'unknown': { reachable: false, retry: false, report: false }

  };

  /**
   * Should we surface the error to the user so that they can take
   * action? Permanent connection problems and credential errors
   * require user intervention.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {Boolean}
   */
  exports.shouldReportProblem = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).report;
  };

  /**
   * Should we retry the operation using backoff? Only for errors that
   * will likely resolve themselves automatically, such as network
   * problems and server maintenance.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {Boolean}
   */
  exports.shouldRetry = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).retry;
  };

  /**
   * Did this error occur when the server was reachable?
   */
  exports.wasErrorFromReachableState = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).reachable;
  };

  /**
   * Analyze an error object (specifically, an exception or an
   * exception-like object) and attempt to find a matching normalized
   * string error code. Returns null if none matched, for easy
   * cascading with more specific error types.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {String|null}
   */
  exports.analyzeException = function(err) {
    // XXX: Fault-injecting-socket returns the string "Connection
    // refused" for certian socket errors. (Does mozTCPSocket raise
    // that error verbatim?) Convert that to an Error-like object.
    if (err === 'Connection refused') {
      err = { name: 'ConnectionRefusedError' };
    }
    // Otherwise, assume a plain-old string is already normalized.
    else if (typeof err === 'string') {
      return err;
    }

    if (!err.name) {
      return null;
    }

    if (/^Security/.test(err.name)) {
      return 'bad-security';
    }
    else if (/^ConnectionRefused/i.test(err.name)) {
      return 'unresponsive-server';
    }
    else {
      return null;
    }
  }

});
