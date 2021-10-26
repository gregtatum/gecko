/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "gtest/gtest.h"

#include "TestBuffer.h"
#include "mozilla/intl/DisplayNames.h"

namespace mozilla::intl {

TEST(IntlDisplayNames, Script)
{
  TestBuffer<char16_t> buffer;

  DisplayNames::Options options(DisplayNames::Type::Script);
  options.style = DisplayNames::Style::Long;

  {
    auto result = DisplayNames::TryCreate("en-US", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("Hans")).isOk());
    buffer.verboseMatches(u"Simplified Han");

    buffer.clear();
    ASSERT_TRUE(
        displayNames->Of(buffer, MakeStringSpan("ThisIsTooLong")).isOk());
    buffer.verboseMatches(u"");

    buffer.clear();
    ASSERT_TRUE(
        displayNames->Of(buffer, MakeStringSpan("✋🏽 non-ascii input"))
            .isOk());
    buffer.verboseMatches(u"");
  }

  {
    auto result = DisplayNames::TryCreate("es-ES", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("Hans")).isOk());
    buffer.verboseMatches(u"han simplificado");
  }

  options.style = DisplayNames::Style::Short;
  {
    auto result = DisplayNames::TryCreate("en-US", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("Hans")).isOk());
    buffer.verboseMatches(u"Simplified");
  }

  {
    auto result = DisplayNames::TryCreate("es-ES", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("Hans")).isOk());
    buffer.verboseMatches(u"simplificado");
  }
}

TEST(IntlDisplayNames, Language)
{
  TestBuffer<char16_t> buffer;
  DisplayNames::Options options(DisplayNames::Type::Language);

  {
    auto result = DisplayNames::TryCreate("en-US", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("es-ES")).isOk());
    buffer.verboseMatches(u"Spanish (Spain)");

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("zh-Hant")).isOk());
    buffer.verboseMatches(u"Chinese (Traditional)");

    // The undefined locale returns an empty string.
    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("und")).isOk());
    ASSERT_TRUE(buffer.get_string_view().empty());

    // Invalid locales are an error.
    buffer.clear();
    ASSERT_EQ(displayNames->Of(buffer, MakeStringSpan("asdf")).unwrapErr(),
              DisplayNamesError::InvalidOption);
    ASSERT_TRUE(buffer.get_string_view().empty());

    // Unknown locales return an empty string.
    buffer.clear();
    ASSERT_TRUE(
        displayNames
            ->Of(buffer, MakeStringSpan("zz"), DisplayNames::Fallback::None)
            .isOk());
    buffer.verboseMatches(u"");

    // Unknown locales can fallback to the language code.
    buffer.clear();
    ASSERT_TRUE(
        displayNames
            ->Of(buffer, MakeStringSpan("zz-US"), DisplayNames::Fallback::Code)
            .isOk());
    buffer.verboseMatches(u"zz-US");

    // Unknown locales with a unicode extension error. Is this correct?
    buffer.clear();
    ASSERT_TRUE(displayNames
                    ->Of(buffer, MakeStringSpan("zz-US-u-ca-chinese"),
                         DisplayNames::Fallback::Code)
                    .isErr());
    buffer.verboseMatches(u"");
  }
  {
    auto result = DisplayNames::TryCreate("es-ES", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("es-ES")).isOk());
    buffer.verboseMatches(u"español (España)");

    buffer.clear();
    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("zh-Hant")).isOk());
    buffer.verboseMatches(u"chino (tradicional)");
  }
}

TEST(IntlDisplayNames, Region)
{
  TestBuffer<char16_t> buffer;

  DisplayNames::Options options(DisplayNames::Type::Region);
  options.style = DisplayNames::Style::Long;

  {
    auto result = DisplayNames::TryCreate("en-US", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("US")).isOk());
    buffer.verboseMatches(u"United States");

    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("ES")).isOk());
    buffer.verboseMatches(u"Spain");

    ASSERT_TRUE(
        displayNames
            ->Of(buffer, MakeStringSpan("ZX"), DisplayNames::Fallback::None)
            .isOk());
    buffer.verboseMatches(u"");

    ASSERT_TRUE(
        displayNames
            ->Of(buffer, MakeStringSpan("ZX"), DisplayNames::Fallback::Code)
            .isOk());
    buffer.verboseMatches(u"ZX");
  }
  {
    auto result = DisplayNames::TryCreate("es-ES", options);
    ASSERT_TRUE(result.isOk());
    auto displayNames = result.unwrap();

    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("US")).isOk());
    buffer.verboseMatches(u"Estados Unidos");

    ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("ES")).isOk());
    buffer.verboseMatches(u"España");
  }
}

TEST(IntlDisplayNames, Currency)
{
  TestBuffer<char16_t> buffer;

  DisplayNames::Options options(DisplayNames::Type::Currency);
  options.style = DisplayNames::Style::Long;

  auto result = DisplayNames::TryCreate("en-US", options);
  ASSERT_TRUE(result.isOk());
  auto displayNames = result.unwrap();
  ASSERT_TRUE(displayNames->Of(buffer, MakeStringSpan("EUR")).isOk());
  buffer.verboseMatches(u"Euro");
}

}  // namespace mozilla::intl
