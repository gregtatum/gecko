/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "gtest/gtest.h"

#include "mozilla/intl/TextLayout.h"

namespace mozilla::intl {

TEST(IntlTextLayout, GetCharacterOrientation)
{
  auto en = TextLayout::GetCharacterOrientation("en").unwrap();
  ASSERT_EQ(en, CharacterOrientation::LeftToRight);

  auto he = TextLayout::GetCharacterOrientation("he").unwrap();
  ASSERT_EQ(en, CharacterOrientation::RightToLeft);
}

}  // namespace mozilla::intl
