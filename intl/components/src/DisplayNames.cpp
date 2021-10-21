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

#ifdef DEBUG
/* static */
bool DisplayNames::IsStandaloneMonth(UDateFormatSymbolType symbolType) {
  switch (symbolType) {
    case UDAT_STANDALONE_MONTHS:
    case UDAT_STANDALONE_SHORT_MONTHS:
    case UDAT_STANDALONE_NARROW_MONTHS:
      return true;

    case UDAT_ERAS:
    case UDAT_MONTHS:
    case UDAT_SHORT_MONTHS:
    case UDAT_WEEKDAYS:
    case UDAT_SHORT_WEEKDAYS:
    case UDAT_AM_PMS:
    case UDAT_LOCALIZED_CHARS:
    case UDAT_ERA_NAMES:
    case UDAT_NARROW_MONTHS:
    case UDAT_NARROW_WEEKDAYS:
    case UDAT_STANDALONE_WEEKDAYS:
    case UDAT_STANDALONE_SHORT_WEEKDAYS:
    case UDAT_STANDALONE_NARROW_WEEKDAYS:
    case UDAT_QUARTERS:
    case UDAT_SHORT_QUARTERS:
    case UDAT_STANDALONE_QUARTERS:
    case UDAT_STANDALONE_SHORT_QUARTERS:
    case UDAT_SHORTER_WEEKDAYS:
    case UDAT_STANDALONE_SHORTER_WEEKDAYS:
    case UDAT_CYCLIC_YEARS_WIDE:
    case UDAT_CYCLIC_YEARS_ABBREVIATED:
    case UDAT_CYCLIC_YEARS_NARROW:
    case UDAT_ZODIAC_NAMES_WIDE:
    case UDAT_ZODIAC_NAMES_ABBREVIATED:
    case UDAT_ZODIAC_NAMES_NARROW:
      return false;
  }

  MOZ_ASSERT_UNREACHABLE("unenumerated, undocumented symbol type");
  return false;
}
#endif

Result<Ok, DisplayNamesError> DisplayNames::ComputeDateTimeDisplayNames(
    UDateFormatSymbolType symbolType, mozilla::Span<const int32_t> indices) {
  if (!mDateTimeDisplayNames.empty()) {
    // No need to re-compute the display names.
    return Ok();
  }
  mozilla::intl::Locale tag;
  if (LocaleParser::tryParse(Span(mLocale.data(), mLocale.size()), tag)
          .isErr()) {
    return Err(DisplayNamesError::InvalidLanguageTag);
  }

  if (!mOptions.calendar.empty()) {
    // Add the calendar extension to the locale. This is only available via
    // the MozExtension.
    Vector<char, 32> extension;
    Span<const char> prefix = MakeStringSpan("u-ca-");
    if (!extension.append(prefix.data(), prefix.size()) ||
        !extension.append(mOptions.calendar.data(), mOptions.calendar.size())) {
      return Err(DisplayNamesError::OutOfMemory);
    }
    if (auto result = tag.setUnicodeExtension(extension); result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }
  }

  constexpr char16_t* timeZone = nullptr;
  constexpr int32_t timeZoneLength = 0;

  constexpr char16_t* pattern = nullptr;
  constexpr int32_t patternLength = 0;

  Vector<char, 32> localeWithCalendar;
  VectorToBufferAdaptor buffer(localeWithCalendar);
  if (auto result = tag.toString(buffer); result.isErr()) {
    return Err(ToError(result.unwrapErr()));
  }
  if (!localeWithCalendar.append('\0')) {
    return Err(DisplayNamesError::OutOfMemory);
  }

  UErrorCode status = U_ZERO_ERROR;
  UDateFormat* fmt = udat_open(
      UDAT_DEFAULT, UDAT_DEFAULT,
      AssertNullTerminatedString(IcuLocale(localeWithCalendar.begin())),
      timeZone, timeZoneLength, pattern, patternLength, &status);
  if (U_FAILURE(status)) {
    return Err(DisplayNamesError::InternalError);
  }
  ScopedICUObject<UDateFormat, udat_close> datToClose(fmt);

  Vector<char16_t, 32> name;
  for (uint32_t i = 0; i < indices.size(); i++) {
    int32_t index = indices[i];
    auto result = FillBufferWithICUCall(name, [&](UChar* target, int32_t length,
                                                  UErrorCode* status) {
      return udat_getSymbols(fmt, symbolType, index, target, length, status);
    });
    if (result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }

    // Everything except Undecimber should always have a non-empty name.
    MOZ_ASSERT_IF(!IsStandaloneMonth(symbolType) || index != UCAL_UNDECIMBER,
                  !name.empty());

    if (!mDateTimeDisplayNames.append(
            std::u16string(name.begin(), name.length()))) {
      return Err(DisplayNamesError::OutOfMemory);
    }
  }
  return Ok();
}

/* static */
Maybe<uint8_t> DisplayNames::ValidateDisplayNamesNumber(
    Span<const char> aNumber, uint8_t aMax) {
  MOZ_ASSERT(aMax < 100);
  uint8_t result;
  if (aNumber.size() == 2) {
    if (aNumber[0] < '1' || aNumber[0] > '9' || aNumber[1] < '0' ||
        aNumber[1] > '9') {
      return Nothing();
    }
    result = (aNumber[0] - '0') * 10 + (aNumber[1] - '0');
  } else if (aNumber.size() == 1) {
    if (aNumber[0] < '1' || aNumber[0] > '9') {
      return Nothing();
    }
    result = aNumber[0] - '0';
  } else {
    return Nothing();
  }
  if (result > aMax) {
    return Nothing();
  }
  return Some(result);
}

}  // namespace mozilla::intl
