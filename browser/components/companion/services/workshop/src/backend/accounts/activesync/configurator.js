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
 * Randomly create a unique device id so that multiple devices can independently
 * synchronize without interfering with each other.  Our only goals are to avoid
 * needlessly providing fingerprintable data and avoid collisions with other
 * instances of ourself.  We're using Math.random over crypto.getRandomValues
 * since node does not have the latter right now and predictable values aren't
 * a concern.
 *
 * @return {String}
 *   A multi-character ASCII alphanumeric sequence.  (Probably 10 or 11 digits.)
 */
function makeUniqueDeviceId() {
  return Math.random().toString(36).substr(2);
}

/**
 * Consuming userDetails and domainInfo, create the account-specific account
 * definition fragments.  ActiveSync really only has an endpoint, so there isn't
 * much going on in here.  The main tricky thing is that we still might need
 * to run autodiscover; see the validator for more details on that.
 */
export default function(userDetails, domainInfo) {
  let deviceId = makeUniqueDeviceId();

  let credentials;
  let connInfo;
  // If there's an autodiscover endpoint we need to pass that through to the
  // validator stage which will then regenerate the connInfo and the
  // credentials.
  if (domainInfo.incoming.autodiscoverEndpoint) {
    credentials = {
      emailAddress: userDetails.emailAddress,
      password: userDetails.password
    };
    connInfo = {
      autodiscoverEndpoint: domainInfo.incoming.autodiscoverEndpoint,
      deviceId
    };
  } else {
    credentials = {
      username: domainInfo.incoming.username,
      password: userDetails.password
    };
    connInfo = {
      server: domainInfo.incoming.server,
      deviceId
    };
  }

  return {
    credentials,
    typeFields: {
    },
    connInfoFields: {
      connInfo
    }
  };
}
