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

import TaskDefiner from "../../../task_infra/task_definer";

import sendMail from "../smotocol/send_mail";
import sendMail12x from "../smotocol/send_mail_12x";

import MixOutboxSend from "../../../task_mixins/mix_outbox_send";

/**
 * ActiveSync outbox sending:
 * - The server puts the message in the sent folder automatically, so that's
 *   easy/free and we use the default saveSentMessage implementation.
 */
export default TaskDefiner.defineComplexTask([
  MixOutboxSend,
  {
    shouldIncludeBcc(/* account */) {
      // ActiveSync auto-appends.
      return true;
    },

    async sendMessage(ctx, account, composer) {
      let conn;
      // Unlike other tasks, we handle errors explicitly in-band, so convert
      // connection establishing errors to a formal return value.
      try {
        conn = await account.ensureConnection();
      } catch (ex) {
        return { error: ex.message };
      }

      let mimeBlob = composer.superBlob;
      let progress = (/*loaded, total*/) => {
        composer.heartbeat("ActiveSync sendMessage");
      };

      try {
        if (conn.currentVersion.gte("14.0")) {
          await sendMail(conn, { mimeBlob, progress });
        } else {
          await sendMail12x(conn, { mimeBlob, progress });
        }
      } catch (ex) {
        return { error: ex.message };
      }

      return { error: null };
    },
  },
]);
