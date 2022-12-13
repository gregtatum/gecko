/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};

XPCOMUtils.defineLazyModuleGetters(lazy, {
  LanguageDetector: "resource://gre/modules/translation/LanguageDetector.jsm",
  ReaderWorker: "resource://gre/modules/reader/ReaderWorker.jsm",
  NetUtil: "resource://gre/modules/NetUtil.jsm",
});

/**
 * Cache any content a user views in order to build a local searchable database.
 */
export class ContentCacheChild extends JSWindowActorChild {
  async handleEvent(event) {
    if (event.originalTarget.defaultView != this.contentWindow) {
      return;
    }
    if (event.type !== "pageshow") {
      return;
    }

    if (!this.browsingContext.isContent) {
      return;
    }

    let url = String(this.document.location);
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      // Do not cache "about:" pages or others.
      return;
    }

    let locale = this.contentWindow.document.documentElement.lang;

    const channel = lazy.NetUtil.newChannel({
      uri: url,
      loadUsingSystemPrincipal: true,
    });

    channel.loadFlags =
      // The first flag will load from the cache, and the second ensures that
      // we don't fallback to a network request.
      Ci.nsIRequest.LOAD_FROM_CACHE
      | Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE
      // If the cache is blocked, skip it.
      | Ci.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

    lazy.NetUtil.asyncFetch(channel, async (inputStream, statusCode, request) => {
      if (statusCode === Cr.NS_ERROR_DOCUMENT_NOT_CACHED) {
        console.log(`!!! The document is not cached yet.`, url);
        return;
      }

      if (!Components.isSuccessCode(statusCode)) {
        console.log(`!!! NetUtil.asyncFetch Error`, statusCode, Components.isSuccessCode(statusCode));
        return;
      }

      // TODO - Find out how to access the charset
      const charset = "utf-8";
      const requestChannel = request.QueryInterface(Ci.nsIChannel);
      const contentCharset = requestChannel.contentCharset || charset;

      const html = lazy.NetUtil.readInputStreamToString(inputStream, inputStream.available());

      const flags =
        Ci.nsIDocumentEncoder.OutputBodyOnly |
        Ci.nsIDocumentEncoder.SkipInvisibleContent;
      const parserUtils = Cc["@mozilla.org/parserutils;1"].getService(
        Ci.nsIParserUtils
      );
      const text = parserUtils.convertToPlainText(html, 0, 0 /* No auto-wrapping. */);

      // Attempt to detect the language.
      if (text.length > 100) {
        // TODO - This is duplicating the work of TranslationChild. Perhaps this could
        // be smart enough to share the work?
        const {
          confident,
          language,
        } = await lazy.LanguageDetector.detectLanguage(text);
        if (confident) {
          locale = language;
        }
      }

      this.sendAsyncMessage("ContentCache:AddPage", {
        text,
        url,
        locale,
      });
    });
  }
}
