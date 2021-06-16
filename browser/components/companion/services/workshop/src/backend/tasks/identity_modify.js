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

import logic from 'logic';
import TaskDefiner from '../task_infra/task_definer';

/**
 * Manipulate identity settings.  Right now we only support one identity per
 * account and we hard-code the path, though it wouldn't take much to
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: 'identity_modify',

    async plan(ctx, rawTask) {
      // Access the account for read-only consultation.  Because we don't need
      // to wait on any network access and because of how things actually work,
      // we could absolutely acquire this for write mutation and do an explicit
      // write.  However, by using the clobber mechanism we are able to have
      // prettier/more explicit logging and also have unit tests that more
      // directly ensure what we're doing in here is correct as it relates to
      // to our conditionalized username/password logic.
      const accountClobbers = new Map();

      // for now there's still only one identity.
      const identIndex = 0;
      const identPath = ['identities', identIndex];

      for (let key in rawTask.mods) {
        const val = rawTask.mods[key];

        switch (key) {
          case 'name':
            accountClobbers.set(identPath.concat('name'), val);
            break;

          case 'address':
            accountClobbers.set(identPath.concat('address'), val);
            break;

          case 'replyTo':
            accountClobbers.set(identPath.concat('replyTo'), val);
            break;

          case 'signature':
            accountClobbers.set(identPath.concat('signature'), val);
            break;

          case 'signatureEnabled':
            accountClobbers.set(identPath.concat('signatureEnabled'), val);
            break;

          default:
            logic(ctx, 'badModifyIdentityKey', { key });
            break;
        }
      }

      await ctx.finishTask({
        atomicClobbers: {
          accounts: new Map([
            [
              rawTask.accountId,
              accountClobbers
            ]
          ])
        }
      });
    }
  }
]);
