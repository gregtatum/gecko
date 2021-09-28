/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef intl_components_Bidi_h_
#define intl_components_Bidi_h_

#include "mozilla/intl/ICU4CGlue.h"

struct UBiDi;

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
   * embedded, and the default direction of text on that embedding level.
   * Embedding levels are changed by using the Left-to-Right Embedding (LRE)
   * codepoint (U+202A), or the Right-to-Left Embedding (RLE) codepoint
   * (U+202B). The minimum embedding level of text is zero, and the maximum
   * explicit depth is 125
   */
  class EmbeddingLevel {
   public:
    explicit EmbeddingLevel(uint8_t aValue) : mValue(aValue) {}
    explicit EmbeddingLevel(int aValue)
        : mValue(static_cast<uint8_t>(aValue)) {}

    EmbeddingLevel() = default;

    // Enable the copy operators, but disable move as this is only a uint8_t.
    EmbeddingLevel(const EmbeddingLevel& other) = default;
    EmbeddingLevel& operator=(const EmbeddingLevel& other) = default;

    /**
     * Determine the direction of the embedding level by looking at the least
     * significant bit. If it is 0, then it is LTR. If it is 1, then it is RTL.
     */
    Direction Direction();

    /**
     * Create a left-to-right embedding level.
     */
    static EmbeddingLevel LTR();

    /**
     * Create an right-to-left embedding level.
     */
    static EmbeddingLevel RTL();

    /**
     * When passed into SetParagraph, the direction is determined by first
     * strongly directional character, with the default set to left-to-right if
     * none is found.
     *
     * This is encoded with the highest bit set to 1.
     */
    static EmbeddingLevel DefaultLTR();

    /**
     * When passed into SetParagraph, the direction is determined by first
     * strongly directional character, with the default set to right-to-left if
     * none is found.
     *
     * * This is encoded with the highest and lowest bits set to 1.
     */
    static EmbeddingLevel DefaultRTL();

    bool IsDefaultLTR() const;
    bool IsDefaultRTL() const;
    bool IsLTR() const;
    bool IsRTL() const;
    bool IsSameDirection(EmbeddingLevel aOther) const;

    uint8_t Value() const;

    operator uint8_t() const { return mValue; }

   private:
    uint8_t mValue = 0;
  };

  /**
   * Set the current paragraph of text to analyze for its bidi properties. This
   * performs the Unicode bidi algorithm as specified by:
   * https://unicode.org/reports/tr9/
   *
   * After setting the text, the other getter methods can be used to find out
   * the directionality of the paragraph text.
   */
  ICUResult SetParagraph(Span<const char16_t> aParagraph,
                         EmbeddingLevel aLevel);

  /**
   * Get the embedding level for the paragraph that was set by SetParagraph.
   */
  EmbeddingLevel GetParagraphEmbeddingLevel() const;

  /**
   * Get the directionality of the paragraph text that was set by SetParagraph.
   */
  ParagraphDirection GetParagraphDirection() const;

  Result<int32_t, ICUError> CountRuns();

  /**
   * Get the next logical run. The logical runs are a run of text that has the
   * same directionality and embedding level. These runs are in memory order,
   * and not in display order.
   *
   * aLogicalLimitOut, and aLevelOut are both out params.
   */
  void GetLogicalRun(int32_t aLogicalStart, int32_t* aLogicalLimitOut,
                     EmbeddingLevel* aLevelOut);

  /**
   * TODO before landing - Unify better.
   *
   * This is a convenience function that does not use a nsBidi object.
   * It is intended to be used for when an application has determined the
   * embedding levels of objects (character sequences) and just needs to have
   * them reordered (L2). This is equivalent to using <code>GetVisualMap</code>
   * on a <code>nsBidi</code> object.
   *
   * @param aLevels is an array with <code>aLength</code> levels that have been
   *      determined by the application.
   *
   * @param aLength is the number of levels in the array, or, semantically,
   *      the number of objects to be reordered.
   *      It must be <code>aLength>0</code>.
   *
   * @param aIndexMap is a pointer to an array of <code>aLength</code>
   *      indexes which will reflect the reordering of the characters.
   *      The array does not need to be initialized.<p>
   *      The index map will result in
   *        <code>aIndexMap[aVisualIndex]==aLogicalIndex</code>.
   */
  static void ReorderVisual(const EmbeddingLevel* aLevels, int32_t aLength,
                            int32_t* aIndexMap);

  Direction GetVisualRun(int32_t aRunIndex, int32_t* aLogicalStart,
                         int32_t* aLength);

 private:
  ICUPointer<UBiDi> mBidi = ICUPointer<UBiDi>(nullptr);
  const EmbeddingLevel* mLevels = nullptr;
  int32_t mLength = 0;
};

}  // namespace mozilla::intl
#endif
