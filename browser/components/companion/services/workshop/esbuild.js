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
