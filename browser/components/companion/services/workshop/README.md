## The Services Workshop: A Fancy Backend for Service Integrations

The code in this directory is a continuation of the Firefox OS email app's
backend at (and as of)
https://github.com/mozilla-b2g/gaia-email-libs-and-more/commit/9cc1b9287e15731117460f3f595a5fb7941c7ad4
with new development happening here in the tree.

The general setup is:
- There's an API that gets loaded into the front-end window.  This is a client
  to the back-end.  This code is loaded from `build/workshop-api-built.js` and
  contributes the `WorkshopAPI` global.
- The back-end runs in a SharedWorker, which is where all the heavy lifting
  happens.  The code is loaded from `build/workshop-worker-built.js`.

### Development

#### Building / Checking Things In

We check in BOTH:
- Changes to the un-built source found under `src/`
- The built changes found under `build/`

The build step is, from the root of the tree:
```
./mach npm --prefix=browser/components/companion/services/workshop run build
```

If things work, you'll see only something like the following after ~1.25 seconds.
```
> gaia-email-libs-and-more@1.0.0 build MOZILLA-ROOT/browser/components/companion/services/workshop
> node ./esbuild.js
```

If something has broken the build, you will see the above plus a bunch of
errors.

#### Setting up to Build Things



```
./mach npm install --prefix=browser/components/companion/services/workshop
```
