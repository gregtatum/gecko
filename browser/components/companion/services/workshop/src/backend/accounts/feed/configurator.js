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

export default function configurateFeed(userDetails /*, domainInfo*/) {
  return {
    // Pass the user details through because the validator will want to mutate
    // `displayName` and `address` into place (for now, until things get
    // further generalized, this was an email client after all).
    userDetails,
    credentials: {},
    typeFields: {},
    connInfoFields: {
      feedUrl: userDetails.feedUrl,
      feedType: "",
    },
  };
}
