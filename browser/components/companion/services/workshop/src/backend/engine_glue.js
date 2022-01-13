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

/**
 * The home for all engine abstractions; if you add a new account type or engine
 * then this is ideally the only place it gets added.  Some changes may happen
 * in the future to define these all as optional extensions that the app_logic
 * gets to decide on.  This module provides a means of requiring/loading the
 * givenengine modules on demand, as well as providing metadata about engines.
 *
 **/

/**
 * Maps account types to their configurator module id.  It's assumed that the
 * module requiring them is under ./tasks.
 */
export const configuratorModules = new Map([
  [
    "feed",
    async function() {
      const mod = await import("./accounts/feed/configurator");
      return mod.default;
    },
  ],
  [
    "gapi",
    async function() {
      const mod = await import("./accounts/gapi/configurator");
      return mod.default;
    },
  ],
  [
    "mapi",
    async function() {
      const mod = await import("./accounts/mapi/configurator");
      return mod.default;
    },
  ],
  /*
     [
     "phabricator",
     async function() {
     const mod = await import("./accounts/phabricator/configurator");
     return mod.default;
     },
     ],
     [
     "bugzilla",
     async function() {
     const mod = await import("./accounts/bugzilla/configurator");
     return mod.default;
     },
     ],
   */
  [
    "ical",
    async function() {
      const mod = await import("./accounts/ical/configurator");
      return mod.default;
    },
  ],
]);

/**
 * Maps account types to their validator module id.  It's assumed that the
 * module requiring them is under ./tasks.
 */
export const validatorModules = new Map([
  [
    "feed",
    async function() {
      const mod = await import("./accounts/feed/validator");
      return mod.default;
    },
  ],
  [
    "gapi",
    async function() {
      const mod = await import("./accounts/gapi/validator");
      return mod.default;
    },
  ],
  [
    "mapi",
    async function() {
      const mod = await import("./accounts/mapi/validator");
      return mod.default;
    },
  ],
  /*
     [
     "phabricator",
     async function() {
     const mod = await import("./accounts/phabricator/validator");
     return mod.default;
     },
     ],
     [
     "bugzilla",
     async function() {
     const mod = await import("./accounts/bugzilla/validator");
     return mod.default;
     },
     ],
   */
  [
    "ical",
    async function() {
      const mod = await import("./accounts/ical/validator");
      return mod.default;
    },
  ],
]);

/**
 * Maps account types to their account module id.  It's assumed that the
 * module requiring them is ./universe/account_manager.
 */
export const accountModules = new Map([
  [
    "feed",
    async function() {
      const mod = await import("./accounts/feed/account");
      return mod.default;
    },
  ],
  [
    "gapi",
    async function() {
      const mod = await import("./accounts/gapi/account");
      return mod.default;
    },
  ],
  [
    "mapi",
    async function() {
      const mod = await import("./accounts/mapi/account");
      return mod.default;
    },
  ],
  /*
     [
     "phabricator",
     async function() {
     const mod = await import("./accounts/phabricator/account");
     return mod.default;
     },
     ],
     [
     "bugzilla",
     async function() {
     const mod = await import("./accounts/bugzilla/account");
     return mod.default;
     },
     ],
   */
  [
    "ical",
    async function() {
      const mod = await import("./accounts/ical/account");
      return mod.default;
    },
  ],
]);

/**
 * Maps engine id's to their task module id.  It's assumed that the module
 * requiring them is ./universe/account_manager, or something equally nested.
 */
export const engineTaskMappings = new Map([
  [
    "feed",
    async function() {
      const mod = await import("./accounts/feed/feed_tasks");
      return mod.default;
    },
  ],
  [
    "gapi",
    async function() {
      const mod = await import("./accounts/gapi/gapi_tasks");
      return mod.default;
    },
  ],
  [
    "mapi",
    async function() {
      const mod = await import("./accounts/mapi/mapi_tasks");
      return mod.default;
    },
  ],
  /*
     [
     "phabricator",
     async function() {
     const mod = await import("./accounts/phabricator/phabricator_tasks");
     return mod.default;
     },
     ],
     [
     "bugzilla",
     async function() {
     const mod = await import("./accounts/bugzilla/bugzilla_tasks");
     return mod.default;
     },
     ],
   */
  [
    "ical",
    async function() {
      const mod = await import("./accounts/ical/ical_tasks");
      return mod.default;
    },
  ],
]);

/**
 * In those cases where there's something that we need to hack because of
 * current engine limitations, put it here.  All the guilt in one place.
 */
export const engineHacks = new Map([
  [
    "feed",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
  [
    "gapi",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
  [
    "mapi",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
  /*
     [
     "phabricator",
     {
     unselectableFolderTypes: new Set(),
     },
     ],
     [
     "bugzilla",
     {
     unselectableFolderTypes: new Set(),
     },
     ],
   */
  [
    "ical",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
]);

/**
 * Maps engine id's to metadata about engines for use by the back-end.
 * Exposed by AccountManager.getAccountEngineFacts(accountId), but you could
 * also access it directly yourself.
 *
 * While it looks like there's a lot of overlap/duplication with
 * engineFrontEndAccountMeta and engineFrontEndFolderMeta, and there is, it's
 * desirable to avoid overloading any of these.  Also, we can safely be more
 * cavalier in our naming for the back-end since it's all internal API.
 */
export const engineBackEndFacts = new Map([
  [
    "feed",
    {
      syncGranularity: "account",
    },
  ],
  [
    "gapi",
    {
      syncGranularity: "folder",
    },
  ],
  [
    "mapi",
    {
      syncGranularity: "folder",
    },
  ],
  /*
     [
     "phabricator",
     {
     syncGranularity: "account",
     },
     ],
     [
     "bugzilla",
     {
     syncGranularity: "account",
     },
     ],
   */
  [
    "ical",
    {
      syncGranularity: "account",
    },
  ],
]);

/**
 * Maps engine id's to metadata about engines to tell the front-end by
 * annotating stuff onto the account wire rep.  This was brought into
 * existence for syncGranularity purposes, but the idea is that anything that
 * varies on an account/engine basis should go in here.  This allows new
 * useful info to be added without requiring the front-end to have its own
 * hardcoded assumptions or us to stick it in the account defs and migrate the
 * accounts, etc.
 *
 * The keys are engine id's, the values are Objects that are mixed into the
 * returned account info sent via the AccountsTOC.  In general I suggest we
 * try and cluster things into things like `engineFacts`.
 */
export const engineFrontEndAccountMeta = new Map([
  [
    "feed",
    {
      engineFacts: {
        syncGranularity: "account",
      },
      usesArchiveMetaphor: false,
    },
  ],
  [
    "gapi",
    {
      engineFacts: {
        syncGranularity: "folder",
        oauth: {
          scopes: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/calendar.events.readonly",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            "https://www.googleapis.com/auth/documents.readonly",
          ],
        },
      },
      usesArchiveMetaphor: true,
    },
  ],
  [
    "mapi",
    {
      engineFacts: {
        syncGranularity: "folder",
        oauth: {
          scopes: [
            "offline_access",
            "https://graph.microsoft.com/Calendars.Read",
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/User.Read",
          ],
        },
      },
      usesArchiveMetaphor: true,
    },
  ],
  /*
     [
     "phabricator",
     {
     engineFacts: {
     syncGranularity: "account",
     },
     usesArchiveMetaphor: false,
     },
     ],
     [
     "bugzilla",
     {
     engineFacts: {
     syncGranularity: "account",
     },
     usesArchiveMetaphor: false,
     },
     ],
   */
  [
    "ical",
    {
      engineFacts: {
        syncGranularity: "account",
      },
      usesArchiveMetaphor: false,
    },
  ],
]);

/**
 * Maps engine id's to metadata about engines to tell the front-end by
 * annotating stuff onto account-owned folder reps.  Same deal as
 * `engineFrontEndAccountMeta` but for folders, basically.
 *
 * Note that we currently do not wrap things under anything like `engineFacts`
 * because we want to let folders generally be engine-agnostic.  (While
 * the engine is a huge aspect of what an account is, and the account wire
 * rep is already a big soupy mess of stuff.)
 */
export const engineFrontEndFolderMeta = new Map([
  [
    "feed",
    {
      syncGranularity: "account",
    },
  ],
  [
    "gapi",
    {
      syncGranularity: "folder",
    },
  ],
  [
    "mapi",
    {
      syncGranularity: "folder",
    },
  ],
  /*
     [
     "phabricator",
     {
     syncGranularity: "account",
     },
     ],
     [
     "bugzilla",
     {
     syncGranularity: "account",
     },
     ],
   */
  [
    "ical",
    {
      syncGranularity: "account",
    },
  ],
]);
