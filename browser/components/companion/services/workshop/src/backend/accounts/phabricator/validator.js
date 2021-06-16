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

import PhabricatorClient from './phabricator_client';

/**
 * The Phabricator validator validates the server/API key information while
 * also determining who the current user is and the groups (projects) they
 * belong to.
 *
 */
export default async function validatePhabricator({ userDetails, credentials, connInfoFields }) {
  const client = new PhabricatorClient({
    serverUrl: connInfoFields.serverUrl,
    apiToken: credentials.apiKey,
  });

  let userPhid;
  let groups;

  try {
    const whoami = await client.apiCall(
      'user.whoami',
      {}
    );

    userDetails.displayName = whoami.realName;
    // This isn't actually an email address.  We do have one available as
    // `primaryEmail` but that's not currently something we care about.
    userDetails.emailAddress = whoami.userName;

    userPhid = whoami.phid;
  } catch(ex) {
    // XXX this should be a `logic` error
    console.error('Problem running whoami', ex);
    return {
      error: 'unknown',
      errorDetails: {
        server: connInfoFields.serverUrl,
      },
    };
  }

  try {
    const projects = await client.apiCall(
      'project.search',
      {
        constraints: {
          members: [userPhid]
        }
      }
    );

    groups = [];
    for (const info of projects.data) {
      // Bugzilla security groups are boring, so we want to ignore them.
      if (!info.fields.name.startsWith('bmo-')) {
        groups.push({
          id: info.id,
          phid: info.phid,
          name: info.fields.name,
          description: info.fields.description,
        });
      }
    }
  } catch(ex) {
    // XXX this should be a `logic` error
    console.error('Problem running projects search', ex);
    return {
      error: 'unknown',
      errorDetails: {
        server: connInfoFields.serverUrl,
      },
    };
  }


  return {
    engineFields: {
      engine: 'phabricator',
      engineData: {
        userPhid,
        groups,
      },
      receiveProtoConn: null,
    },
  };
}
