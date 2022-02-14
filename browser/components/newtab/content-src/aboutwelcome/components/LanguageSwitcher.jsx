/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useState, useEffect } from "react";
import { Localized } from "./MSLocalized";

/**
 * The language switcher implements a hook that should be placed at a higher level
 * than the actual language switcher component, as it needs to preemptively fetch
 * and install langpacks for the user.
 */
export function useLanguageSwitcher(screens, screenIndex, setScreenIndex) {
  const languageMismatchScreenIndex = screens.findIndex(
    ({ id }) => id === "AW_LANGUAGE_MISMATCH"
  );
  const screen = screens[languageMismatchScreenIndex];
  const appAndSystemLocaleInfo = screen
    ? screen.content.languageSwitcher.appAndSystemLocaleInfo
    : null;

  // If there is a mismatch, then Firefox can negotiate a better langpack to offer
  // the user.
  const [negotiatedLanguage, setNegotiatedLanguage] = useState(null);
  useEffect(
    function getNegotiatedLanguage() {
      if (!appAndSystemLocaleInfo) {
        return;
      }
      if (appAndSystemLocaleInfo.matchType !== "language-mismatch") {
        // There is no language mismatch, so there is no need to negotiate a langpack.
        return;
      }

      (async () => {
        const langPack = await AWNegotiateLangPackForLanguageMismatch(
          appAndSystemLocaleInfo
        );
        if (langPack) {
          // Convert the BCP 47 identifiers into the proper display names.
          // e.g. "fr-CA" -> "Canadian French".
          const displayNames = new Intl.DisplayNames(
            appAndSystemLocaleInfo.appLocaleRaw,
            { type: "language" }
          );

          setNegotiatedLanguage({
            displayName: displayNames.of(langPack.target_locale),
            langPack,
            requestSystemLocales: [
              langPack.target_locale,
              appAndSystemLocaleInfo.appLocaleRaw,
            ],
          });
        }
      })();
    },
    [appAndSystemLocaleInfo]
  );

  /**
   * @type {"before-installation" | "installing" | "installed" | "installation-error"}
   */
  const [langPackInstallPhase, setLangPackInstallPhase] = useState(
    "before-installation"
  );
  useEffect(
    function ensureLangPackInstalled() {
      if (!negotiatedLanguage) {
        // There are no negotiated languages to download yet.
        return;
      }
      setLangPackInstallPhase("installing");
      AWEnsureLangPackInstalled(negotiatedLanguage.langPack).then(
        () => {
          setLangPackInstallPhase("installed");
        },
        error => {
          console.error(error);
          setLangPackInstallPhase("installation-error");
        }
      );
    },
    [negotiatedLanguage]
  );

  const shouldHideLanguageSwitcher =
    screen &&
    screen?.content?.languageSwitcher?.appAndSystemLocaleInfo?.matchType !==
      "language-mismatch";

  const [languageFilteredScreens, setLanguageFilteredScreens] = useState(
    screens
  );
  useEffect(
    function filterScreen() {
      if (shouldHideLanguageSwitcher) {
        if (screenIndex > languageMismatchScreenIndex) {
          setScreenIndex(screenIndex - 1);
        }
        setLanguageFilteredScreens(
          screens.filter(screen => screen.id !== "AW_LANGUAGE_MISMATCH")
        );
      } else {
        setLanguageFilteredScreens(screens);
      }
    },
    [screens, negotiatedLanguage]
  );

  return {
    appAndSystemLocaleInfo,
    negotiatedLanguage,
    langPackInstallPhase,
    languageFilteredScreens,
    shouldHideLanguageSwitcher,
  };
}

export function languageSwitcherShouldPreload(langPackInstallPhase) {
  return langPackInstallPhase === "before-installation";
}

/**
 * The language switcher is a separate component as it needs to perform some asynchronous
 * network actions such as retrieving the list of langpacks available, and downloading
 * a new langpack. On a fast connection, this won't be noticeable, but on slow on unreliable
 * internet this may fail for a user.
 */
export function LanguageSwitcher(props) {
  const { content, negotiatedLanguage, langPackInstallPhase } = props;

  const [isAwaitingLangpack, setIsAwaitingLangpack] = useState(false);

  // Determine the status of the langpack installation.
  useEffect(() => {
    if (isAwaitingLangpack && langPackInstallPhase !== "installing") {
      AWSetRequestedLocales(negotiatedLanguage.requestSystemLocales);
      requestAnimationFrame(() => {
        props.handleAction(
          // Simulate the click event.
          { currentTarget: "primary_button" }
        );
      });
    }
  }, [isAwaitingLangpack, langPackInstallPhase]);

  // The message args are the localized language names.
  const withMessageArgs = obj => {
    const displayName = negotiatedLanguage?.displayName;
    if (displayName) {
      return {
        ...obj,
        args: {
          ...obj.args,
          negotiatedLanguage: displayName,
        },
      };
    }
    return obj;
  };

  const showWaitingScreen =
    isAwaitingLangpack && langPackInstallPhase !== "installed";
  const showPreloadingScreen = languageSwitcherShouldPreload(
    langPackInstallPhase
  );
  const showReadyScreen = !showWaitingScreen && !showPreloadingScreen;

  // Use {display: "none"} rather than if statements to prevent layout thrashing with
  // the localized text elements rendering as blank, then filling in the text.
  return (
    <>
      <div style={{ display: showPreloadingScreen ? "block" : "none" }}>
        <button
          className="primary"
          value="primary_button"
          disabled={true}
          type="button"
        >
          <img
            className="language-loader"
            src="chrome://browser/skin/tabbrowser/tab-connecting.png"
          />
          <Localized text={content.languageSwitcher.waiting} />
        </button>
        <div className="secondary-cta">
          <Localized text={content.languageSwitcher.skip}>
            <button
              type="button"
              className="secondary text-link"
              onClick={props.handleAction}
            />
          </Localized>
        </div>
      </div>
      <div style={{ display: showWaitingScreen ? "block" : "none" }}>
        <button
          className="primary"
          value="primary_button"
          disabled={true}
          type="button"
        >
          <img
            className="language-loader"
            src="chrome://browser/skin/tabbrowser/tab-connecting.png"
          />
          <Localized
            text={withMessageArgs(content.languageSwitcher.downloading)}
          />
        </button>
        <div className="secondary-cta">
          <Localized text={content.languageSwitcher.cancel}>
            <button
              type="button"
              className="secondary text-link"
              onClick={() => {
                setIsAwaitingLangpack(false);
              }}
            />
          </Localized>
        </div>
      </div>
      <div style={{ display: showReadyScreen ? "block" : "none" }}>
        <div>
          <Localized text={withMessageArgs(content.languageSwitcher.switch)}>
            <button
              className="primary"
              value="primary_button"
              onClick={() => {
                setIsAwaitingLangpack(true);
              }}
            />
          </Localized>
        </div>
        <div className="secondary-cta">
          <Localized text={content.languageSwitcher.not_now}>
            <button
              type="button"
              className="secondary text-link"
              onClick={props.handleAction}
            />
          </Localized>
        </div>
      </div>
    </>
  );
}
