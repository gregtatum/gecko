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

import { ApiClient } from "../../utils/api_client";
import { MapiBackoff } from "./account";

/**

/**
 * The Phabricator validator validates the server/API key information while
 * also determining who the current user is and the groups (projects) they
 * belong to.
 *
 */
export default async function validateMapi({
  userDetails,
  credentials,
  connInfoFields,
}) {
  const backoff = new MapiBackoff(null);
  const client = new ApiClient(credentials, "unknown mapi account id", backoff);
  const endpoint = "https://graph.microsoft.com/v1.0/me";

  // ## Get the user's email address so we can identify the account
  const results = await client.apiGetCall(endpoint, {});
  if (results.error) {
    return {
      error: "unknown",
      errorDetails: {
        endpoint,
      },
    };
  }

  // TODO: Figure out:
  // 1. Whether we need the user's display name anymore.  Our original need
  //    for it was because we had to know it to be able to compose emails and
  //    send them via SMTP.  But if we're using a higher level email sending
  //    API, we only need this to the extent we expose identities for the
  //    purpose of switching between them (if the server handles the lower
  //    level composition/sending aspects).
  // 2. If we need it, we probably want to figure out the gmail identity
  //    setup and use that even though it seems like the core OAuth ident
  //    stuff might provide it based on the implications of the oauth flows.

  userDetails.displayName = results.displayName;
  userDetails.emailAddress = results.userPrincipalName;

  return {
    engineFields: {
      engine: "mapi",
      engineData: {},
      receiveProtoConn: null,
    },
  };
}
