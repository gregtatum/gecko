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
  NetUtil: "resource://gre/modules/NetUtil.jsm",
});

/**
 * Cache any content a user views in order to build a local searchable database.
 */
export class ContentCacheChild extends JSWindowActorChild {

  async #handleDOMContentLoaded(event) {
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
  }

  #accessCache() {
    if (!this.browsingContext.isContent) {
      return;
    }

    let url = String(this.document.location);
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      // Do not cache "about:" pages or others.
      return;
    }

    // TODO - I don't understand the security implications of this line and need
    // to verify that this has the proper policy.
    const loadContextInfo = Services.loadContextInfo.fromLoadContext(
      this.docShell.QueryInterface(Ci.nsILoadContext),
      false // isAnonymous
    );

    const storage = Services.cache2.diskCacheStorage(loadContextInfo);

    console.log(`!!! Fetching url`, url);

    try {
      storage.asyncOpenURI(
        Services.io.newURI(url),
        "",
        Ci.nsICacheStorage.OPEN_PRIORITY,
        {
          QueryInterface: ChromeUtils.generateQI(["nsICacheEntryOpenCallback"]),

          onCacheEntryCheck(entry) {
            console.log(`!!! onCacheEntryCheck`, entry);
            return Ci.nsICacheEntryOpenCallback.ENTRY_WANTED;
          },

          onCacheEntryAvailable(entry, isNew, status) {
            console.log(`!!! onCacheEntryAvailable`, entry, isNew, status);
            console.log(`!!! Is this persisted to disk?`, entry.persistent);
            console.log(`!!! Fetch count`, entry.fetchCount);
            // This is blocking:
            try {
              console.log(`!!! Before entry.openInputStream`);
              const inputStream = entry.openInputStream(0);
              console.log(`!!! After entry.openInputStream`);
              const bytesAvailable = inputStream.available();
              if (bytesAvailable === 0) {
                console.log(`!!! No bytes are available`);
              } else {
                const text = lazy.NetUtil.readInputStreamToString(
                  inputStream,
                  inputStream.available(),
                  { charset: "utf-8" }
                );
                console.log(`!!! text`, text);
              }



            } catch (error) {
              console.error("Failed to open input stream for entry", error);
            }
            entry.visitMetaData(new class {
              QueryInterface = ChromeUtils.generateQI(["nsICacheEntryMetaDataVisitor"]);
              onMetaDataElement = (key, value) => {
                console.log(`!!! key/value`, { key, value });
              }
            });

          }
        }
      );
    } catch (error) {
      console.error("Failed to open cache entry", error);
    }
  }

  async handleEvent(event) {
    if (event.originalTarget.defaultView != this.contentWindow) {
      return;
    }

    switch (event.type) {
      case "DOMDocElementInserted": {

        this.document.addEventListener('DOMContentLoaded', this.#handleDOMContentLoaded.bind(this));
        this.document.addEventListener('DOMContentLoaded', this.#accessCache.bind(this));
        break;
      }
    }
  }
}

/**
 * TODO - This is hack as I copied it from:
 * https://searchfox.org/mozilla-central/source/netwerk/test/unit/head_cache2.js
 */
function pumpReadStream(inputStream, callback) {
  return new Promise((resolve, reject) => {
    console.log(`!!! pumpReadStream isNonBlocking?`, inputStream.isNonBlocking());
    if (!inputStream.isNonBlocking()) {
      reject(new Error("Expected non blocking stream."));
      return;
    }
    // non-blocking stream, must read via pump
    const pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(
      Ci.nsIInputStreamPump
    );

    pump.init(
      inputStream,
      0, // segment size (0 for default)
      0, // segment count (0 for default)
      true // close when done
    );

    let data = "";
    console.log(`!!! pump.asyncRead`);

    pump.asyncRead({
      QueryInterface: ChromeUtils.generateQI(["nsIStreamListener"]),

      /**
       * @param {nsIRequest} _request
       */
      onStartRequest(_request) {
        console.log(`!!! onStartRequest`);
      },

      /**
       * @param {nsIRequest} _request
       * @param {nsIInputStream} inputStream
       * @param {number} _offset
       * @param {number} _count
       */
      onDataAvailable(_request, inputStream, _offset, _count) {
        console.log(`!!! onDataAvailable`);
        const wrapper = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
          Ci.nsIScriptableInputStream
        );
        wrapper.init(inputStream);
        var str = wrapper.read(wrapper.available());
        console.log("reading data '" + str.substring(0, 5) + "'");
        data += str;
      },

      /**
       * @param {nsIRequest} _request
       * @param {nsresult} statusCode
       */
      onStopRequest(_request, statusCode) {
        console.log(`!!! onStopRequest`);
        if (statusCode == Cr.NS_OK) {
          resolve(data);
        } else {
          const error = new Error("Request to read stream failed");
          error.statusCode = statusCode;
          reject(error)
        }
      },
    });
  })
}
