/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Similar to lit_glue.js, this file exists to import and re-export the
 * workshopAPI from an awkward absolute path in the tree to map it into a more
 * straightforward relative path.  Import maps would help sidestep this.
 **/

import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";

export { MailAPIFactory };
