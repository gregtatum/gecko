const { AddonTestUtils } = ChromeUtils.import(
  "resource://testing-common/AddonTestUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonManager: "resource://gre/modules/AddonManager.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
});

AddonTestUtils.initMochitest(this);

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

/**
 * @typedef {Object} LangpackOptions
 * @property {string} locale - BCP 47 Identifier
 * @property {string} version - The manifest version
 * @property {{ path: string, contents: string }} files - The files to write into the XPI file.
 *
 *  * Example paths (note these paths may not be up to date):
 *
 * To find specific paths download a langpack from:
 *   https://ftp.mozilla.org/pub/firefox/nightly/latest-mozilla-central-l10n/linux-x86_64/xpi/
 *
 * Here are some example paths that may or may not be up to date:
 *
 * `browser/chrome/es-ES/locale/branding/brand.properties`
 * `browser/chrome/es-ES/locale/branding/brand.dtd`
 * `browser/chrome/es-ES/locale/es-ES/devtools/client/webconsole.properties`
 * `browser/chrome/es-ES/locale/es-ES/devtools/client/webconsole.properties`
 * `browser/localization/es-ES/browser/aboutCertError.ftl`
 * `chrome/es-ES/locale/es-ES/alerts/alert.properties`
 * `chrome/es-ES/locale/pdfviewer/chrome.properties`
 * `chrome/localization/es-ES/crashreporter/aboutcrashes.ftl`
 * `chrome/localization/es-ES/toolkit/about/aboutAbout.ftl`
 *
 * Or as a quick bash script to see the contents, update the FX_VERSION and FX_LOCALE, and run:

FX_VERSION=100
FX_LOCALE=es-ES
FILE=firefox-$FX_VERSION.0a1.$FX_LOCALE.langpack
curl -0 https://ftp.mozilla.org/pub/firefox/nightly/latest-mozilla-central-l10n/linux-x86_64/xpi/$FILE.xpi --output $FILE.zip
unzip $FILE.zip -d $FILE
cd $FILE
tree

 */

/**
 * Create a test-only langpack, with actual content.
 */
function createLangpack(options) {
  const { locale, version, files } = options;
  const xpiFiles = {
    "manifest.json": getManifestData(locale, version),
  };
  for (const { path, contents } of files || []) {
    xpiFiles[path] = contents;
  }
  return AddonTestUtils.createTempXPIFile(xpiFiles);
}

requestLongerTimeout(1000);
add_task(async function toolbarButtons() {
  await SpecialPowers.pushPrefEnv({
    set: [["extensions.langpacks.signatures.required", false]],
  });

  info(`Installing the es-ES langpacks`);
  await AddonTestUtils.promiseInstallFile(
    createLangpack({
      locale: "es-ES",
      files: [
        {
          alias: "branding",
          path: "browser/chrome/es-ES/locale/branding/brand.properties",
          // Localizers don't really translate the brand name this way, but it
          // makes for a useful test.
          contents: `brandFullName=Zorro de Fuego`,
        },
        {
          alias: "branding",
          path: "browser/chrome/es-ES/locale/branding/test-only.properties",
          contents: `testOnly=Mensaje solo para pruebas`,
        },
      ],
    })
  );

  info(`Installing the fr langpacks`);
  await AddonTestUtils.promiseInstallFile(
    createLangpack({
      locale: "fr",
      files: [
        {
          alias: "branding",
          path: "browser/chrome/fr/locale/branding/brand.properties",
          // Localizers don't really translate the brand name this way, but it
          // makes for a useful test.
          contents: `brandFullName=Renard de Feu`,
        },
        {
          alias: "branding",
          path: "browser/chrome/fr/locale/branding/test-only.properties",
          contents: `testOnly=Message de test uniquement`,
        },
      ],
    })
  );

  info(`Creating the bundle "chrome://branding/locale/brand.properties"`);
  const sharedStringBundle = Services.strings.createBundle(
    "chrome://branding/locale/brand.properties"
  );

  // Don't write an assertion directly off of the brand name, as it could change
  // depending on the build.
  const brandFullName = sharedStringBundle.GetStringFromName("brandFullName");
  info("Reading the brand name: " + brandFullName);
  Assert.equal(typeof brandFullName, "string");
  Assert.greater(brandFullName.length, 0);

  info(`Changing the locale to es-ES.`);
  Services.locale.requestedLocales = ["es-ES"];
  await document.l10n.ready;

  info("Creating the test-only.properties bundle in Spanish.");
  const testOnlyBundle = Services.strings.createBundle(
    "chrome://branding/locale/test-only.properties"
  );

  Assert.equal(
    testOnlyBundle.GetStringFromName("testOnly"),
    "Mensaje solo para pruebas",
    "Normal string bundles are invalidated."
  );

  Assert.equal(
    sharedStringBundle.GetStringFromName("brandFullName"),
    "Zorro de Fuego",
    "Shared string bundles are invalidated when switching locales. This is a memory leak."
  );

  info(`Changing the locale to fr.`);
  Services.locale.requestedLocales = ["fr"];
  await document.l10n.ready;

  Assert.equal(
    sharedStringBundle.GetStringFromName("brandFullName"),
    "Renard de Feu",
    "The shared string bundle is updated again."
  );
  Assert.equal(
    testOnlyBundle.GetStringFromName("testOnly"),
    "Message de test uniquement",
    "The string bundle has been invalidated."
  );

  Assert.equal(
    Services.strings
      .createBundle("chrome://branding/locale/brand.properties")
      .GetStringFromName("brandFullName"),
    "Renard de Feu",
    "The shared string bundle can be recreated."
  );
  Assert.equal(
    Services.strings
      .createBundle("chrome://branding/locale/test-only.properties")
      .GetStringFromName("testOnly"),
    "Message de test uniquement",
    "The string bundle can be recreated."
  );
});
