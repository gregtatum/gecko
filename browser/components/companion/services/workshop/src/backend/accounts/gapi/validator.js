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

import { normalizeError } from "../../utils/normalize_err";
import ApiClient from "../../utils/api_client";

/**
 * The Phabricator validator validates the server/API key information while
 * also determining who the current user is and the groups (projects) they
 * belong to.
 *
 */
export default async function validateGapi({
  userDetails,
  credentials,
  connInfoFields,
}) {
  const client = new ApiClient(credentials);
  const endpoint = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

  try {
    // ## Get the user's email address so we can identify the account
    const whoami = await client.apiGetCall(endpoint, {});

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
    userDetails.displayName = "";
    userDetails.emailAddress = whoami.emailAddress;
  } catch (ex) {
    return {
      error: "unknown",
      errorDetails: {
        endpoint,
        ex: normalizeError(ex),
      },
    };
  }

  return {
    engineFields: {
      engine: "gapi",
      engineData: {},
    },
    receiveProtoConn: null,
  };
}
