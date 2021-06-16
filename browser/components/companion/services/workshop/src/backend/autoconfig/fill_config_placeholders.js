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

define(function() {
'use strict';

return function fillConfigPlaceholders(userDetails, sourceConfigInfo) {
  // Return a mutated copy, don't mutate the original.
  var configInfo = JSON.parse(JSON.stringify(sourceConfigInfo));

  var details = userDetails.emailAddress.split('@');
  var emailLocalPart = details[0], emailDomainPart = details[1];

  var placeholderFields = {
    incoming: ['username', 'hostname', 'server'],
    outgoing: ['username', 'hostname'],
  };

  function fillPlaceholder(value) {
    return value.replace('%EMAILADDRESS%', userDetails.emailAddress)
                .replace('%EMAILLOCALPART%', emailLocalPart)
                .replace('%EMAILDOMAIN%', emailDomainPart)
                .replace('%REALNAME%', userDetails.displayName);
  }

  for (var serverType in placeholderFields) {
    var fields = placeholderFields[serverType];
    var server = configInfo[serverType];
    if (!server) {
      continue;
    }

    for (var iField = 0; iField < fields.length; iField++) {
      var field = fields[iField];

      if (server.hasOwnProperty(field)) {
        server[field] = fillPlaceholder(server[field]);
      }
    }
  }

  return configInfo;
};
});
