# Vendoring helpers for lit

The companion uses [`lit`](https://lit.dev/) for development of some
components. This folder contains helpers for vendoring `lit` into the tree.

## How vendoring works

This folder contains the package.json file for pulling down `lit` and bundling
it in development mode (unminified) using `rollup`. The index.js file is
exported to lit.all.js in this folder and then copied to
browser/components/companion/content/lit.all.js.

There is some patching that is done automatically, and it's explained at the
end of the README.

## How to update the lit bundle

1. Update the package.json or use `npm` to set the version of `lit` you'd like
  to use.
2. Ensure index.js is exporting the things you'd like to export.
3. Run the vendor helpers:
  * `cd browser/components/companion/vendor/lit` - get to this folder
  * `../../../../../mach npm run vendor` - install, bundle, patch, copy into place
  * One-liner: `pushd browser/components/companion/vendor/lit && ../../../../../mach npm run vendor && popd`
4. Commit your changes, this should just modify package.json, index.js and
  browser/components/companion/content/lit.all.js.

## Manually patching lit.all.js

The `lit-html` module has a usage of `innerHTML` which gets sanitized and ends
up breaking `lit-html`.

To work around this, we use `DOMParser.prototype.parseFromString()` instead.

In the bundled lit.all.js file find the `static createElement(html, _options)`
method and replace it with this one:

```
    static createElement(html, _options) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<template>${html}</template>`,
            "text/html"
        );
        return document.importNode(doc.querySelector("template"), true);
    }
```
