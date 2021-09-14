/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "gtest/gtest.h"

#include "mozilla/intl/NumberingSystem.h"

namespace mozilla::intl {

TEST(IntlNumberingSystem, GetName)
{
  auto numbers_en = NumberingSystem::TryCreate("en").unwrap();
  ASSERT_STREQ(numbers_en->GetName().unwrap(), "latn");

  auto numbers_ar = NumberingSystem::TryCreate("ar").unwrap();
  ASSERT_STREQ(numbers_ar->GetName().unwrap(), "arab");

  auto numbers_ff_Adlm = NumberingSystem::TryCreate("ff-Adlm").unwrap();
  ASSERT_STREQ(numbers_ff_Adlm->GetName().unwrap(), "adlm");
}

}  // namespace mozilla::intl
