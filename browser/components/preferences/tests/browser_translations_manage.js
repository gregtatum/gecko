/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { RemoteSettings } = ChromeUtils.import(
  "resource://services-settings/remote-settings.js"
);

/**
 * Creates a local RemoteSettingsClient for use within tests.
 *
 * @param {string} mockedKey
 * @returns {RemoteSettingsClient}
 */
async function createRemoteSettingsClient(mockedKey) {
  const client = RemoteSettings(mockedKey);
  await client.db.clear();
  await client.db.importChanges({}, Date.now());
  return client;
}

async function setup(languagePairs) {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Enabled by default.
      ["browser.translations.enable", true],
      ["browser.translations.logLevel", "All"],
    ],
  });
  TranslationsParent.mockLanguagePairs(languagePairs);
  let client = await createRemoteSettingsClient("test_translations_manage");
  TranslationsParent.mockRemoteSettingsClient(client);

  await openPreferencesViaOpenPreferencesAPI("general", { leaveOpen: true });

  let doc = gBrowser.selectedBrowser.contentDocument;

  const rows = await TestUtils.waitForCondition(() => {
    const elements = doc.querySelectorAll(".translations-manage-language");
    if (elements.length !== 3) {
      return false;
    }
    return elements;
  });

  const [downloadAllRow, frenchRow, spanishRow] = rows;

  const downloadAllLabel = downloadAllRow.querySelector("label");
  const downloadAll = downloadAllRow.querySelector(
    "#translations-manage-install-all"
  );
  const deleteAll = downloadAllRow.querySelector(
    "#translations-manage-delete-all"
  );
  const frenchLabel = frenchRow.querySelector("label");
  const frenchDownload = frenchRow.querySelector(
    `[data-l10n-id="translations-manage-download-button"]`
  );
  const frenchDelete = frenchRow.querySelector(
    `[data-l10n-id="translations-manage-delete-button"]`
  );
  const spanishLabel = spanishRow.querySelector("label");
  const spanishDownload = spanishRow.querySelector(
    `[data-l10n-id="translations-manage-download-button"]`
  );
  const spanishDelete = spanishRow.querySelector(
    `[data-l10n-id="translations-manage-delete-button"]`
  );

  async function assertVisibility({ message, visible, hidden }) {
    info(message);
    try {
      // First wait for the condition to be met.
      await TestUtils.waitForCondition(() => {
        for (const element of Object.values(visible)) {
          if (element.hidden) {
            return false;
          }
        }
        for (const element of Object.values(hidden)) {
          if (!element.hidden) {
            return false;
          }
        }
        return true;
      });
    } catch (error) {
      // Ignore, this will get caught below.
    }
    // Now report the conditions.
    for (const [name, element] of Object.entries(visible)) {
      ok(!element.hidden, `${name} is visible.`);
    }
    for (const [name, element] of Object.entries(hidden)) {
      ok(element.hidden, `${name} is hidden.`);
    }
  }

  function click(button, message) {
    info(message);
    if (button.hidden) {
      throw new Error("The button was hidden when trying to click it.");
    }
    button.click();
  }

  return {
    click,
    assertVisibility,
    downloadAllLabel,
    downloadAll,
    deleteAll,
    frenchLabel,
    frenchDownload,
    frenchDelete,
    spanishLabel,
    spanishDownload,
    spanishDelete,
  };
}

async function cleanup() {
  gBrowser.removeCurrentTab();
  TranslationsParent.mockLanguagePairs(null);
  await SpecialPowers.popPrefEnv();
}

// TODO REMOVE ME
requestLongerTimeout(100);

add_task(async function test_TODO() {
  const {
    assertVisibility,
    click,
    // Elements:
    downloadAllLabel,
    downloadAll,
    deleteAll,
    frenchLabel,
    frenchDownload,
    frenchDelete,
    spanishLabel,
    spanishDownload,
    spanishDelete,
  } = await setup([
    { fromLang: "en", toLang: "fr" },
    { fromLang: "fr", toLang: "en" },
    { fromLang: "en", toLang: "es" },
    { fromLang: "es", toLang: "en" },
  ]);

  is(
    downloadAllLabel.getAttribute("data-l10n-id"),
    "translations-manage-all-language",
    "The first row is all of the languages."
  );
  is(frenchLabel.textContent, "French", "There is a French row.");
  is(spanishLabel.textContent, "Spanish", "There is a Spanish row.");

  info(
    "When language pairs are mocked, the languages are assumed to be downloaded."
  );
  click(deleteAll, "Deleting all languages.");

  await assertVisibility({
    message: "Everything starts out as available to download",
    visible: { downloadAll, frenchDownload, spanishDownload },
    hidden: { deleteAll, frenchDelete, spanishDelete },
  });

  click(frenchDownload, "Downloading French");

  await assertVisibility({
    message: "French can now be deleted, and delete all is available.",
    visible: { downloadAll, deleteAll, frenchDelete, spanishDownload },
    hidden: { frenchDownload, spanishDelete },
  });

  click(frenchDelete, "Deleting French");

  await assertVisibility({
    message: "Everything can be downloaded.",
    visible: { downloadAll, frenchDownload, spanishDownload },
    hidden: { deleteAll, frenchDelete, spanishDelete },
  });

  click(downloadAll, "Downloading all languages.");

  await assertVisibility({
    message: "Everything can be deleted.",
    visible: { deleteAll, frenchDelete, spanishDelete },
    hidden: { downloadAll, frenchDownload, spanishDownload },
  });

  click(deleteAll, "Deleting all languages.");

  await assertVisibility({
    message: "Everything can be downloaded again",
    visible: { downloadAll, frenchDownload, spanishDownload },
    hidden: { deleteAll, frenchDelete, spanishDelete },
  });

  click(frenchDownload, "Downloading French.");
  click(spanishDownload, "Downloading Spanish.");

  await assertVisibility({
    message: "Everything is downloaded again.",
    visible: { deleteAll, frenchDelete, spanishDelete },
    hidden: { downloadAll, frenchDownload, spanishDownload },
  });

  return cleanup();
});
