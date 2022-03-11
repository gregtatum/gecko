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

/**
 * Perform text recognition on an image using native OS APIs.
 *
 * TODO - This should be a base class with specific platform implementations.
 *
 * The base class should reject the promise for finding text, and set the
 * isAvailable method to false. The deriving classes should implement the
 * OS-specific APIs.
 */
class nsTextRecognition final : public nsITextRecognition {
 public:
  NS_DECL_NSITEXTRECOGNITION
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_CLASS(nsTextRecognition)

  nsTextRecognition() = default;

 protected:
  // TODO - I don't think this promise needs to be retained, it was just how the
  // printer implementation did it. Or maybe, it needs to be a list of
  // outstanding promises to be resolved. Multiple OS calls can go out at once,
  // so this is a racy area.
  RefPtr<dom::Promise> mCallPromise;

  // This contains the OS-specific call to get the text recognition results.
  nsAutoString CallOS(RefPtr<mozilla::gfx::SourceSurface> aImage) const;
  ~nsTextRecognition() = default;
};

}  // namespace mozilla::widget

#endif
