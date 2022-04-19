/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { AddonTestUtils } = ChromeUtils.import(
  "resource://testing-common/AddonTestUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonManager: "resource://gre/modules/AddonManager.jsm",
});

function getChromeUrlSlug(url) {
  const result = /^chrome:\/\/(\w+)\/locale\/?$/.exec(url);
  if (!result) {
    throw new Error("Expected the properties file's chrome URL to take the form: \"chrome://slug/locale\":" + JSON.stringify(url));
  }
  return result[1];
}

function getManifestData(locale, propertiesFiles) {
  const chrome_resources = {};
  for (const { rootURL } of propertiesFiles) {
    const slug = getChromeUrlSlug(rootURL);
    chrome_resources[slug] = getFakeXPIPath(slug) + "/";
  }
  return {
    langpack_id: locale,
    name: `${locale} Language Pack`,
    description: `${locale} Language pack`,
    languages: {
      [locale]: {
        chrome_resources,
        version: "1",
      },
    },
    applications: {
      gecko: {
        strict_min_version: AppConstants.MOZ_APP_VERSION,
        id: `langpack-${locale}@firefox.mozilla.org`,
        strict_max_version: AppConstants.MOZ_APP_VERSION,
      },
    },
    version: "2.0",
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
 * @typedef {object} FakeProperties
 * @property {string} rootURL - The path that gets used for the chrome URL. It must take
 *   the form "chrome://slug/locale".
 * @property {{[string]: string}} files - The list of files that will be placed in the
 *   XPI. The key is the file name, and the value is the contents of the file.
 */

/**
 * @typedef {object} FakeLangpackOptions
 * @property {string} locale - The BCP 47 identifier
 * @property {FakeProperties[]} propertiesFiles - This list of fake properties files
 *   to be served from chrome URLs. These can either be invented files, or shadow
 *   the underlying translation files.
 */

/**
 * Create and install a test-only langpack, with actual content. This XPI file will
 * be created in a temp directory, and actually installed in the app.
 *
 * @param {FakeLangpackOptions} options
 * @returns {Promise<nsIFile>}
 */
function installFakeLangpack(options) {
  info(`Installing the ${options.locale} langpack`);
  return AddonTestUtils.promiseInstallFile(createFakeLangpack(options));
}

/**
 * The real paths in XPI files are something like:
 *
 * - browser/chrome/es-ES/locale/branding/brand.properties
 * - browser/chrome/es-ES/locale/browser/browser.properties
 * - browser/chrome/es-ES/locale/es-ES/devtools/client/debugger.properties
 * - browser/features/formautofill@mozilla.org/es-ES/locale/es-ES/formautofill.properties
 *
 * However, in the manifest.json, the chrome URLs can point to arbitrary files via
 * the chrome_resources key. This function generates an arbitrary fake path to store
 * the files in.
 */
function getFakeXPIPath(rootSlug) {
  return `fake-${rootSlug}`;
}

/**
 * Create a test-only langpack, with actual content.
 *
 * @param {FakeLangpackOptions} options
 * @returns {Promise<nsIFile>}
 */
function createFakeLangpack(options) {
  const { locale, propertiesFiles } = options;
  const xpiFiles = {
    "manifest.json": getManifestData(locale, propertiesFiles),
  };
  for (const { rootURL, files } of propertiesFiles || []) {
    const slug = getChromeUrlSlug(rootURL);
    const fakePath = getFakeXPIPath(slug);
    for (const [ name, contents ] of Object.entries(files)) {
      xpiFiles[OS.Path.join(fakePath, name)] = contents;
    }
  }
  console.log(xpiFiles);
  return AddonTestUtils.createTempXPIFile(xpiFiles);
}

/**
 * Allows the current app to install fake langpacks.
 *
 * @return {Promise<{
 *  install: typeof installFakeLangpack,
 *  create: typeof createFakeLangpack,
 * }>}
 */
async function setupFakeLangpacks(testEnv = this) {
  AddonTestUtils.initMochitest(testEnv);
  await SpecialPowers.pushPrefEnv({
    set: [["extensions.langpacks.signatures.required", false]],
  });
  return {
    install: installFakeLangpack,
    create: createFakeLangpack,
  }
}

add_task(async function toolbarButtons() {
  const fakeLangpacks = await setupFakeLangpacks();

  await fakeLangpacks.install({
    locale: "es-ES",
    propertiesFiles: [
      {
        rootURL: "chrome://branding/locale",
        files: {
          // Localizers don't really translate the brand name this way, but it
          // makes for a useful test.
          "brand.properties": "brandFullName=Zorro de Fuego",
          "test-only.properties": "testOnly=Mensaje solo para pruebas"
        },
      },
    ],
  });

  await fakeLangpacks.install({
    locale: "fr",
    propertiesFiles: [
      {
        rootURL: "chrome://branding/locale",
        files: {
          // Localizers don't really translate the brand name this way, but it
          // makes for a useful test.
          "brand.properties": "brandFullName=Renard de Feu",
          "test-only.properties": "testOnly=Message de test uniquement"
        },
      },
    ],
  });

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

  info("Changing the locale to es-ES.");
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

  info("Changing the locale to fr.");
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
