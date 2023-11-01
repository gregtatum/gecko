/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests translating, and then immediately translating to a new language.
 */
add_task(async function test_translations_panel_retry() {
  console.log(
    `!!! START------------------------------------------------------------------test_translations_panel_retry`
  );
  console.log(`!!! loadTestPage SPANISH_PAGE_URL before`);
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });
  console.log(`!!! loadTestPage SPANISH_PAGE_URL after`);

  console.log(
    `!!! await assertTranslationsButton({ button: true }, "The button is available."); before`
  );
  await assertTranslationsButton({ button: true }, "The button is available.");
  console.log(
    `!!! await assertTranslationsButton({ button: true }, "The button is available."); after`
  );

  console.log(`!!! await assertPageIsUntranslated(runInPage); before`);
  await assertPageIsUntranslated(runInPage);
  console.log(`!!! await assertPageIsUntranslated(runInPage); after`);

  console.log(
    `!!! await openTranslationsPanel({ onOpenPanel: assertPanelDefaultView }); before`
  );
  await openTranslationsPanel({ onOpenPanel: assertPanelDefaultView });
  console.log(
    `!!! await openTranslationsPanel({ onOpenPanel: assertPanelDefaultView }); after`
  );

  console.log(`!!! clickTranslateButton before`);
  await clickTranslateButton({
    downloadHandler: resolveDownloads,
  });
  console.log(`!!! clickTranslateButton after`);

  console.log(
    `!!! await assertPageIsTranslated("es", "en", runInPage); before`
  );
  await assertPageIsTranslated("es", "en", runInPage);
  console.log(`!!! await assertPageIsTranslated("es", "en", runInPage); after`);

  console.log(
    `!!! await openTranslationsPanel({ onOpenPanel: assertPanelRevisitView }); before`
  );
  await openTranslationsPanel({ onOpenPanel: assertPanelRevisitView });
  console.log(
    `!!! await openTranslationsPanel({ onOpenPanel: assertPanelRevisitView }); after`
  );

  console.log(`!!! switchSelectedToLanguage("fr"); before`);
  switchSelectedToLanguage("fr");
  console.log(`!!! switchSelectedToLanguage("fr"); after`);

  console.log(`!!! clickTranslateButton before`);
  await clickTranslateButton({
    downloadHandler: resolveDownloads,
    pivotTranslation: true,
  });
  console.log(`!!! clickTranslateButton after`);

  console.log(
    `!!! await assertPageIsTranslated("es", "fr", runInPage); before`
  );
  await assertPageIsTranslated("es", "fr", runInPage);
  console.log(`!!! await assertPageIsTranslated("es", "fr", runInPage); after`);

  console.log(`!!! cleanup`);
  await cleanup();
  console.log(
    `!!! END------------------------------------------------------------------test_translations_panel_retry`
  );
});
