/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#import <Vision/Vision.h>
#include "mozilla/gfx/2D.h"
#include "ErrorList.h"
#include "nsTextRecognition.h"
#include "nsClipboard.h"
#include "nsCocoaUtils.h"
#include "nsITransferable.h"
#include "mozilla/dom/Promise.h"

using namespace mozilla;
using namespace mozilla::widget;
using mozilla::gfx::SourceSurface;

NS_IMPL_ISUPPORTS(nsTextRecognition, nsITextRecognition)

NS_IMPL_CYCLE_COLLECTION_WRAPPERCACHE(nsTextRecognition, mGlobal)

NS_IMPL_CYCLE_COLLECTION_ROOT_NATIVE(nsTextRecognition, AddRef)
NS_IMPL_CYCLE_COLLECTION_UNROOT_NATIVE(nsTextRecognition, Release)

NS_IMETHODIMP
nsTextRecognition::GetIsAvailable(bool* aIsAvailable) {
  *aIsAvailable = true;
  return NS_OK;
}


already_AddRefed<dom::Promise>
nsTextRecognition::FindText(imgIContainer* aImage, ErrorResult& aRv) {
  // TODO - What's the ownership of this imgIContainer?
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK
  RefPtr<dom::Promise> promise = dom::Promise::Create(mGlobal, aRv);
  if (@available(macOS 10.15, *)) {
    if (!aImage) {
      NS_WARNING("FindText received a null imgIContainer*");
      return NS_ERROR_NULL_POINTER;
    }

    RefPtr<SourceSurface> surface =
      aImage->GetFrame(imgIContainer::FRAME_CURRENT,
                      imgIContainer::FLAG_SYNC_DECODE | imgIContainer::FLAG_ASYNC_NOTIFY);

    if (!surface) {
      NS_WARNING("Could not convert to a surface.");
      return NS_ERROR_FAILURE;
    }

    CGImageRef imageRef = NULL;
    nsresult rv = nsCocoaUtils::CreateCGImageFromSurface(surface, &imageRef);
    if (NS_FAILED(rv) || !imageRef) {
      return NS_ERROR_FAILURE;
    }

    // Define the request to use, and handle the result. It will be dispatched below.
    VNRecognizeTextRequest *textRecognitionRequest =
      [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull request, NSError * _Nullable error) {
        NSArray<VNRecognizedTextObservation*> *observations = request.results;

        [observations enumerateObjectsUsingBlock:^(
          VNRecognizedTextObservation * _Nonnull obj, NSUInteger idx,
          BOOL * _Nonnull stop) {
            // Requests the n top candidates for a recognized text string.
            VNRecognizedText *recognizedText = [obj topCandidates:1].firstObject;
            printf("Found text: %s\n", [recognizedText.string UTF8String]);
          }
        ];
      }];

    // TODO - nsTextRecognition might want to require a `new` operator, and retain this queue.
    auto queue = dispatch_queue_create("org.mozilla.textrecognition", DISPATCH_QUEUE_SERIAL);

    // Dispatch this request to an event queue.
    dispatch_async(queue, ^{
      NSError *error = nil;
      VNImageRequestHandler *requestHandler =
        [[VNImageRequestHandler alloc] initWithCGImage:imageRef options:@{}];

      [requestHandler performRequests:@[textRecognitionRequest] error:&error];

      if (error != nil) {
        // TODO - Handle this.
      }
    });
  } else {
    return NS_ERROR_NOT_IMPLEMENTED;
  }
  NS_OBJC_END_TRY_IGNORE_BLOCK
  return NS_OK;
}
