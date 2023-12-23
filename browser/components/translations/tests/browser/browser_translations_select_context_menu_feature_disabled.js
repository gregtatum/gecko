/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// This file ensures that the translate selection menu item is unavailable when Select Translations is disabled.
// This file will be removed when the feature is released, as the pref will no longer exist.
// However, for the time being, I like having these tests to ensure there is no regression.

/**
 * This test checks the availability of the translate-selection menu item in the context menu,
 * ensuring it is not visible when the "browser.translations.select.enable" preference is set to false
 * and no text is selected when the context menu is invoked.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_with_feature_disabled_and_no_text_selected() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", false]],
    });

    await assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await assertPageIsUntranslated(runInPage);

    await assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishParagraph: false,
        openAtSpanishParagraph: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when the feature is disabled."
    );

    await cleanup();
  }
);
