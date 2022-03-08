/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_widget_nsTextRecognition__
#define mozilla_widget_nsTextRecognition__

#include "nsCOMPtr.h"
#include "nsWrapperCache.h"
#include "nsITextRecognition.h"

class nsIGlobalObject;

namespace mozilla::widget {

class nsTextRecognition final : public nsWrapperCache {
  NS_INLINE_DECL_CYCLE_COLLECTING_NATIVE_REFCOUNTING(nsTextRecognition)
  NS_DECL_CYCLE_COLLECTION_SCRIPT_HOLDER_NATIVE_CLASS(nsTextRecognition)

 public:
  explicit nsTextRecognition(nsIGlobalObject* aGlobal = nullptr);

 protected:
  nsCOMPtr<nsIGlobalObject> mGlobal;

 private:
  ~nsTextRecognition() = default;
};

}  // namespace mozilla::widget

#endif
