/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsString.h"
#include "nsWrapperCache.h"
#include "nsCycleCollectionParticipant.h"
#include "nsIGlobalObject.h"
#include "mozilla/dom/PContent.h"

namespace mozilla::dom {

class ImageText final : public nsWrapperCache {
 public:
  NS_INLINE_DECL_CYCLE_COLLECTING_NATIVE_REFCOUNTING(ImageText)
  NS_DECL_CYCLE_COLLECTION_SCRIPT_HOLDER_NATIVE_CLASS(ImageText)

  explicit ImageText(nsCOMPtr<nsIGlobalObject> aGlobal,
                     const TextRecognitionQuad& aQuad)
      : mGlobal(aGlobal),
        mConfidence(aQuad.confidence()),
        mString(aQuad.string()),
        mBottomLeftX(aQuad.points()[0].x),
        mBottomLeftY(aQuad.points()[0].y),
        mTopLeftX(aQuad.points()[1].x),
        mTopLeftY(aQuad.points()[1].y),
        mTopRightX(aQuad.points()[2].x),
        mTopRightY(aQuad.points()[2].y),
        mBottomRightX(aQuad.points()[3].x),
        mBottomRightY(aQuad.points()[3].y) {}

  JSObject* WrapObject(JSContext* aCx,
                       JS::Handle<JSObject*> aGivenProto) override;

  nsIGlobalObject* GetParentObject() const { return mGlobal; }

  float Confidence() { return mConfidence; };
  void GetString(nsString& aString) const { aString = mString; }
  float BottomLeftX() { return mBottomLeftX; };
  float BottomLeftY() { return mBottomLeftY; };
  float TopLeftX() { return mTopLeftX; };
  float TopLeftY() { return mTopLeftY; };
  float TopRightX() { return mTopRightX; };
  float TopRightY() { return mTopRightY; };
  float BottomRightX() { return mBottomRightX; };
  float BottomRightY() { return mBottomRightY; };

 protected:
  ~ImageText() = default;
  nsCOMPtr<nsIGlobalObject> mGlobal;
  float mConfidence;
  nsString mString;
  float mBottomLeftX;
  float mBottomLeftY;
  float mTopLeftX;
  float mTopLeftY;
  float mTopRightX;
  float mTopRightY;
  float mBottomRightX;
  float mBottomRightY;
};

}  // namespace mozilla::dom
