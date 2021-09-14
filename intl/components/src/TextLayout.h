/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef intl_components_TextLayout_h_
#define intl_components_TextLayout_h_

#include "mozilla/intl/ICUError.h"
#include "mozilla/Result.h"

namespace mozilla::intl {

enum class CharacterOrientation : uint8_t {
  LeftToRight,
  RightToLeft,
};

/**
 * This component is a Mozilla-focused API for working with text layouts in
 * internationalization code.
 */
class TextLayout final {
 public:
  TextLayout() = delete;

  /**
   * Returns the character orientation of the given locale.
   */
  static Result<CharacterOrientation, ICUError> GetCharacterOrientation(
      const char* aLocale);
};

}  // namespace mozilla::intl

#endif
