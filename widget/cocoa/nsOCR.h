/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_widget_nsOCR__
#define mozilla_widget_nsOCR__

#include "nsIOCR.h"

namespace mozilla::widget {

class nsOCR final : public nsIOCR {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOCR

 public:
  nsOCR() = default;

 private:
  ~nsOCR() = default;
};

}  // namespace mozilla::widget

#endif
