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

import messageChunkedPartStream from '../protocol/message_chunked_part_stream';

import { BYTES_PER_IMAP_FETCH_CHUNK_REQUEST, BYTES_PER_BLOB_CHUNK } from '../../../syncbase';

export default {
  async downloadParts(ctx, account, messageInfo, parts) {
    // - Get the folder and UID
    let { folderInfo, uid } =
      await this.getFolderAndUidForMesssage(ctx, account, messageInfo);

    // - Create and return the stream.
    return messageChunkedPartStream({
      ctx,
      pimap: account.pimap,
      folderInfo,
      uid,
      parts,
      downloadChunkSize: BYTES_PER_IMAP_FETCH_CHUNK_REQUEST,
      saveChunkSize: BYTES_PER_BLOB_CHUNK
    });
  },
};
