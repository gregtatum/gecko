/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/intl/Bidi.h"
#include "mozilla/Casting.h"

namespace mozilla::intl {

Bidi::Bidi() { mBidi = ubidi_open(); }
Bidi::~Bidi() { ubidi_close(mBidi.GetMut()); }

ICUResult Bidi::SetParagraph(Span<char16_t> aText,
                             Bidi::DefaultDirection aDefaultDirection) {
  UErrorCode error = U_ZERO_ERROR;
  ubidi_setPara(mBidi.GetMut(), aText.Elements(),
                AssertedCast<int32_t>(aText.Length()),
                aDefaultDirection == DefaultDirection::LTR ? UBIDI_DEFAULT_LTR
                                                           : UBIDI_DEFAULT_RTL,
                nullptr, &error);
  return ToICUResult(error);
}

Bidi::EmbeddingLevel Bidi::GetParagraphLevel() const {
  return ubidi_getParaLevel(mBidi.GetConst());
}

}  // namespace mozilla::intl
