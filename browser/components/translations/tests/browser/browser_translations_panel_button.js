/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test that the translations button is correctly visible when navigating between pages.
 */
add_task(async function test_button_visible_navigation() {
  console.log(
    `!!! 1 TEST START ----------------------------------------------------------------------test_button_visible_navigation`
  );
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  console.log(
    `!!! 1 "The button should be visible since the page can be translated from Spanish." before`
  );
  await assertTranslationsButton(
    { button: true },
    "The button should be visible since the page can be translated from Spanish."
  );
  console.log(
    `!!! 1 "The button should be visible since the page can be translated from Spanish." after`
  );

  console.log(
    `!!! 1 await navigate("Navigate to an English page.", { url: ENGLISH_PAGE_URL }); before`
  );
  await navigate("Navigate to an English page.", { url: ENGLISH_PAGE_URL });
  console.log(
    `!!! 1 await navigate("Navigate to an English page.", { url: ENGLISH_PAGE_URL }); after`
  );

  console.log(
    `!!! 1 "The button should be invisible since the page is in English." before`
  );
  await assertTranslationsButton(
    { button: false },
    "The button should be invisible since the page is in English."
  );
  console.log(
    `!!! 1 "The button should be invisible since the page is in English." after`
  );

  console.log(
    `!!! 1 await navigate("Navigate back to a Spanish page.", { url: SPANISH_PAGE_URL }); before`
  );
  await navigate("Navigate back to a Spanish page.", { url: SPANISH_PAGE_URL });
  console.log(
    `!!! 1 await navigate("Navigate back to a Spanish page.", { url: SPANISH_PAGE_URL }); after`
  );

  console.log(
    `!!! 1 "The button should be visible again since the page is in Spanish." before`
  );
  await assertTranslationsButton(
    { button: true },
    "The button should be visible again since the page is in Spanish."
  );
  console.log(
    `!!! 1 "The button should be visible again since the page is in Spanish." after`
  );

  await cleanup();
  console.log(
    `!!! 1 TEST COMPLETE ----------------------------------------------------------------------test_button_visible_navigation`
  );
});

/**
 * Test that the translations button is correctly visible when opening and switch tabs.
 */
add_task(async function test_button_visible() {
  console.log(
    `!!! 2 TEST START ----------------------------------------------------------------------test_button_visible`
  );
  const { cleanup, tab: spanishTab } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  console.log(
    `!!! 2 "The button should be visible since the page can be translated from Spanish." before`
  );
  await assertTranslationsButton(
    { button: true },
    "The button should be visible since the page can be translated from Spanish."
  );
  console.log(
    `!!! 2 "The button should be visible since the page can be translated from Spanish." after`
  );

  console.log(`!!! 2 "Creating a new tab for a page in English." before`);
  const { removeTab, tab: englishTab } = await addTab(
    ENGLISH_PAGE_URL,
    "Creating a new tab for a page in English."
  );
  console.log(`!!! 2 "Creating a new tab for a page in English." after`);

  console.log(
    `!!! 2 "The button should be invisible since the tab is in English." before`
  );
  await assertTranslationsButton(
    { button: false },
    "The button should be invisible since the tab is in English."
  );
  console.log(
    `!!! 2 "The button should be invisible since the tab is in English." after`
  );

  console.log(`!!! 2 await switchTab(spanishTab, "spanish tab"); before`);
  await switchTab(spanishTab, "spanish tab");
  console.log(`!!! 2 await switchTab(spanishTab, "spanish tab"); after`);

  console.log(
    `!!! 2 "The button should be visible again since the page is in Spanish." before`
  );
  await assertTranslationsButton(
    { button: true },
    "The button should be visible again since the page is in Spanish."
  );
  console.log(
    `!!! 2 "The button should be visible again since the page is in Spanish." after`
  );

  console.log(`!!! 2 await switchTab(englishTab, "english tab"); before`);
  await switchTab(englishTab, "english tab");
  console.log(`!!! 2 await switchTab(englishTab, "english tab"); after`);

  console.log(`!!! 2 "Don't show for english pages" before`);
  await assertTranslationsButton(
    { button: false },
    "Don't show for english pages"
  );
  console.log(`!!! 2 "Don't show for english pages" after`);
  console.log(
    `!!! 2 TEST COMPLETE----------------------------------------------------------------------test_button_visible`
  );

  await removeTab();
  await cleanup();
});
