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
 * Set the preference "browser.contentCache.logLevel" to "All" to see all console
 * messages. They are set to "Error" by default.
 *
 * @returns {Log}
 */
XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.contentCache.logLevel",
    prefix: "ContentCacheChild",
  });
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

    let uri = this.document.documentURI;
    if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
      // Do not cache "about:" pages or others.
      return;
    }

    let locale = this.document.documentElement.lang;

    // TODO - Review and understand these configuration values:
    const channel = lazy.NetUtil.newChannel({
      uri: uri,
      loadingPrincipal: Services.scriptSecurityManager.createContentPrincipal(this.document.documentURIObject, {}),
      securityFlags: Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_INHERITS_SEC_CONTEXT,
      contentPolicyType: Ci.nsIContentPolicy.TYPE_DOCUMENT,
    });

    // TODO - For some reason things aren't always in the cache, so this can re-request
    // the page.
    channel.loadFlags =
      // The first flag will load from the cache, and the second ensures that
      // we don't fallback to a network request.
      Ci.nsIRequest.LOAD_FROM_CACHE
      // | Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE
      // If the cache is blocked, skip it.
      | Ci.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

    // TODO -  httpChannel.isNoStoreResponse() can be called in the onStartRequest
    // of the simple-stream-listener. This would need to be wired into an argument
    // of `asyncFetch`.
    lazy.NetUtil.asyncFetch(channel, async (inputStream, statusCode, request) => {
      // TODO - Only use the cache.
      // if (statusCode === Cr.NS_ERROR_DOCUMENT_NOT_CACHED) {
      //   return;
      // }

      if (!Components.isSuccessCode(statusCode)) {
        lazy.console.log(`There was an error in the asyncFetch.`, Components.Exception("", statusCode).name);
        return;
      }

      // TODO - Find out how to access the charset
      const requestChannel = request.QueryInterface(Ci.nsIChannel);

      const charset = "utf-8";
      let httpChannel = request.QueryInterface(
        Ci.nsIHttpChannel
      );

      // TODO - Respect this.
      const contentCharset = requestChannel.contentCharset || charset;

      if (httpChannel.isNoStoreResponse()) {
        lazy.console.log("Ignored due to Cache-Control: no-store", uri);
        return;
      }

      // let maxAge;
      // let sharedMaxAge;
      // let cacheControlValue;
      // httpChannel.visitOriginalResponseHeaders({
      //   visitHeader(name, value) {
      //     if (name.toLowerCase() === "cache-control") {
      //       cacheControlValue = value;
      //       // The value looks like: "private, s-maxage=0, max-age=0, must-revalidate"
      //       for (const term of value.split(',')) {
      //         // The term will be somethign like " s-maxage=0" or " must-revalidate"
      //         const [k,v] = term.split("=");
      //         if (k.trim() === "max-age") {
      //           maxAge = v.trim();
      //         } else if (k === "s-maxage") {
      //           sharedMaxAge = v.trim()
      //         }
      //       }
      //     }
      //   },
      // });
      // if (maxAge === "0") {
      //   lazy.console.log("Ignored due to the max-age header being set to 0", cacheControlValue, uri);
      //   return;
      // }
      // if (sharedMaxAge === "0") {
      //   lazy.console.log("Ignored due to the s-maxage header being set to 0", cacheControlValue, uri);
      //   return;
      // }

      const html = lazy.NetUtil.readInputStreamToString(inputStream, inputStream.available());

      const parserUtils = Cc["@mozilla.org/parserutils;1"].getService(
        Ci.nsIParserUtils
      );
      const text = parserUtils.convertToPlainText(html, 0, 0 /* No auto-wrapping. */);

      // Attempt to detect the language.
      if (text.length > 100) {
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
        url: uri,
        locale,
      });
    });
  }
}
