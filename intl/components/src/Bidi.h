/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef intl_components_Bidi_h_
#define intl_components_Bidi_h_

#include "mozilla/intl/ICU4CGlue.h"
#include "unicode/ubidi.h"

namespace mozilla::intl {

/**
 * This component is a Mozilla-focused API for working with bidirectional (bidi)
 * text. Text is commonly displayed left to right (LTR), especially for
 * Latin-based alphabets. However, languages like Arabic and Hebrew displays
 * text right to left (RTL). When displaying text, LTR and RTL text can be
 * combined together in the same paragraph. This class gives tools for working
 * with unidirectional, and mixed direction paragraphs.
 *
 * See the Unicode Bidirectional Algorithm document for implementation details:
 * https://unicode.org/reports/tr9/
 */
class Bidi final {
 public:
  Bidi();
  ~Bidi();

  // Not copyable or movable
  Bidi(const Bidi&) = delete;
  Bidi& operator=(const Bidi&) = delete;

  /**
   * This enum classifies text as either being left to right, or right to left.
   */
  enum class Direction : uint8_t {
    // Left to right text.
    LTR = 0,
    // Right to left text.
    RTL = 1,
  };

  /**
   * This enum indicates the text direction for the set paragraph. Some
   * paragraphs are unidirectional, where they only have one direction, or a
   * paragraph could use both LTR and RTL. In this case the paragraph's
   * direction would be mixed.
   */
  enum ParagraphDirection { LTR, RTL, Mixed };

  /**
   * Embedding levels are numbers that indicate how deeply the bidi text is
   * nested, and the default direction of text on that level. Embedding levels
   * are changed by using the Left-to-Right Embedding (LRE) codepoint (U+202A),
   * or the Right-to-Left Embedding (RLE) codepoitn (U+202B). The minimum
   * embedding level of text is zero, and the maximum explicit depth is 125
   *
   *  - Even values 0 - 124 represent an explicit embedding level that is LTR.
   *  - Odd values 1 - 125 represent an explicit embedding level that is RTL.
   *  - The value 128 represents a level override.
   */
  using EmbeddingLevel = uint8_t;

  /**
   * Set the current paragraph of text to analyze for its bidi properties. This
   * performs the Unicode bidi algorithm as specified by:
   * https://unicode.org/reports/tr9/
   *
   * After setting the text, the other getter methods can be used to find out
   * the directionality of the paragraph text.
   */
  ICUResult SetParagraph(Span<const char16_t> aParagraph,
                         Direction aDefaultDirection);

  /**
   * Get the embedding level for the paragraph that was set by SetParagraph.
   */
  EmbeddingLevel GetParagraphLevel() const;

  /**
   * Get the directionality of the paragraph text that was set by SetParagraph.
   */
  ParagraphDirection GetParagraphDirection() const;

  /**
   * A logical run is a run of text that is in the memory order, not the display
   * order.
   */
  struct LogicalRun {
    Span<const char16_t> string;
    EmbeddingLevel embeddingLevel = 0;

    Direction Direction() const {
      // The least significant bit determines the direction.
      return embeddingLevel & 0x1 ? Direction::RTL : Direction::LTR;
    }
  };

  /**
   * Get the next logical run. The logical runs are a run of text that has the
   * same directionality and embedding level. These runs are in memory order,
   * and not in display order.
   */
  Result<Maybe<Bidi::LogicalRun>, ICUError> GetNextLogicalRun();

  /**
   * A logical run is a run of text that is in the memory order, not the display
   * order.
   */
  struct VisualRun {
    Span<const char16_t> string;
    Direction direction;
  };

  /**
   * An iterator for visual runs in a paragraph.
   */
  class MOZ_STACK_CLASS VisualRunIter {
   public:
    VisualRunIter(UBiDi* aBidi, Span<const char16_t> aParagraph,
                  int32_t aRunCount)
        : mBidi(aBidi), mParagraph(aParagraph), mRunCount(aRunCount) {}

    /**
     * Get the next VisualRun, if it exists.
     */
    Maybe<VisualRun> Next();

   private:
    UBiDi* mBidi = nullptr;
    Span<const char16_t> mParagraph = Span<const char16_t>();
    int32_t mRunCount = 0;
    int32_t mRunIndex = -1;
  };

  /**
   * Get an iterator for the visual runs in a paragraph. The iterator is valid
   * for the lifetime of the mozilla::intl::Bidi class, and the referenced
   * paragraph string.
   */
  Result<VisualRunIter, ICUError> GetVisualRuns(
      Span<const char16_t> aParagraph, Bidi::Direction aDefaultDirection);

 private:
  ICUPointer<UBiDi> mBidi = ICUPointer<UBiDi>(nullptr);
  Span<const char16_t> mParagraph = Span<const char16_t>();
  size_t mLogicalRunCharIndex = 0;
  const EmbeddingLevel* mLevels = nullptr;
};

}  // namespace mozilla::intl
#endif
