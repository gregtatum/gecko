/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/intl/Bidi.h"
#include "mozilla/Casting.h"
#include "mozilla/intl/ICU4CGlue.h"

#include "unicode/ubidi.h"

namespace mozilla::intl {

Bidi::Bidi() { mBidi = ubidi_open(); }
Bidi::~Bidi() { ubidi_close(mBidi.GetMut()); }

ICUResult Bidi::SetParagraph(Span<const char16_t> aParagraph,
                             Bidi::EmbeddingLevel aLevel) {
  UErrorCode status = U_ZERO_ERROR;
  ubidi_setPara(mBidi.GetMut(), aParagraph.Elements(),
                AssertedCast<int32_t>(aParagraph.Length()), aLevel, nullptr,
                &status);

  mLevels = nullptr;

  return ToICUResult(status);
}

Bidi::ParagraphDirection Bidi::GetParagraphDirection() const {
  switch (ubidi_getDirection(mBidi.GetConst())) {
    case UBIDI_LTR:
      return Bidi::ParagraphDirection::LTR;
    case UBIDI_RTL:
      return Bidi::ParagraphDirection::RTL;
    case UBIDI_MIXED:
      return Bidi::ParagraphDirection::Mixed;
    default:
      MOZ_ASSERT_UNREACHABLE("Unknown result for ubidi_getDirection.");
  };
  return Bidi::ParagraphDirection::Mixed;
}

/* static */
void Bidi::ReorderVisual(const EmbeddingLevel* aLevels, int32_t aLength,
                         int32_t* aIndexMap) {
  ubidi_reorderVisual(reinterpret_cast<const uint8_t*>(aLevels), aLength,
                      aIndexMap);
}

static Bidi::Direction ToBidiDirection(UBiDiDirection aDirection) {
  switch (aDirection) {
    case UBIDI_LTR:
      return Bidi::Direction::LTR;
    case UBIDI_RTL:
      return Bidi::Direction::RTL;
    default:
      MOZ_ASSERT_UNREACHABLE("Unexpected UBiDiDirection value.");
      return Bidi::Direction::LTR;
  }
}

Result<int32_t, ICUError> Bidi::CountRuns() {
  UErrorCode status = U_ZERO_ERROR;
  int32_t runCount = ubidi_countRuns(mBidi.GetMut(), &status);
  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }

  mLength = ubidi_getProcessedLength(mBidi.GetConst());
  mLevels = mLength > 0 ? reinterpret_cast<const Bidi::EmbeddingLevel*>(
                              ubidi_getLevels(mBidi.GetMut(), &status))
                        : nullptr;
  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }

  return runCount;
}

void Bidi::GetLogicalRun(int32_t aLogicalStart, int32_t* aLogicalLimitOut,
                         Bidi::EmbeddingLevel* aLevelOut) {
  MOZ_ASSERT(mLevels, "CountRuns hasn't been run?");
  MOZ_RELEASE_ASSERT(aLogicalStart < mLength, "Out of bound");
  // This function implements an alternative approach to get logical
  // run that is based on levels of characters, which would avoid O(n^2)
  // performance issue when used in a loop over runs.
  // Per comment in ubidi_getLogicalRun, that function doesn't use this
  // approach because levels have special interpretation when reordering
  // mode is UBIDI_REORDER_RUNS_ONLY. Since we don't use this mode in
  // Gecko, it should be safe to just use levels for this function.
  MOZ_ASSERT(ubidi_getReorderingMode(mBidi.GetMut()) != UBIDI_REORDER_RUNS_ONLY,
             "Don't support UBIDI_REORDER_RUNS_ONLY mode");

  EmbeddingLevel level = mLevels[aLogicalStart];
  int32_t limit;
  for (limit = aLogicalStart + 1; limit < mLength; limit++) {
    if (mLevels[limit] != level) {
      break;
    }
  }
  *aLogicalLimitOut = limit;
  *aLevelOut = level;
}

bool Bidi::EmbeddingLevel::IsDefaultLTR() const {
  return mValue == UBIDI_DEFAULT_LTR;
};

bool Bidi::EmbeddingLevel::IsDefaultRTL() const {
  return mValue == UBIDI_DEFAULT_RTL;
};

bool Bidi::EmbeddingLevel::IsLTR() const { return mValue & 0x1; };

bool Bidi::EmbeddingLevel::IsRTL() const { return (mValue & 0x1) == 1; };

bool Bidi::EmbeddingLevel::IsSameDirection(EmbeddingLevel aOther) const {
  return (((mValue ^ aOther) & 1) == 0);
}

Bidi::EmbeddingLevel Bidi::EmbeddingLevel::LTR() {
  return Bidi::EmbeddingLevel(0);
};

Bidi::EmbeddingLevel Bidi::EmbeddingLevel::RTL() {
  return Bidi::EmbeddingLevel(1);
};

Bidi::EmbeddingLevel Bidi::EmbeddingLevel::DefaultLTR() {
  return Bidi::EmbeddingLevel(UBIDI_DEFAULT_LTR);
};

Bidi::EmbeddingLevel Bidi::EmbeddingLevel::DefaultRTL() {
  return Bidi::EmbeddingLevel(UBIDI_DEFAULT_RTL);
};

Bidi::Direction Bidi::EmbeddingLevel::Direction() {
  return IsRTL() ? Direction::RTL : Direction::LTR;
};

uint8_t Bidi::EmbeddingLevel::Value() const { return mValue; }

Bidi::EmbeddingLevel Bidi::GetParagraphEmbeddingLevel() const {
  return Bidi::EmbeddingLevel(ubidi_getParaLevel(mBidi.GetConst()));
}

Bidi::Direction Bidi::GetVisualRun(int32_t aRunIndex, int32_t* aLogicalStart,
                                   int32_t* aLength) {
  return ToBidiDirection(
      ubidi_getVisualRun(mBidi.GetMut(), aRunIndex, aLogicalStart, aLength));
}

}  // namespace mozilla::intl
