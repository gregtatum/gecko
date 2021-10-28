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

import TaskDefiner from "../task_infra/task_definer";

import { makeAccountDef, makeIdentity } from "../db/account_def_rep";

import { configuratorModules, validatorModules } from "../engine_glue";

import defaultPrefs from "../default_prefs";
import { makeAccountId, makeIdentityId } from "shared/id_conversions";

/**
 * Create an account using previously retrieved autoconfig data or using
 * explicit (user-provided manual-style creation) account settings.
 *
 * During account creation, we do the following online things:
 * - Validating the account parameters
 * - Discovering the specific engine type after talking to the server to
 *   identify it.
 *
 * Then it's a simple matter of persisting that state to disk.
 *
 * # Account Id's
 *
 * The most complex issue here is the allocation of the account id.  For
 * sanity we want strictly increasing id's and we want them allocated at the
 * time of successful account creation so that mistyped passwords don't
 * result in gaps.  This necessitates storage of a counter rather than doing
 * max(existing id's)+1.
 *
 * So we continue our v1.x strategy of tracking nextAccountNum on the config
 * object.  This config object is always in-memory allowing us to use
 * atomicClobber safely as long as we are the only account_create task in flight
 * or we ensure that we do not yield control flow between our read and when
 * we finish the task, issuing the write.
 *
 *
 * # Current Account Creation Pipeline
 *
 * The following steps happen below.  These should probably be overhauled now
 * that we are not just an email client and some of the intermediary data
 * structures don't have a great reasion to exist in their current form.
 *
 * The below is an attempt to document the current behavior and some of the
 * "whys" that led to this state, but shouldn't be taken as a justification to
 * keep things this way.  The next section will be a WIP with thoughts on how
 * things might be refactored.
 *
 * ## Precondition: Autoconfiguration
 *
 * By the time we get here, we already should have run autoconfiguration which
 * traditionally figured out how to map an email address to:
 * - The type of account we'd try and create.
 * - Any server meta-information, like what domains we should actually use to
 *   talk to the server.
 * - Any authentication meta-information like what OAuth2 secrets to use, etc.
 *
 * This means that at this point we know the concrete account type we want to
 * create as provided in the `domainInfo`, which was expected to be the result
 * of the autoconfig lookup process.  The `domainInfo` was separate from the
 * `userDetails` bundle which was expected to include the inputs to autoconfig
 * (email address) and any related authentication information (password).
 *
 * ## Configuration via "Configurator"
 *
 * The configurator remixes the `userDetails` and `domainInfo` into an object
 * with the following properties which we internally call the `fragments`:
 * - credentials
 * - typeFields
 * - connInfoFields
 *
 * Because the `fragments` are all that are (currently) provided to the
 * validator, it can also make sense to include the `userDetails` in the object
 * so that the validator has access to it and can mutate the contents.
 *
 * ## Validator: Test the acccount credentials and extract account metadata
 *
 * The (async) validator receives the object returned by the (sync) configurator
 * and is expected to return an object with the following fields:
 * - error: null on success, an error object which will be reported to the front
 *   end verbatim.  This means it can be account-specific.  Previously we tried
 *   to normalize all these errors because there was a unified account creation
 *   flow, but that might not really be true anymore.
 * - engineFields: This will be put directly on the accountDef, so this is the
 *   validator's place it can put any extracted data it doesn't want to mutate
 *   on other objects placed into it.
 * - receiveProtoConn: Optional means to propagate a connection object so that
 *   when the account instance is created it receives it as an argument.  This
 *   mattered for stateful TCP protocols like IMAP where servers potentially had
 *   strict connection limits (many IMAP servers) and/or extremely high setup
 *   costs (ex: gmail IMAP) but is less relevant for REST APIs.  This could
 *   matter for websocket connections, however.
 *
 * ## Identity Creation
 *
 * Identities correspond to the email power-user situation where when responding
 * to emails you might potentially use different configurations of:
 * - sender email address
 * - sender name
 * - reply-to email address
 * - signature
 * - possibly SMTP server
 *
 * Because you could operate using these different identities, the concept of
 * an identity was extracted out of the core account.  But since you also needed
 * an identity, we would also create a default identity with the default
 * settings.
 *
 * This is probably moot for non-email account types and can be done away with
 * or made optional.
 *
 * ## accountDef creation
 *
 * The random assortment of fragments and data gets aggregated into an
 * `accountDef`, see the `makeAccountDef` call below.
 *
 * # Task Args
 * - userDetails
 * - domainInfo
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: "account_create",

    exclusiveResources() {
      return [];
    },

    priorityTags() {
      return [];
    },

    async execute(ctx, planned) {
      let { userDetails, domainInfo } = planned;
      let accountType = domainInfo.type;

      let [configurator, validator] = await Promise.all([
        configuratorModules.get(accountType)(),
        validatorModules.get(accountType)(),
      ]);

      let fragments = configurator(userDetails, domainInfo);

      let validationResult = await validator(fragments);
      // If it's an error, just return the error.
      if (validationResult.error) {
        return ctx.returnValue(validationResult);
      }

      // Allocate an id for the account now that it's a sure thing.
      let accountNum = ctx.universe.config.nextAccountNum;
      let accountId = makeAccountId(accountNum);

      // Hand-off the connection if one was returned.
      if (validationResult.receiveProtoConn) {
        ctx.universe.accountManager.stashAccountConnection(
          accountId,
          validationResult.receiveProtoConn
        );
      }

      let identity = makeIdentity({
        id: makeIdentityId(accountId, 0),
        name: userDetails.displayName,
        address: userDetails.emailAddress,
        replyTo: null,
        signature: null,
        signatureEnabled: false,
      });

      let accountDef = makeAccountDef({
        infra: {
          id: accountId,
          name: userDetails.emailAddress,
          type: accountType,
        },
        credentials: fragments.credentials,
        prefFields: defaultPrefs,
        typeFields: fragments.typeFields,
        engineFields: validationResult.engineFields,
        connInfoFields: fragments.connInfoFields,
        identities: [identity],
        kind: fragments.kind,
      });

      await ctx.finishTask({
        newData: {
          accounts: [accountDef],
        },
        atomicClobbers: {
          config: {
            nextAccountNum: accountNum + 1,
          },
        },
      });

      return ctx.returnValue({
        accountId,
        error: null,
        errorDetails: null,
      });
    },
  },
]);
