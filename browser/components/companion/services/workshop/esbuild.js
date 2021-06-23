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

// ## Main Thread API
//
// This currently builds a single ES Module for importing.
//
// With some effort and a commitment not to introduce additional non-module
// dependencies, we could likely move to importing things without a build step.
//
// The primary logistical issues would be:
// - Because there is shared code between the API and the worker and workers
//   can't directly load modules, we would either need to generate `jar.mn` as
//   part of the build process or potentially include much more in the jar.mn
//   than we need.
// - The browser doesn't currently provide a solution like
//   https://github.com/WICG/import-maps so some manual transformations plus
//   potentially a more involved vendoring/transformation step would be
//   necessary.  For current usage this isn't too bad because most of our
//   dependencies are abandoned, but this could be a stumbling block.
require("esbuild").buildSync({
  entryPoints: {
    "workshop-api-built": "./src/main-frame-setup",
  },
  format: "esm",
  define: {
    WORKER_PATH:
      '"chrome://browser/content/companion/workshop-worker-built.js"',
  },
  platform: "browser",
  target: "esnext",
  bundle: true,
  write: true,
  outdir: "build",
  resolveExtensions: [".js"],
  banner: {
    js: "// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY",
  },
});

// ## SharedWorker backend
require("esbuild").buildSync({
  entryPoints: {
    "workshop-worker-built": "./src/backend/worker-setup",
  },
  platform: "browser",
  target: "esnext",
  bundle: true,
  write: true,
  outdir: "build",
  resolveExtensions: [".js"],
  globalName: "WorkshopBackend",
  banner: {
    js: "// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY",
  },
});
