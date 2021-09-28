/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef intl_components_Bidi_h_
#define intl_components_Bidi_h_

#include "mozilla/intl/ICU4CGlue.h"
#include "unicode/ubidi.h"

namespace mozilla::intl {

/**
 * This component is a Mozilla-focused API for working with Bidi text.
 */
class Bidi final {
 public:
  Bidi();
  ~Bidi();

  // Not copyable or movable
  Bidi(const Bidi&) = delete;
  Bidi& operator=(const Bidi&) = delete;

  /**
   * This is the type of the level values in our Unicode Bidi implementation.
   * It holds an embedding level and indicates the visual direction by its bit 0
   * (even/odd value).<p>
   *
   * <p>The related constants are not real, valid level values.
   * `DefaultXxx` can be used to specify
   * a default for the paragraph level for
   * when the `SetPara` function
   * shall determine it but there is no
   * strongly typed character in the input.<p>
   *
   * Note that the value for `DefaultLtr` is even
   * and the one for `DefaultRtl` is odd,
   * just like with normal LTR and RTL level values -
   * these special values are designed that way. Also, the implementation
   * assumes that MaxExplicitLevel is odd.
   */
  enum class DefaultDirection : uint8_t {
    LTR,
    RTL,
  };

  /**
   * Embedding levels are numbers that indicate how deeply the bidi text is
   * nested, and the default direction of text on that level. The minimum
   * embedding level of text is zero, and the maximum explicit depth is 125
   *
   *  - Odd values 1 - 125 represent an explicit embedding level that is RTL.
   *  - Even values 0 - 124 represent an explicit embedding level that is LTR.
   *  - The value 128 represents a level override.
   */
  using EmbeddingLevel = uint8_t;

  /**
   * Perform the Unicode Bidi algorithm.
   *
   * @param aText is a pointer to the single-paragraph text that the
   *      Bidi algorithm will be performed on
   *      (step (P1) of the algorithm is performed externally).
   *      <strong>The text must be (at least) `aLength` long.
   *      </strong>
   *
   * @param aLength is the length of the text; if `aLength==-1` then
   *      the text must be zero-terminated.
   *
   * @param aParaLevel specifies the default level for the paragraph;
   *      it is typically 0 (LTR) or 1 (RTL).
   *      If the function shall determine the paragraph level from the text,
   *      then `aParaLevel` can be set to
   *      either `NSBIDI_DEFAULT_LTR`
   *      or `NSBIDI_DEFAULT_RTL`;
   *      if there is no strongly typed character, then
   *      the desired default is used (0 for LTR or 1 for RTL).
   *      Any other value between 0 and `NSBIDI_MAX_EXPLICIT_LEVEL`
   *      is also valid, with odd levels indicating RTL.
   */
  ICUResult SetParagraph(Span<char16_t> aText,
                         DefaultDirection aDefaultDirection);

  /**
   * Get the embedding level for the paragraph that was set by SetParagraph.
   */
  EmbeddingLevel GetParagraphLevel() const;

 private:
  ICUPointer<UBiDi> mBidi = ICUPointer<UBiDi>(nullptr);
};  // namespace mozilla::intl

}  // namespace mozilla::intl
#endif
