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
 * Send a mail message for v12.x and lower ActiveSync servers.
 *
 * co-wrapped because outbox_send's sendMessage is expected to return a Promise.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {HTMLBlob} args.blob
 * @param {Function} args.progress
 *   A function to be invoked periodically on progress to help our caller know
 *   that we're still alive and doing things.
 */
export default async function sendMail(conn, { mimeBlob, progress }) {
  await conn.postData("SendMail", "message/rfc822", mimeBlob, {
    extraParams: {
      SaveInSent: "T",
    },
    uploadProgress: progress,
  });
}
