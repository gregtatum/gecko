/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#import <Vision/Vision.h>
#include "mozilla/gfx/2D.h"
#include "ErrorList.h"
#include "nsOCR.h"
#include "nsClipboard.h"
#include "nsCocoaUtils.h"
#include "nsITransferable.h"

using namespace mozilla;
using namespace mozilla::widget;
using mozilla::gfx::SourceSurface;

NS_IMPL_ISUPPORTS(nsOCR, nsIOCR)

NS_IMETHODIMP
nsOCR::GetIsAvailable(bool* aIsAvailable) {
  *aIsAvailable = true;
  return NS_OK;
}

nsresult foo(nsITransferable* aTransferable) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK

  nsTArray<nsCString> flavors;
  nsresult rv = aTransferable->FlavorsTransferableCanExport(flavors);
  NS_ENSURE_SUCCESS(rv, rv);

  // The transferable should only send one image in.
  if (flavors.Length() != 0) {
    NS_WARNING("Only one image is expected in the transferable.");
    return NS_ERROR_INVALID_ARG;
  }
  nsCString& flavorStr = flavors[0];
  if (!nsClipboard::IsImageType(flavorStr)) {
    NS_WARNING("The transferable was not sent an image.");
    return NS_ERROR_INVALID_ARG;
  }

  nsCOMPtr<nsISupports> transferSupports;
  rv = aTransferable->GetTransferData(flavorStr.get(), getter_AddRefs(transferSupports));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<imgIContainer> image(do_QueryInterface(transferSupports));
  if (!image) {
    NS_WARNING("Image isn't an imgIContainer in transferable.");
    return NS_ERROR_FAILURE;
  }

  RefPtr<SourceSurface> surface =
    image->GetFrame(imgIContainer::FRAME_CURRENT,
                    imgIContainer::FLAG_SYNC_DECODE | imgIContainer::FLAG_ASYNC_NOTIFY);

  if (!surface) {
    return NS_ERROR_FAILURE;
  }

  CGImageRef imageRef = NULL;
  rv = nsCocoaUtils::CreateCGImageFromSurface(surface, &imageRef);
  if (NS_FAILED(rv) || !imageRef) {
    return NS_ERROR_FAILURE;
  }

  // --------

  VNRecognizeTextRequest *textRecognitionRequest =
    [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull request, NSError * _Nullable error) {
      NSArray<VNRecognizedTextObservation *> *observations = request.results;
      NSMutableArray<NSString *> *results = [NSMutableArray arrayWithCapacity:observations.count];

      [observations enumerateObjectsUsingBlock:^(VNRecognizedTextObservation * _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        // Requests the n top candidates for a recognized text string.
        VNRecognizedText *topCandidate = [obj topCandidates:1].firstObject;
        printf("Found text: %s", [topCandidate.string UTF8String]);
      }];
    }];


  // TODO - This class might want to require a `new` operator, and retain this queue.
  auto queue = dispatch_queue_create("org.mozilla.textrecognition", DISPATCH_QUEUE_SERIAL);

  VNImageRequestHandler *requestHandler =
    [[VNImageRequestHandler alloc] initWithCGImage:imageRef options:@{}];

  dispatch_async(queue, ^{
    NSError *error = nil;
    [requestHandler performRequests:@[textRecognitionRequest] error:&error];

    // if (error != nil) {
    //   [callback call:@[@{ @"success": @NO, @"error": error.localizedDescription }] thisObject:self];
    // }
  });

  NS_OBJC_END_TRY_IGNORE_BLOCK
}
