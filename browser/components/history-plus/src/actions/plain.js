/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * Note that the plain actions require the "type const" line so that the "type"
 * property is interpretated as a string literal, and not the "string" type.
 *
 * https://stackoverflow.com/questions/64559624/jsdoc-equivalent-to-typescripts-as-const
 */

/**
 * @param {string} site
 */
export function addSiteToSearchString(site) {
  return {
    type: /** @type {const} */ ("add-site-to-search-string"),
    site,
  };
}
