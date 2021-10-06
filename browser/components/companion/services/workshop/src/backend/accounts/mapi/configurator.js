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

import { PERFNOW } from "shared/date";

export default function configurateMapi(userDetails, domainInfo) {
  const credentials = {};

  if (domainInfo.oauth2Tokens) {
    // We need to save off all the information so:
    // - the front-end can reauthorize exclusively from this info.
    // - the back-end can refresh its token
    // - on upgrades so we can know if our scope isn't good enough.  (Note
    //   that we're not saving off the secret group; upgrades would need to
    //   factor in the auth or token endpoints.)
    credentials.oauth2 = {
      authEndpoint: domainInfo.oauth2Settings.authEndpoint,
      tokenEndpoint: domainInfo.oauth2Settings.tokenEndpoint,
      scope: domainInfo.oauth2Settings.scope,
      clientId: domainInfo.oauth2Secrets.clientId,
      clientSecret: domainInfo.oauth2Secrets.clientSecret,
      refreshToken: domainInfo.oauth2Tokens.refreshToken,
      accessToken: domainInfo.oauth2Tokens.accessToken,
      expireTimeMS: domainInfo.oauth2Tokens.expireTimeMS,
      // Treat the access token like it was recently retrieved; although we
      // generally expect the XOAUTH2 case should go through without
      // failure, in the event something is wrong, immediately re-fetching
      // a new accessToken is not going to be useful for us.
      _transientLastRenew: PERFNOW(),
    };
  }

  return {
    // Pass the user details through because the validator will want to mutate
    // the object as it discovers the display name and email address from the
    // server.
    userDetails,
    credentials,
    typeFields: {},
    connInfoFields: {},
    kind: "calendar",
  };
}
