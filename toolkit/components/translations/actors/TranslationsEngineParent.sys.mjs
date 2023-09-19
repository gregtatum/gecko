/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The translations engine is in its own content process. This actor handles the
 * marshalling of the data such as the engine payload and port passing.
 */
export class TranslationsEngineParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  initialize(fromLanguage, toLanguage, enginePayload) {
    const { port1, port2 } = new MessageChannel();
    this.sendAsyncMessage("TranslationsEngine:Initialize", {
      fromLanguage,
      toLanguage,
      enginePayload,
      port1,
    });
  }
}
