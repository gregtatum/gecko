/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsStringBundleService_h__
#define nsStringBundleService_h__

#include "nsCOMPtr.h"
#include "nsTHashMap.h"
#include "nsHashKeys.h"
#include "nsIStringBundle.h"
#include "nsIObserver.h"
#include "nsWeakReference.h"
#include "nsIErrorService.h"
#include "nsIMemoryReporter.h"

#include "mozilla/LinkedList.h"
#include "mozilla/UniquePtr.h"

struct bundleCacheEntry_t;

class nsStringBundleService : public nsIStringBundleService,
                              public nsIObserver,
                              public nsSupportsWeakReference,
                              public nsIMemoryReporter {
  MOZ_DEFINE_MALLOC_SIZE_OF(MallocSizeOf);

 public:
  nsStringBundleService();

  nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISTRINGBUNDLESERVICE
  NS_DECL_NSIOBSERVER

  NS_IMETHOD CollectReports(nsIHandleReportCallback* aHandleReport,
                            nsISupports* aData, bool anonymize) override {
    size_t amt = SizeOfIncludingThis(MallocSizeOf);

    MOZ_COLLECT_REPORT("explicit/string-bundles/service", KIND_HEAP,
                       UNITS_BYTES, amt,
                       "Memory used for StringBundleService overhead");
    return NS_OK;
  };

  size_t SizeOfIncludingThis(
      mozilla::MallocSizeOf aMallocSizeOf) const override;

  void SendContentBundles(
      mozilla::dom::ContentParent* aContentParent) const override;

  void RegisterContentBundle(const nsCString& aBundleURL,
                             const mozilla::ipc::FileDescriptor& aMapFile,
                             size_t aMapSize) override;

 private:
  virtual ~nsStringBundleService();

  void getStringBundle(const char* aUrl, nsIStringBundle** aResult);
  nsresult FormatWithBundle(nsIStringBundle* bundle, nsresult aStatus,
                            const nsTArray<nsString>& argArray,
                            nsAString& result);

  void flushBundleCache(bool ignoreShared = true);

  mozilla::UniquePtr<bundleCacheEntry_t> evictOneEntry();

  bundleCacheEntry_t* insertIntoCache(already_AddRefed<nsIStringBundle> aBundle,
                                      const nsACString& aHashKey);

  /**
   * When the app locale changes, invalidate any live bundles so that the new
   * language will be loaded in.
   */
  void invalidateKnownBundles();

  /**
   * The bundles are stored as weak references, occasionally compact this list
   * so it doesn't grow infinitely.
   */
  void compactKnownBundles();

  nsTHashMap<nsCStringHashKey, bundleCacheEntry_t*> mBundleMap;
  // LRU list of cached entries, with the least-recently-used entry first.
  mozilla::LinkedList<bundleCacheEntry_t> mBundleCache;
  // List of cached shared-memory string bundles, in arbitrary order.
  mozilla::AutoCleanLinkedList<bundleCacheEntry_t> mSharedBundles;
  // List of known bundles that can be invalidated when the app locale changes.
  nsTArray<nsWeakPtr> mKnownBundles;

  nsCOMPtr<nsIErrorService> mErrorService;

  // At the time of this writing, there were 21 string bundles loaded when
  // opening the Firefox and about:blank.
  const static size_t FIRST_COMPACTION = 30;
  const static size_t COMPACTION_INTERVAL = 10;
  size_t mNextKnownBundleCompaction = FIRST_COMPACTION;
};

#endif
