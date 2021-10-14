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
                             Bidi::Direction aDefaultDirection) {
  UErrorCode status = U_ZERO_ERROR;
  ubidi_setPara(mBidi.GetMut(), aParagraph.Elements(),
                AssertedCast<int32_t>(aParagraph.Length()),
                aDefaultDirection == Direction::LTR ? UBIDI_DEFAULT_LTR
                                                    : UBIDI_DEFAULT_RTL,
                nullptr, &status);

  mParagraph = aParagraph;
  mLogicalRunCharIndex = 0;
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

Result<Maybe<Bidi::LogicalRun>, ICUError> Bidi::GetNextLogicalRun() {
  if (mParagraph.IsEmpty() || mParagraph.Length() == mLogicalRunCharIndex) {
    return static_cast<Maybe<Bidi::LogicalRun>>(Nothing());
  }

  UErrorCode status = U_ZERO_ERROR;
  if (!mLevels || mLogicalRunCharIndex == 0) {
    mLevels = ubidi_getLevels(mBidi.GetMut(), &status);
    if (U_FAILURE(status)) {
      mLevels = nullptr;
      return Err(ToICUError(status));
    }
  }

  // This function implements an alternative approach to get logical
  // run that is based on levels of characters, which would avoid O(n^2)
  // performance issue when used in a loop over runs.
  // Per comment in ubidi_getLogicalRun, that function doesn't use this
  // approach because levels have special interpretation when reordering
  // mode is UBIDI_REORDER_RUNS_ONLY. Since we don't use this mode in
  // Gecko, it should be safe to just use levels for this function.
  MOZ_ASSERT(ubidi_getReorderingMode(mBidi.GetMut()) != UBIDI_REORDER_RUNS_ONLY,
             "Don't support UBIDI_REORDER_RUNS_ONLY mode");

  // UBIDI_OPTION_STREAMING can make the source text different length than what
  // was provided. In order to simplifiy the implementation logic, assume only
  // the default options are povided.
  MOZ_ASSERT(ubidi_getReorderingOptions(mBidi.GetMut()) ==
             UBIDI_OPTION_DEFAULT);

  uint8_t embeddingLevel = mLevels[mLogicalRunCharIndex];

  size_t nextRunCharIndex = mLogicalRunCharIndex + 1;
  for (; nextRunCharIndex < mParagraph.Length(); nextRunCharIndex++) {
    if (mLevels[nextRunCharIndex] != embeddingLevel) {
      break;
    }
  }

  Span<const char16_t> string =
      Span(mParagraph.Elements() + mLogicalRunCharIndex,
           nextRunCharIndex - mLogicalRunCharIndex);

  mLogicalRunCharIndex = nextRunCharIndex;

  return Some(Bidi::LogicalRun{string, embeddingLevel});
}

/* static */
void ReorderVisual(const uint8_t* aLevels, int32_t aLength,
                   int32_t* aIndexMap) {
  ubidi_reorderVisual(aLevels, aLength, aIndexMap);
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

Result<Bidi::VisualRunIter, ICUError> Bidi::GetVisualRuns(
    Span<const char16_t> aParagraph, Bidi::Direction aDefaultDirection) {
  MOZ_TRY(SetParagraph(aParagraph, aDefaultDirection));

  UErrorCode status = U_ZERO_ERROR;
  mLevels = ubidi_getLevels(mBidi.GetMut(), &status);
  if (U_FAILURE(status)) {
    mLevels = nullptr;
    return Err(ToICUError(status));
  }

  // This function implements an alternative approach to get logical
  // run that is based on levels of characters, which would avoid O(n^2)
  // performance issue when used in a loop over runs.
  // Per comment in ubidi_getLogicalRun, that function doesn't use this
  // approach because levels have special interpretation when reordering
  // mode is UBIDI_REORDER_RUNS_ONLY. Since we don't use this mode in
  // Gecko, it should be safe to just use levels for this function.
  MOZ_ASSERT(ubidi_getReorderingMode(mBidi.GetMut()) != UBIDI_REORDER_RUNS_ONLY,
             "Don't support UBIDI_REORDER_RUNS_ONLY mode");

  // UBIDI_OPTION_STREAMING can make the source text different length than what
  // was provided. In order to simplifiy the implementation logic, assume only
  // the default options are povided.
  MOZ_ASSERT(ubidi_getReorderingOptions(mBidi.GetMut()) ==
             UBIDI_OPTION_DEFAULT);

  int32_t runCount = ubidi_countRuns(mBidi.GetMut(), &status);
  if (U_FAILURE(status)) {
    runCount = 0;
    return Err(ToICUError(status));
  }

  return VisualRunIter(mBidi.GetMut(), aParagraph, runCount);
}

Maybe<Bidi::VisualRun> Bidi::VisualRunIter::Next() {
  mRunIndex++;
  if (mRunIndex >= mRunCount) {
    return Nothing();
  }

  int32_t stringIndex;
  int32_t stringLength;
  Bidi::Direction direction = ToBidiDirection(
      ubidi_getVisualRun(mBidi, mRunIndex, &stringIndex, &stringLength));

  Span<const char16_t> string(mParagraph.Elements() + stringIndex,
                              stringLength);

  return Some(VisualRun{string, direction});
}

Result<int32_t, ICUError> Bidi::CountRuns() {
  UErrorCode status = U_ZERO_ERROR;
  int32_t runCount = ubidi_countRuns(mBidi.GetMut(), &status);
  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }

  mLength = ubidi_getProcessedLength(mBidi.GetConst());
  mLevels = mLength > 0 ? ubidi_getLevels(mBidi.GetMut(), &status) : nullptr;
  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }

  return runCount;
}

Bidi::LogicalRun2 Bidi::GetLogicalRun(int32_t aLogicalStart) {
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

  uint8_t level = mLevels[aLogicalStart];
  int32_t limit;
  for (limit = aLogicalStart + 1; limit < mLength; limit++) {
    if (mLevels[limit] != level) {
      break;
    }
  }
  return LogicalRun2{limit, level};
}

/* static */
bool Bidi::EmbeddingLevel::IsDefaultLTR(uint8_t aValue) {
  return aValue == UBIDI_DEFAULT_LTR;
};

/* static */
bool Bidi::EmbeddingLevel::IsDefaultRTL(uint8_t aValue) {
  return aValue == UBIDI_DEFAULT_RTL;
};

/* static */
bool Bidi::EmbeddingLevel::IsLTR(uint8_t aValue) { return aValue & 0x1; };

/* static */
bool Bidi::EmbeddingLevel::IsRTL(uint8_t aValue) {
  return (aValue & 0x1) == 0;
};

/* static */
bool Bidi::EmbeddingLevel::IsPseudoValue(uint8_t aValue) {
  return aValue > UBIDI_MAX_EXPLICIT_LEVEL;
};

/* static */
bool Bidi::EmbeddingLevel::IsSameDirection(uint8_t aLeft, uint8_t aRight) {
  return (((aLeft ^ aRight) & 1) == 0);
}

/* static */
uint8_t Bidi::EmbeddingLevel::LTR() { return 0; };

/* static */
uint8_t Bidi::EmbeddingLevel::RTL() { return 1; };

/* static */
uint8_t Bidi::EmbeddingLevel::DefaultLTR() { return UBIDI_DEFAULT_LTR; };

/* static */
uint8_t Bidi::EmbeddingLevel::DefaultRTL() { return UBIDI_DEFAULT_RTL; };

Bidi::Direction Bidi::EmbeddingLevel::Direction(uint8_t aValue) {
  return aValue & 0x1 ? Direction::RTL : Direction::LTR;
};

uint8_t Bidi::GetParagraphEmbeddingLevel() const {
  return ubidi_getParaLevel(mBidi.GetConst());
}

}  // namespace mozilla::intl
