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

  useEffect(() => {
    console.log("useEffect ----------------------");
  });

  // If there is a mismatch, then Firefox can negotiate a better langpack to offer
  // the user.
  const [negotiatedLanguage, setNegotiatedLanguage] = useState(null);
  useEffect(
    function getNegotiatedLanguage() {
      console.log("useEffect getNegotiatedLanguage");
      if (!screen) {
        console.log(
          "useEffect getNegotiatedLanguage - languageMismatchScreen."
        );
        return;
      }
      const { appAndSystemLocaleInfo } = screen.content.languageSwitcher;
      console.log(
        "useEffect getNegotiatedLanguage",
        appAndSystemLocaleInfo.matchType
      );
      if (appAndSystemLocaleInfo.matchType !== "language-mismatch") {
        // There is no language mismatch, so there is no need to negotiate a langpack.
        console.log(
          "useEffect not ready for negotiatedLanguage",
          appAndSystemLocaleInfo,
          appAndSystemLocaleInfo.matchType
        );
        return;
      }

      console.log("useEffect getNegotiatedLanguage before async");
      (async () => {
        console.log("useEffect AWNegotiateLangPackForLanguageMismatch");
        const langPack = await AWNegotiateLangPackForLanguageMismatch(
          appAndSystemLocaleInfo
        );
        if (langPack) {
          // Convert the BCP 47 identifiers into the proper display names.
          // e.g. "fr-CA" -> "Canadian French".
          console.log(
            "!!!",
            appAndSystemLocaleInfo,
            appAndSystemLocaleInfo.appLocaleRaw
          );
          console.log("!!!", langPack, langPack.target_locale);
          const displayNames = new Intl.DisplayNames(
            appAndSystemLocaleInfo.appLocaleRaw,
            { type: "language" }
          );

          setNegotiatedLanguage({
            messageArgs: {
              systemLanguage: displayNames.of(
                appAndSystemLocaleInfo.systemLocale.baseName
              ),
              appLanguage: displayNames.of(
                appAndSystemLocaleInfo.appLocale.baseName
              ),
              negotiatedLanguage: displayNames.of(langPack.target_locale),
            },
            langPack,
            requestSystemLocales: [
              langPack.target_locale,
              appAndSystemLocaleInfo.appLocaleRaw,
            ],
          });
        }
      })();
    },
    [screen]
  );

  // // Only allow this screen to show up when there is a language mismatch.
  // const [prevScreenIndex, setPrevScreenIndex] = useState(screenIndex);
  // useEffect(
  //   function adjustScreenIndex() {
  //     let nextScreenIndex = screenIndex;
  //     if (
  //       shouldHideLanguageSwitcher &&
  //       nextScreenIndex === languageMismatchScreenIndex
  //     ) {
  //       const direction = screenIndex - prevScreenIndex >= 0 ? 1 : -1;
  //       nextScreenIndex = screenIndex + direction;
  //       console.log("!!!", { screenIndex, prevScreenIndex, nextScreenIndex });
  //       setScreenIndex(nextScreenIndex);
  //     }
  //     setPrevScreenIndex(nextScreenIndex);
  //   },
  //   [screenIndex, appAndSystemLocaleInfo]
  // );

  // "before-installation"
  // "installing"
  // "installed"
  // "installation-error"
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
      console.log("useEffect AWEnsureLangPackInstalled 'installing'");
      AWEnsureLangPackInstalled(negotiatedLanguage.langPack).then(
        () => {
          console.log("useEffect AWEnsureLangPackInstalled 'installed'");
          setLangPackInstallPhase("installed");
        },
        error => {
          console.error(error);
          console.log(
            "useEffect AWEnsureLangPackInstalled 'installation-error'"
          );
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
      console.log("useEffect AWSetRequestedLocales");
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
  const withMessageArgs = obj => ({
    ...obj,
    args: negotiatedLanguage?.messageArgs,
  });

  if (isAwaitingLangpack && langPackInstallPhase !== "installed") {
    return (
      <div>
        <Localized text={withMessageArgs(content.languageSwitcher.downloading)}>
          <div></div>
        </Localized>
        <div>
          <Localized text={content.languageSwitcher.cancel}>
            <button
              type="button"
              onClick={() => {
                setIsAwaitingLangpack(false);
              }}
            />
          </Localized>
        </div>
      </div>
    );
  }

  return (
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
  );
}
