/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/intl/TextLayout.h"
#include "mozilla/intl/ICU4CGlue.h"

#include "unicode/uloc.h"
#include "unicode/utypes.h"

namespace mozilla::intl {

Result<CharacterOrientation, ICUError> TextLayout::GetCharacterOrientation(
    const char* aLocale) {
  UErrorCode status = U_ZERO_ERROR;
  ULayoutType type = uloc_getCharacterOrientation(IcuLocale(aLocale), &status);
  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }

  if (type == ULayoutType::ULOC_LAYOUT_RTL) {
    return CharacterOrientation::RightToLeft;
  }

  return CharacterOrientation::LeftToRight;
}

}  // namespace mozilla::intl
