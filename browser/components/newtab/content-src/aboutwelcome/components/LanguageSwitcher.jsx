/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useState, useEffect } from "react";
import { Localized } from "./MSLocalized";

export function LanguageSwitcher(props) {
  const { content, langPackInstalled, navigate } = props;

  /**
   * @type {"installing" | "installed" | "error"}
   */
  const [langPackState, setLangpackState] = useState("installing");
  // Determine the status of the langpack installation.
  useEffect(async () => {
    try {
      await langPackInstalled;
      setLangpackState("installed");
    } catch (error) {
      console.error("Failed to install langpack.", error);
      setLangpackState("error");
    }
  }, []);

  const [isAwaitingLangpack, setIsAwaitingLangpack] = useState(false);

  // Determine the status of the langpack installation.
  useEffect(() => {
    if (isAwaitingLangpack && langPackState !== "installing") {
      AWSetRequestedLocales(content.tiles.requestSystemLocales);
      requestAnimationFrame(() => {
        navigate()
      });
    }
  }, [isAwaitingLangpack, langPackState]);

  return isAwaitingLangpack ? (
    <div>
      <div>
        Downloading the language pack…
      </div>
      <div>
        <button
          type="button"
          onClick={() => {
            setIsAwaitingLangpack(false);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <div>
      <Localized text={content.tiles.label}>
        <button
          className="primary"
          value="primary_button"
          onClick={() => {
            setIsAwaitingLangpack(true);
          }}
        />
      </Localized>
    </div>
  );
}
