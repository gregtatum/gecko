/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "mozilla/intl/DisplayNames.h"

namespace mozilla::intl {

/* static */
const char* DisplayNames::ToString(DisplayNames::Type aType) {
  switch (aType) {
    case Type::Script:
      return "script";
    case Type::Region:
      return "region";
    case Type::Language:
      return "language";
    case Type::Currency:
      return "currency";
    case Type::Calendar:
      return "calendar";
    case Type::Weekday:
      return "weekday";
    case Type::Month:
      return "month";
    case Type::Quarter:
      return "quarter";
    case Type::DayPeriod:
      return "dayPeriod";
    case Type::DateTimeField:
      return "dateTimeField";
  }
  MOZ_ASSERT_UNREACHABLE();
  return "";
}

DisplayNames::~DisplayNames() {
  // The mDisplayNames will not exist when the DisplayNames is being
  // moved.
  if (mULocaleDisplayNames.GetMut()) {
    uldn_close(mULocaleDisplayNames.GetMut());
  }
  if (mUDateTimePatternGen) {
    udatpg_close(mUDateTimePatternGen);
  }
}

DisplayNamesError DisplayNames::ToError(ICUError aError) const {
  switch (aError) {
    case ICUError::InternalError:
    case ICUError::OverflowError:
      return DisplayNamesError::InternalError;
    case ICUError::OutOfMemory:
      return DisplayNamesError::OutOfMemory;
  }
  MOZ_ASSERT_UNREACHABLE();
  return DisplayNamesError::InternalError;
}

DisplayNamesError DisplayNames::ToError(
    Locale::CanonicalizationError aError) const {
  switch (aError) {
    case Locale::CanonicalizationError::DuplicateVariant:
      return DisplayNamesError::DuplicateVariantSubtag;
    case Locale::CanonicalizationError::InternalError:
      return DisplayNamesError::InternalError;
    case Locale::CanonicalizationError::OutOfMemory:
      return DisplayNamesError::OutOfMemory;
  }
  MOZ_ASSERT_UNREACHABLE();
  return DisplayNamesError::InternalError;
}

/* static */
Result<UniquePtr<DisplayNames>, ICUError> DisplayNames::TryCreate(
    const char* aLocale, Options aOptions) {
  UErrorCode status = U_ZERO_ERROR;
  UDisplayContext contexts[] = {
      // Use either standard or dialect names.
      // For example either "English (GB)" or "British English".
      aOptions.languageDisplay == DisplayNames::LanguageDisplay::Standard
          ? UDISPCTX_STANDARD_NAMES
          : UDISPCTX_DIALECT_NAMES,

      // Assume the display names are used in a stand-alone context.
      UDISPCTX_CAPITALIZATION_FOR_STANDALONE,

      // Select either the long or short form. There's no separate narrow form
      // available in ICU, therefore we equate "narrow"/"short" styles here.
      aOptions.style == DisplayNames::Style::Long ? UDISPCTX_LENGTH_FULL
                                                  : UDISPCTX_LENGTH_SHORT,

      // Don't apply substitutes, because we need to apply our own fallbacks.
      UDISPCTX_NO_SUBSTITUTE,
  };

  ULocaleDisplayNames* uLocaleDisplayNames =
      uldn_openForContext(aLocale, contexts, std::size(contexts), &status);

  if (U_FAILURE(status)) {
    return Err(ToICUError(status));
  }
  return MakeUnique<DisplayNames>(uLocaleDisplayNames, MakeStringSpan(aLocale),
                                  aOptions);
};

}  // namespace mozilla::intl
