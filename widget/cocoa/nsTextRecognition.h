/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_widget_nsTextRecognition__
#define mozilla_widget_nsTextRecognition__

#include "nsCycleCollectionParticipant.h"
#include "nsISupportsImpl.h"
#include "nsITextRecognition.h"

class imgIContainer;
namespace mozilla::gfx {
class SourceSurface;
}

namespace mozilla::widget {

class nsTextRecognition final : public nsITextRecognition {
 public:
  NS_DECL_NSITEXTRECOGNITION
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_CLASS(nsTextRecognition)

  nsTextRecognition() = default;

 protected:
  RefPtr<dom::Promise> mCallPromise;
  nsAutoString CallOS(RefPtr<mozilla::gfx::SourceSurface> aImage) const;
  ~nsTextRecognition() = default;
};

}  // namespace mozilla::widget

#endif
