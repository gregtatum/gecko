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

/*eslint-env node*/
require("esbuild").buildSync({
  entryPoints: {
    "workshop-api-built": "./src/main-frame-setup",
    "workshop-worker-built": "./src/backend/worker-setup",
  },
  platform: "browser",
  target: "esnext",
  bundle: true,
  write: true,
  outdir: "build",
  resolveExtensions: [".js"],
  globalName: "WorkshopAPI",
  banner: {
    js: "// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY",
  },
});
