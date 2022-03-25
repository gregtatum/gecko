const { AddonTestUtils } = ChromeUtils.import(
  "resource://testing-common/AddonTestUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
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
  console.log(xpiFiles);
  return AddonTestUtils.createTempXPIFile(xpiFiles);
}

requestLongerTimeout(1000);
add_task(async function toolbarButtons() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["extensions.langpacks.signatures.required", false],
    ],
  });

  info(`@@@ Creating first bundle "chrome://formautofill/locale/formautofill.properties"`);
  const englishBundle = Services.strings.createBundle(
    "chrome://formautofill/locale/formautofill.properties"
  );

  // If this assertion fails, then a new string or new bundle needs to be chosen to
  // test this feature. This string was arbitrarily chosen, and could be updated
  // to use a .ftl file.
  Assert.equal(englishBundle.GetStringFromName("autofillHeader"), "Forms and Autofill");

  info(`@@@ Creating the Klingon langpack.`);
  const langpack = createLangpack({
    locale: "es-ES",
    files: [
      {
        path: `browser/chrome/features/formautofill@mozilla.org/es-ES/locale/es-ES/formautofill.properties`,
        contents: `autofillHeader=Qapla`,
      },
    ],
  });

  console.log(`@@@ langpack`, langpack.path);

  info(`@@@ Installing file`);
  await AddonTestUtils.promiseInstallFile(langpack);

  Services.obs.addObserver(() => {
    console.log(`@@@ "intl:app-locales-changed"`);
  }, "intl:app-locales-changed");

  info(`@@@ Changing the locale.`);
  Services.locale.requestedLocales = ["es-ES"];
  Services.obs.notifyObservers(null, "intl:app-locales-changed");
  info(`@@@ flushing bundles`);
  Services.strings.flushBundles()
  info(`@@@ Waiting on document.l10n to be ready.`);
  await document.l10n.ready;

  info(`@@@ Creating the klingon bundle "chrome://formautofill/locale/formautofill.properties"`);
  const klingonBundle = Services.strings.createBundle(
    "chrome://formautofill/locale/formautofill.properties"
  );

  {
    const seconds = 1000;
    const message = "";
    for (let i = seconds; i > 0; i--) {
      dump(`!!! Countdown - ${message} ${i}
  `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    dump(`!!! Countdown ${message} done.`);
  }

  Assert.equal(
    englishBundle.GetStringFromName("autofillHeader"),
    "Forms and Autofill",
    "Bundles do not auto refresh."
  );
  Assert.equal(
    klingonBundle.GetStringFromName("autofillHeader"),
    "Qapla",
    "The klingon bundle gets the brand short name"
  );
});
