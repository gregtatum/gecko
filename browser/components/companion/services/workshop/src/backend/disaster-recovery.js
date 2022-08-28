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
 * DisasterRecovery: A universal error-handling helper. When
 * unexpected and unhandled exceptions occur in the world, do the
 * best we can to recover as safely as possible from exceptions
 * thrown in strange places. This entails finishing any job ops,
 * closing any socket (if applicable) to ensure it doesn't get left
 * in a weird state, and logging an error as best we can.
 *
 * Besides connections, the only resources job-ops can acquire are
 * folder mutexes.  Currently, these are tracked
 *
 * In order to do this, we must track the following:
 *
 * - Which account a socket is attached to (in case it throws)
 * - Whether or not an account is running a job operation
 *
 * Then, the error handling is just a process of cleaning up any
 * resources we can.
 */

import logic from "logic";

var socketToAccountMap = new WeakMap();
var accountToOperationMap = new WeakMap();

var scope = logic.scope("DisasterRecovery");

export default class DisasterRecovery {
  setCurrentAccountOp(account, op, jobCompletedCallback) {
    accountToOperationMap.set(account, {
      op,
      callback: jobCompletedCallback,
    });
  }

  clearCurrentAccountOp(account) {
    accountToOperationMap.delete(account);
  }

  // Track which account maps to each socket.

  associateSocketWithAccount(socket, account) {
    socketToAccountMap.set(socket, account);
  }

  /**
   * Wrap calls to external socket handlers in this function; if
   * they throw an exception, we'll try to mitigate it.
   */
  catchSocketExceptions(socket, fn) {
    try {
      fn();
    } catch (e) {
      var account = socketToAccountMap.get(socket);

      // Attempt to close the socket so that we're less likely to
      // get stuck in a completely broken state, either by sending
      // bogus data or barfing on further received data.
      try {
        socket.close();
      } catch (socketEx) {
        console.error("Error attempting to close socket:", socketEx);
      }

      this.handleDisastrousError(e, account);
    }
  }

  /**
   * Something horrible has happened, and we must clean up the mess.
   * Perhaps a socket ondata handler threw an exception, or
   * something of that nature. If we're running a job, we should
   * abort and maybe reschedule. If we have the mutex, we must
   * release it.
   *
   * @param {Error} exception
   * @param {MailAccount|null} account
   */
  handleDisastrousError(e, account) {
    var op, jobDoneCallback;
    if (account) {
      var opInfo = accountToOperationMap.get(account);
      if (opInfo) {
        op = opInfo.op;
        jobDoneCallback = opInfo.callback;
      }
    }

    logic(scope, "exception", {
      accountId: account && account.id,
      op,
      error: e,
      errorName: e && e.name,
      errorMessage: e && e.message,
      stack: e.stack,
    });

    console.error(
      "*** Disastrous Error for email accountId",
      account && account.id,
      "-- attempting to recover..."
    );

    // See if we can recover in any way.
    if (account) {
      if (op) {
        logic(scope, "finished-job", { error: e });
        console.warn("Force-completing in-progress op:", op);
        jobDoneCallback("disastrous-error");
      } else {
        console.warn("No job operation was currently running.");
      }
    } else {
      console.warn("No account associated with this error; nothing to abort.");
    }
  }
}
