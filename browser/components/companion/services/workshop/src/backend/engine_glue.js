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
 * Currently we use two type of identifiers:
 * - Account Type Strings (old, but not going away):
 *   - imap+smtp
 *   - pop3+smtp
 *   - activesync
 * - Engine Id Strings (new):
 *   - gmailImap
 *   - vanillaImap
 *   - activesync
 *   - pop3
 **/

/**
 * Maps account types to their configurator module id.  It's assumed that the
 * module requiring them is under ./tasks.
 */
export const configuratorModules = new Map([
  /*
  [
    "activesync",
    async function() {
      const mod = await import("./accounts/activesync/configurator");
      return mod.default;
    },
  ],
  */
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
  /*
  [
    "imap+smtp",
    async function() {
      const mod = await import("./accounts/composite/configurator");
      return mod.default;
    },
  ],
  [
    "pop3+smtp",
    async function() {
      const mod = await import("./accounts/composite/configurator");
      return mod.default;
    },
  ],
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
  /*
  [
    "activesync",
    async function() {
      const mod = await import("./accounts/activesync/validator");
      return mod.default;
    },
  ],
  */
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
  /*
  [
    "imap+smtp",
    async function() {
      const mod = await import("./accounts/composite/validator");
      return mod.default;
    },
  ],
  [
    "pop3+smtp",
    async function() {
      const mod = await import("./accounts/composite/validator");
      return mod.default;
    },
  ],
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
  /*
  [
    "activesync",
    async function() {
      const mod = await import("./accounts/activesync/account");
      return mod.default;
    },
  ],
  */
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
  /*
  [
    "imap+smtp",
    async function() {
      const mod = await import("./accounts/composite/account");
      return mod.default;
    },
  ],
  [
    "pop3+smtp",
    async function() {
      const mod = await import("./accounts/composite/account");
      return mod.default;
    },
  ],
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
  /*
  [
    'gmailImap',
    async function() {
      const mod = await import('./accounts/imap/gmail_tasks');
      return mod.default;
    }
  ],
  [
    'vanillaImap',
    async function() {
      const mod = await import('./accounts/imap/vanilla_tasks');
      return mod.default;
    }
  ],
  [
    "activesync",
    async function() {
      const mod = await import("./accounts/activesync/activesync_tasks");
      return mod.default;
    },
  ],
  */
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
  /*
  [
    "pop3",
    async function() {
      const mod = await import("./accounts/pop3/pop3_tasks");
      return mod.default;
    },
  ],
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
  /*
  [
    'gmailImap',
    {
      // For various reasons of things not exploding, we are disabling
      // certain folder types.  See below for details.
      unselectableFolderTypes: new Set([
        // Currently if the user ever enters the "all mail" folder, we will
        // end up synchronizing every new message the user ever receives after
        // this point.  This will turn out badly.
        'all',
        // The sync engine doesn't know how to deal with folders that aren't
        // covered by all mail (yet).
        'junk', 'trash'
      ])
    }
  ],
  [
    'vanillaImap',
    {
      unselectableFolderTypes: new Set(),
    }
  ],
  [
    "activesync",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
  */
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
  /*
  [
    "pop3",
    {
      unselectableFolderTypes: new Set(),
    },
  ],
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
  /*
  [
    'gmailImap',
    {
      syncGranularity: 'account',
    }
  ],
  [
    'vanillaImap',
    {
      syncGranularity: 'folder',
    }
  ],
  [
    "activesync",
    {
      syncGranularity: "folder",
    },
  ],
  */
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
  /*
  [
    "pop3",
    {
      syncGranularity: "folder",
    },
  ],
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
  /*
  [
    'gmailImap',
    {
      engineFacts: {
        syncGranularity: 'account',
      },
      usesArchiveMetaphor: true
    }
  ],
  [
    'vanillaImap',
    {
      engineFacts: {
        syncGranularity: 'folder',
      },
      usesArchiveMetaphor: false
    }
  ],
  [
    "activesync",
    {
      engineFacts: {
        syncGranularity: "folder",
      },
      usesArchiveMetaphor: false,
    },
  ],
  */
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
  /*
  [
    "pop3",
    {
      engineFacts: {
        // This could arguably be 'account' too, but that would hinge on us
        // having some type of local folder stuff going on.  We can of course
        // revisit this as needed.
        syncGranularity: "folder",
      },
      usesArchiveMetaphor: false,
    },
  ],
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
  /*
  [
    'gmailImap',
    {
      syncGranularity: 'account',
    }
  ],
  [
    'vanillaImap',
    {
      syncGranularity: 'folder',
    }
  ],
  [
    "activesync",
    {
      syncGranularity: "folder",
    },
  ],
  */
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
  /*
  [
    "pop3",
    {
      syncGranularity: "folder",
    },
  ],
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
