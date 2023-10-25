/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Manually destroy the engine while a page is in the background, and test that the page
 * is still translated after switching back to it.
 */
add_task(async function test_translations_engine_destroy_pending() {
  const {
    cleanup,
    resolveDownloads,
    runInPage: runInSpanishPage,
    tab: spanishTab,
  } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  /**
   * @typedef {object} Tab
   */

  /** @type {Tab?} */
  let englishTab;
  /** @type {Function?} */
  let removeEnglishTab;
  /** @type {boolean} */
  let isSpanishPageTranslated = false;
  /** @type {"spanish" | "english"} */
  let activeTab = "spanish";
  /** @type {boolean} */
  let isEngineDestroyed = true;
  /** @type {boolean} */
  let isTitleMutated = false;

  function reportOperation(name) {
    info(
      `Operation: ${name} ` +
        JSON.stringify({
          englishTab: !!englishTab,
          isSpanishPageTranslated,
          activeTab,
          isEngineDestroyed,
          isTitleMutated,
        })
    );
  }

  /**
   * A list of fuzzing operations. They return false when they are a noop given the
   * conditions.
   *
   * @type {Record<string, () => Promise<boolean>>}
   */
  const operations = {
    async addEnglishTab() {
      if (!englishTab) {
        reportOperation("addEnglishTab");
        const { removeTab, tab } = await addTab(
          ENGLISH_PAGE_URL,
          "Creating a new tab for a page in English."
        );

        englishTab = removeTab;
        removeEnglishTab = tab;
        return true;
      }
      return false;
    },

    async removeEnglishTab() {
      if (removeEnglishTab) {
        reportOperation("removeEnglishTab");
        await removeEnglishTab();

        englishTab = null;
        removeEnglishTab = null;
        return true;
      }
      return false;
    },

    async translateSpanishPage() {
      if (!isSpanishPageTranslated) {
        reportOperation("translateSpanishPage");
        await switchTab(spanishTab, "spanish tab");
        await assertTranslationsButton(
          { button: true },
          "The button is available."
        );
        await openTranslationsPanel({ onOpenPanel: assertPanelDefaultView });

        await clickTranslateButton({
          downloadHandler: resolveDownloads,
        });

        await assertPageIsTranslated("es", "en", runInSpanishPage);

        isSpanishPageTranslated = true;
        isEngineDestroyed = false;
        return true;
      }
      return false;
    },

    async destroyEngineProcess() {
      if (!isEngineDestroyed) {
        info("Destroy the engine process");
        await TranslationsParent.destroyEngineProcess();
        isEngineDestroyed = true;
      }
      return true;
    },

    async mutateSpanishPage() {
      if (isSpanishPageTranslated && !isTitleMutated) {
        reportOperation("mutateSpanishPage");

        info("Mutate the page's content to re-trigger a translation.");
        await runInSpanishPage(async TranslationsTest => {
          const { getH1 } = TranslationsTest.getSelectors();
          getH1().innerText = "New text for the H1";
        });

        if (isEngineDestroyed) {
          info("The engine downloads should be requested again.");
          resolveDownloads(1);
        }

        info("Wait for a second to ensure the mutation takes.");
        await TestUtils.waitForTick();

        await runInSpanishPage(async TranslationsTest => {
          const { getH1 } = TranslationsTest.getSelectors();
          await TranslationsTest.assertTranslationResult(
            "The mutated content should be translated.",
            getH1,
            "NEW TEXT FOR THE H1 [es to en]"
          );
        });

        isEngineDestroyed = false;
        isTitleMutated = false;
        return true;
      }
      return false;
    },

    async switchToSpanishTab() {
      if (activeTab !== "spanish") {
        reportOperation("switchToSpanishTab");
        await switchTab(spanishTab, "spanish tab");
        activeTab = "spanish";
        return true;
      }
      return false;
    },

    async switchToEnglishTab() {
      if (activeTab !== "english") {
        reportOperation("switchToEnglishTab");
        await switchTab(englishTab, "english tab");
        activeTab = "english";
        return true;
      }
      return false;
    },

    async restoreSpanishPage() {
      if (activeTab === "spanish" && isSpanishPageTranslated) {
        reportOperation("restoreSpanishPage");
        await openTranslationsPanel({ onOpenPanel: assertPanelRevisitView });

        await clickRestoreButton();

        await assertPageIsUntranslated(runInSpanishPage);

        await assertTranslationsButton(
          { button: true, circleArrows: false, locale: false, icon: true },
          "The button is reverted to have an icon."
        );

        isSpanishPageTranslated = false;
        isTitleMutated = false;
        return true;
      }
      return false;
    },
  };

  const fuzzSteps = 100;
  info(`Starting the fuzzing with ${fuzzSteps} operations.`);
  const opsArray = Object.values(operations);
  for (let i = 0; i < fuzzSteps; i++) {
    // Pick a random operation and check if that it was not a noop, otherwise continue
    // trying to find a valid operation.
    while (!(await opsArray[Math.random() * opsArray.length])) {}

    console.log({});
  }

  if (removeEnglishTab) {
    await removeEnglishTab();
  }
  await cleanup();
});
