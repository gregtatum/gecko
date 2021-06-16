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

import ICAL from 'ical.js';

/**
 * Validate a bearer calendar URL by verifying it parses fine and then
 * extracting metadata to help name the calendar.
 */
export default async function validateICal({ userDetails, credentials, connInfoFields }) {
  const calendarUrl = connInfoFields.calendarUrl;

  try {
    const icalReq = new Request(
      calendarUrl,
      {
      });
    const icalResp = await fetch(icalReq);
    if (icalResp.status >= 400) {
      return {
        error: 'unknown',
        errorDetails: {
          status: icalResp.status,
          calendarUrl,
        },
      };
    }

    const icalText = await icalResp.text();
    const parsed = ICAL.parse(icalText);
    const root = new ICAL.Component(parsed);

    const calName = root.getFirstPropertyValue('x-wr-calname') || 'Unnamed Calendar';

    userDetails.displayName = calName;
    // XXX This is not strictly correct but also doesn't matter.  We should
    // normalize how the `account_create` task chooses the account name to not
    // draw directly from this.
    userDetails.emailAddress = calName;
  } catch(ex) {
    return {
      error: 'unknown',
      errorDetails: {
        message: ex.toString(),
      },
    };
  }

  return {
    engineFields: {
      engine: 'ical',
      engineData: {
      },
      receiveProtoConn: null,
    },
  };
}
