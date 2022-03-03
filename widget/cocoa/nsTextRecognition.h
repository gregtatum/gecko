/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_widget_nsTextRecognition__
#define mozilla_widget_nsTextRecognition__

#include "nsITextRecognition.h"

namespace mozilla::widget {

class nsTextRecognition final : public nsITextRecognition {
  NS_DECL_ISUPPORTS
  NS_DECL_NSITEXTRECOGNITION

 public:
  nsTextRecognition() = default;

 private:
  ~nsTextRecognition() = default;
};

}  // namespace mozilla::widget

#endif
