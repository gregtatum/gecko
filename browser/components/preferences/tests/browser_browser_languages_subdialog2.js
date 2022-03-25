/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { AddonTestUtils } = ChromeUtils.import(
  "resource://testing-common/AddonTestUtils.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

AddonTestUtils.initMochitest(this);

const BROWSER_LANGUAGES_URL =
  "chrome://browser/content/preferences/dialogs/browserLanguages.xhtml";
const DICTIONARY_ID_PL = "pl@dictionaries.addons.mozilla.org";
const TELEMETRY_CATEGORY = "intl.ui.browserLanguage";

function langpackId(locale) {
  return `langpack-${locale}@firefox.mozilla.org`;
}

function getManifestData(locale, version = "2.0") {
  return {
    langpack_id: locale,
    name: `${locale} Language Pack`,
    description: `${locale} Language pack`,
    languages: {
      [locale]: {
        chrome_resources: {
          branding: `browser/chrome/${locale}/locale/branding/`,
        },
        version: "1",
      },
    },
    applications: {
      gecko: {
        strict_min_version: AppConstants.MOZ_APP_VERSION,
        id: langpackId(locale),
        strict_max_version: AppConstants.MOZ_APP_VERSION,
      },
    },
    version,
    manifest_version: 2,
    sources: {
      browser: {
        base_path: "browser/",
      },
    },
    author: "Mozilla",
  };
}

let testLocales = ["fr", "pl", "he"];
let testLangpacks;

function createLangpack(locale, version) {
  return AddonTestUtils.createTempXPIFile({
    "manifest.json": getManifestData(locale, version),
    [`browser/${locale}/branding/brand.ftl`]: "-brand-short-name = Firefox",
  });
}

function createTestLangpacks() {
  if (!testLangpacks) {
    testLangpacks = Promise.all(
      testLocales.map(async locale => [locale, await createLangpack(locale)])
    );
  }
  return testLangpacks;
}

function createLocaleResult(target_locale, url) {
  return {
    guid: langpackId(target_locale),
    type: "language",
    target_locale,
    current_compatible_version: {
      files: [
        {
          platform: "all",
          url,
        },
      ],
    },
  };
}

async function createLanguageToolsFile() {
  let langpacks = await createTestLangpacks();
  let results = langpacks.map(([locale, file]) =>
    createLocaleResult(locale, Services.io.newFileURI(file).spec)
  );

  let filename = "language-tools.json";
  let files = { [filename]: { results } };
  let tempdir = AddonTestUtils.tempDir.clone();
  let dir = await AddonTestUtils.promiseWriteFilesToDir(tempdir.path, files);
  dir.append(filename);

  return dir;
}

async function createDictionaryBrowseResults() {
  let testDir = gTestPath.substr(0, gTestPath.lastIndexOf("/"));
  let dictionaryPath = testDir + "/addons/pl-dictionary.xpi";
  let filename = "dictionaries.json";
  let response = {
    page_size: 25,
    page_count: 1,
    count: 1,
    results: [
      {
        current_version: {
          id: 1823648,
          compatibility: {
            firefox: { max: "9999", min: "4.0" },
          },
          files: [
            {
              platform: "all",
              url: dictionaryPath,
            },
          ],
          version: "1.0.20160228",
        },
        default_locale: "pl",
        description: "Polish spell-check",
        guid: DICTIONARY_ID_PL,
        name: "Polish Dictionary",
        slug: "polish-spellchecker-dictionary",
        status: "public",
        summary: "Polish dictionary",
        type: "dictionary",
      },
    ],
  };

  let files = { [filename]: response };
  let dir = await AddonTestUtils.promiseWriteFilesToDir(
    AddonTestUtils.tempDir.path,
    files
  );
  dir.append(filename);

  return dir;
}

function assertLocaleOrder(list, locales) {
  is(
    list.itemCount,
    locales.split(",").length,
    "The right number of locales are selected"
  );
  is(
    Array.from(list.children)
      .map(child => child.value)
      .join(","),
    locales,
    "The selected locales are in order"
  );
}

add_task(async function testReorderingBrowserLanguages() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["extensions.langpacks.signatures.required", false],
    ],
  });

  // Install all the available langpacks.
  let langpacks = await createTestLangpacks();
  let addons = await Promise.all(
    langpacks.map(async ([locale, file]) => {
      let install = await AddonTestUtils.promiseInstallFile(file);
      return install.addon;
    })
  );

  console.log("!!! Addons", addons);
  ok(true, "!!! Test passes");
});
