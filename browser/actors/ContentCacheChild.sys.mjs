/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  LanguageDetector:
    "resource://gre/modules/translation/LanguageDetector.sys.mjs",
});

/**
 * Cache any content a user views in order to build a local searchable database.
 */
export class ContentCacheChild extends JSWindowActorChild {
  async handleEvent(event) {
    if (event.originalTarget.defaultView != this.contentWindow) {
      return;
    }

    switch (event.type) {
      case "pageshow":
        // TODO - Should we use the canonical URL here? For instance:
        // https://en.wikipedia.org/wiki/Carnivorous is not canonical.
        // It has a <link rel="canonical" href="https://en.wikipedia.org/wiki/Carnivore"/>
        // The page replaces the URL with the /Carnivore link, so if you refresh the
        // page you now get two entries. This could help de-duplicate URLs.
        let url = String(this.document.location);
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          // Do not cache "about:" pages or others.
          return;
        }

        const maxLength = 50 * 1024; // TODO - Decide on a limit here.
        const encoder = Cu.createDocumentEncoder("text/plain");
        encoder.init(this.document, "text/plain", encoder.SkipInvisibleContent);
        const text = encoder.encodeToStringWithMaxLength(maxLength);

        let locale = this.contentWindow.document.documentElement.lang;

        // Attempt to detect the language.
        if (text.length > 100) {
          // TODO - This is duplicating the work of TranslationChild. Perhaps this could
          // be smart enough to share the work?
          const { confident, language } =
            await lazy.LanguageDetector.detectLanguage(text);
          if (confident) {
            locale = language;
          }
        }

        this.sendAsyncMessage("ContentCache:AddPage", {
          text,
          url,
          locale,
        });
        break;
    }
  }
}
