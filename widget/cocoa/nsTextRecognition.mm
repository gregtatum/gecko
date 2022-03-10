/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#import <Vision/Vision.h>
#include "mozilla/dom/Promise.h"
#include "mozilla/gfx/2D.h"
#include "mozilla/ErrorResult.h"
#include "ErrorList.h"
#include "nsTextRecognition.h"
#include "nsClipboard.h"
#include "nsCocoaUtils.h"
#include "nsITransferable.h"

using namespace mozilla;
using namespace mozilla::widget;
using mozilla::gfx::SourceSurface;

NS_IMPL_CYCLE_COLLECTION(nsTextRecognition)

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(nsTextRecognition)
  NS_INTERFACE_MAP_ENTRY(nsITextRecognition)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsITextRecognition)
NS_INTERFACE_MAP_END

NS_IMPL_CYCLE_COLLECTING_ADDREF(nsTextRecognition)
NS_IMPL_CYCLE_COLLECTING_RELEASE(nsTextRecognition)

NS_IMETHODIMP
nsTextRecognition::GetIsAvailable(bool* aIsAvailable) {
  if (@available(macOS 10.15, *)) {
    *aIsAvailable = true;
  } else {
    *aIsAvailable = false;
  }
  return NS_OK;
}

template <typename T, typename Result>
void ResolveOrReject(dom::Promise& aPromise, T&, Result& aResult) {
  aPromise.MaybeResolve(std::forward<Result>(aResult));
}

template <typename T, typename Result, typename... Args>
using CallOS = Result (T::*)(Args...) const;

template <typename T, typename Result, typename... Args>
void SpawnOSBackgroundThread(
    T& aReceiver, dom::Promise& aPromise,
    CallOS<T, Result, Args...> aBackgroundTask, Args... aArgs) {
  auto promiseHolder = MakeRefPtr<nsMainThreadPtrHolder<dom::Promise>>(
      "nsTextRecognition::SpawnOSBackgroundThread", &aPromise);

  // We actually want to allow to access the printer data from the callback, so
  // disable strict checking. They should of course only access immutable
  // members.
  auto holder = MakeRefPtr<nsMainThreadPtrHolder<T>>(
      "nsTextRecognition::SpawnOSBackgroundThread", &aReceiver,
      /* strict = */ false);

  // See https://stackoverflow.com/questions/47496358/c-lambdas-how-to-capture-variadic-parameter-pack-from-the-upper-scope
  // about the tuple shenanigans. It could be improved with C++20
  NS_DispatchBackgroundTask(
    NS_NewRunnableFunction(
      "SpawnOSBackgroundThread",
      [
        holder = std::move(holder),
        promiseHolder = std::move(promiseHolder),
        backgroundTask = aBackgroundTask,
        aArgs = std::make_tuple(std::forward<Args>(aArgs)...)
      ] {
        Result result = std::apply(
            [&](auto&&... args) { return (holder->get()->*backgroundTask)(args...); },
            std::move(aArgs)
        );

        NS_DispatchToMainThread(NS_NewRunnableFunction(
          "SpawnOSBackgroundThreadResolution",
          [
            holder = std::move(holder),
            promiseHolder = std::move(promiseHolder),
            result = std::move(result)
          ] {
            ResolveOrReject(*promiseHolder->get(), *holder->get(), result);
          }
        ));
      }
    ),
    NS_DISPATCH_EVENT_MAY_BLOCK
  );
}

// Gets a fresh promise into aResultPromise, that resolves whenever the background
// task finishes.
template <typename T, typename Result, typename... Args>
nsresult CallOSTaskPromise(
    T& aReceiver,
    JSContext* aCx,
    dom::Promise** aResultPromise,
    CallOS<T, Result, Args...> aTask,
    Args... aArgs
) {
  ErrorResult rv;
  RefPtr<dom::Promise> promise = dom::Promise::Create(xpc::CurrentNativeGlobal(aCx), rv);
  if (MOZ_UNLIKELY(rv.Failed())) {
    return rv.StealNSResult();
  }

  SpawnOSBackgroundThread(aReceiver, *promise, aTask,
                           std::forward<Args>(aArgs)...);

  promise.forget(aResultPromise);
  return NS_OK;
}

// Resolves an async attribute via a background task, creating and storing a
// promise as needed in aPromiseSlot.
template <typename T, typename Result, typename... Args>
nsresult AsyncPromise(
    T& aReceiver,
    RefPtr<dom::Promise>& aPromiseSlot,
    JSContext* aCx,
    dom::Promise** aResultPromise,
    CallOS<T, Result, Args...> aTask,
    Args... aArgs
) {

  if (RefPtr<dom::Promise> existing = aPromiseSlot) {
    existing.forget(aResultPromise);
    return NS_OK;
  }

  nsresult rv =
      CallOSTaskPromise(aReceiver, aCx, aResultPromise,
                                 aTask, std::forward<Args>(aArgs)...);
  NS_ENSURE_SUCCESS(rv, rv);

  aPromiseSlot = *aResultPromise;
  return NS_OK;
}

NS_IMETHODIMP
nsTextRecognition::FindText(imgIContainer *aImage, JSContext* aCx, ::mozilla::dom::Promise ** aResultPromise) {

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

 return AsyncPromise(*this, mCallPromise, aCx,
                                              aResultPromise,
                                              &nsTextRecognition::CallOS, surface);
}

bool nsTextRecognition::CallOS(RefPtr<SourceSurface> aSurface) const {
  // TODO - What's the ownership of this imgIContainer?
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK
  if (@available(macOS 10.15, *)) {

    CGImageRef imageRef = NULL;
    nsresult rv = nsCocoaUtils::CreateCGImageFromSurface(aSurface, &imageRef);
    if (NS_FAILED(rv) || !imageRef) {
      return NS_ERROR_FAILURE == NS_OK;
    }

    __block bool success = false;

    // Define the request to use, and handle the result. It will be dispatched below.
    VNRecognizeTextRequest *textRecognitionRequest =
      [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull request, NSError * _Nullable error) {
        NSArray<VNRecognizedTextObservation*> *observations = request.results;

        printf("Received text observations\n");
        [observations enumerateObjectsUsingBlock:^(
          VNRecognizedTextObservation * _Nonnull obj, NSUInteger idx,
          BOOL * _Nonnull stop) {
            success = true;
            // Requests the n top candidates for a recognized text string.
            VNRecognizedText *recognizedText = [obj topCandidates:1].firstObject;
            printf("Found text: %s\n", [recognizedText.string UTF8String]);
          }
        ];
      }];

    NSError *error = nil;
    VNImageRequestHandler *requestHandler =
      [[VNImageRequestHandler alloc] initWithCGImage:imageRef options:@{}];

    [requestHandler performRequests:@[textRecognitionRequest] error:&error];

    if (error != nil) {
      return NS_ERROR_FAILURE == NS_OK;
    }
    printf("Returning recognition result %s\n", success ? "true" : "false");
    return success;
  } else {
    // The APIs are not available.
    return NS_ERROR_NOT_IMPLEMENTED == NS_OK;
  }
  NS_OBJC_END_TRY_IGNORE_BLOCK
  return NS_OK == NS_OK;
}
