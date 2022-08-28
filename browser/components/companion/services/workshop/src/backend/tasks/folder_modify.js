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

import logic from "logic";
import TaskDefiner from "../task_infra/task_definer";

/**
 * Manipulate account settings.  This mainly entails mapping the request fields
 * onto the actual storage fields.
 */
export const CommonFolderModify = TaskDefiner.defineSimpleTask([
  {
    name: "folder_modify",

    async plan(ctx, rawTask) {
      // Access the folder for read-only consultation.  Because we don't need
      // to wait on any network access and because of how things actually work,
      // we could absolutely acquire this for write mutation and do an explicit
      // write.
      const { mods } = rawTask;
      const folders = new Map();
      const folderClobbers = new Map();
      for (const [folderId, actions] of Object.entries(mods.actions)) {
        const folderDef = await ctx.readSingle("folders", folderId);
        const tags = folderDef.tags || [];

        for (const [key, val] of Object.entries(actions)) {
          switch (key) {
            case "addtag":
              {
                const prevLength = tags.length;
                for (const tag of val) {
                  if (!tags.includes(tag)) {
                    tags.push(tag);
                  }
                }
                if (tags.length !== prevLength) {
                  folderClobbers.set(["tags"], tags);
                }
              }
              break;
            case "rmtag":
              {
                const prevLength = tags.length;
                for (const tag of val) {
                  const idx = tags.indexOf(tag);
                  if (idx !== -1) {
                    tags.splice(idx, 1);
                  }
                }
                if (tags.length !== prevLength) {
                  folderClobbers.set(["tags"], tags);
                }
              }
              break;
            default:
              logic(ctx, "badModifyFolderKey", { key });
              break;
          }
        }
        if (folderClobbers.size) {
          folders.set(folderId, folderClobbers);
        }
      }

      await ctx.finishTask({
        atomicClobbers: {
          folders,
        },
      });
    },
  },
]);
