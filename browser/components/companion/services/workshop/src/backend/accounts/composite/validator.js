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

async function gimmeProbers(isImap) {
  if (isImap) {
    const receiveMod = await import("../imap/probe");
    const sendMod = await import("../smtp/probe");
    return [receiveMod.default, sendMod.default];
  }
  const receiveMod = await import("../pop3/probe");
  const sendMod = await import("../smtp/probe");
  return [receiveMod.default, sendMod.default];
}

/**
 * Validate the credentials and connection configurations for the given account.
 * This is currently used for account creation, but could also be used for
 * validating potentially more serious changes to an account, should we allow
 * more of the configuration to be changed than just the password.
 *
 * Note that the credentials may be mutated in the case of oauth2, so this is
 * not some pure functional routine.
 *
 * Returns { engineFields, receiveProtoConn } on success, { error,
 * errorDetails } on failure.
 */
export default async function({ credentials, typeFields, connInfoFields }) {
  let isImap = typeFields.receiveType === "imap";

  // - Dynamically load the required modules.
  // But in a statically traceable way.
  let [receiveProber, sendProber] = await gimmeProbers(isImap);

  // - Initiate the probes in parallel...
  // Note: For OAUTH accounts, the credentials may be updated
  // in-place if a new access token was required.  Our callers are required to
  // be cool with this.
  let receivePromise = receiveProber.probeAccount(
    credentials,
    connInfoFields.receiveConnInfo
  );
  let sendPromise = sendProber.probeAccount(
    credentials,
    connInfoFields.sendConnInfo
  );
  // ... but we don't have to process them in that order.

  // - Process the receive probe results
  let engineFields;
  let protoConn;
  // (the prober will throw any failure result)
  try {
    let receiveResults = await receivePromise;

    protoConn = receiveResults.conn;
    if (isImap) {
      engineFields = {
        engine: receiveResults.engine,
        engineData: {
          capability: protoConn.capability,
        },
      };
    } else {
      engineFields = {
        engine: "pop3",
        engineData: {
          preferredAuthMethod: protoConn.authMethod,
        },
      };
    }
  } catch (error) {
    return {
      error,
      errorDetails: { server: connInfoFields.receiveConnInfo.hostname },
    };
  }

  try {
    // We don't actually care about the return value, just that the probing
    // didn't fail.
    await sendPromise;
  } catch (error) {
    // If we have an open connection, close it on the way out.
    if (protoConn) {
      protoConn.close();
    }
    return {
      error,
      errorDetails: { server: connInfoFields.sendConnInfo.hostname },
    };
  }

  return {
    engineFields,
    receiveProtoConn: protoConn,
  };
}
