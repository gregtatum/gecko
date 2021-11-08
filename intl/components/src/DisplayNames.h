/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef intl_components_DisplayNames_h_
#define intl_components_DisplayNames_h_

#include <string>
#include <string_view>
#include "ScopedICUObject.h"
#include "unicode/udat.h"
#include "unicode/udatpg.h"
#include "unicode/uldnames.h"
#include "unicode/uloc.h"
#include "unicode/ucurr.h"
#include "mozilla/intl/ICU4CGlue.h"
#include "mozilla/intl/Locale.h"
#include "mozilla/Casting.h"
#include "mozilla/Result.h"
#include "mozilla/ResultVariant.h"
#include "mozilla/Span.h"
#include "mozilla/TextUtils.h"
#include "mozilla/UniquePtr.h"

namespace mozilla::intl {
/**
 * Provide more granular errors for DisplayNames rather than use the generic
 * ICUError type. This helps with providing more actionable feedback for
 * errors with input validation.
 *
 * This type can't be nested in the DisplayNames class because it needs the
 * UnusedZero and HasFreeLSB
 */
enum class DisplayNamesError {
  // Since we claim UnusedZero<DisplayNamesError>::value and
  // HasFreeLSB<Error>::value == true below, we must only use positive,
  // even enum values.
  InternalError = 2,
  OutOfMemory = 4,
  InvalidOption = 6,
  DuplicateVariantSubtag = 8,
  InvalidLanguageTag = 10,
};
}  // namespace mozilla::intl

namespace mozilla::detail {
// Ensure the efficient packing of the error types into the result. See
// ICU4CGlue.h and the ICUError comments for more information.
template <>
struct UnusedZero<intl::DisplayNamesError>
    : UnusedZeroEnum<intl::DisplayNamesError> {};

template <>
struct HasFreeLSB<intl::DisplayNamesError> {
  static constexpr bool value = true;
};
}  // namespace mozilla::detail

namespace mozilla::intl {

#ifdef DEBUG
static bool IsStandaloneMonth(UDateFormatSymbolType symbolType) {
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

class DisplayNames final {
 public:
  enum class LocaleMatcher {
    Lookup,
    BestFit,
  };

  /**
   * The style of the display name, specified by the amount of space available
   * for displaying the text.
   */
  enum class Style {
    Narrow,
    Short,
    Long,
    // Note: Abbreviated is not part of ECMA-402, but it is available for
    // internal Mozilla usage.
    Abbreviated,
  };

  /**
   * This enum class specifies the type of DisplayName to use. It is used in the
   * constructor only as part of the options. The first enum values are for
   * ECMA-402 compliant types, and then the second half are for Mozilla-specific
   * extensions.
   */
  enum class Type {
    /**
     * ECMA-402 compatible types for DisplayNames.
     */

    // Return the localized name of a language.
    //
    // Accepts:
    //  languageCode ["-" scriptCode] ["-" regionCode ] *("-" variant )
    //  Where the language code is:
    //    1. A two letters ISO 639-1 language code
    //         https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
    //    2. A three letters ISO 639-2 language code
    //         https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
    //
    // Examples:
    //  "es-ES" => "European Spanish" (en-US), "español de España" (es-ES)
    //  "zh-Hant" => "Traditional Chinese" (en-US), "chino tradicional" (es-ES)
    //
    Language,
    // Return the localized name of a region,
    //
    // Accepts:
    //  1. an ISO-3166 two letters:
    //      https://www.iso.org/iso-3166-country-codes.html
    //  2. region code, or a three digits UN M49 Geographic Regions.
    //      https://unstats.un.org/unsd/methodology/m49/
    //
    // Examples
    //  "US"  => "United States" (en-US), "Estados Unidos", (es-ES)
    //  "158" => "Taiwan" (en-US), "Taiwán", (es-ES)
    Region,
    // Returns the localized name of a script.
    //
    // Accepts:
    //   ECMA-402 expects the ISO-15924 four letters script code.
    //   https://unicode.org/iso15924/iso15924-codes.html
    //   e.g. "Latn"
    //
    // Examples:
    //   "Cher" => "Cherokee" (en-US), "cherokee" (es-ES)
    //   "Latn" => "Latin" (en-US), "latino" (es-ES)
    Script,
    // Return the localized name of a currency.
    //
    // Accepts:
    //   A 3-letter ISO 4217 currency code.
    //   https://en.wikipedia.org/wiki/ISO_4217
    //
    // Examples:
    //   "EUR" => "Euro" (en-US), "euro" (es_ES), "欧元", (zh)
    //   "JPY" => "Japanese Yen" (en-US), "yen" (es_ES), "日元", (zh)
    Currency,

    /**
     * The following are not part of ECMA 402, but are available as a
     * MozExtension.
     */

    // Get the localized name of a calendar.
    // Accepts:
    //   Unicode calendar key:
    //   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar#unicode_calendar_keys
    Calendar,
    // Get the localized name of a weekday.
    //
    // Accepts:
    //   "1" - "7".
    //
    // Examples:
    //   "1" -> "Monday"
    //   "2" -> "Tuesday"
    Weekday,
    // Get the localized name of a month.
    //
    // Accepts:
    //   "1" - "12".
    //
    // Examples:
    //   "1" -> "January"
    //   "2" -> "February"
    Month,
    // Get the localized name of a quarter.
    //
    // Accepts:
    //   "1" - "4".
    //
    // Examples:
    //   "1" -> "1st quarter"
    //   "2" -> "2nd quarter"
    Quarter,
    // Get the localized name of a day period.
    //
    // Accepts:
    //   "am", "pm"
    //
    // Examples:
    //   "am" -> "a.m."
    //   "pm" -> "p.m."
    DayPeriod,
    // Get the localized name of a date time field.
    // Accepts:
    //    "era", "year", "quarter", "month", "weekOfYear", "weekday", "day",
    //    "dayPeriod", "hour", "minute", "second", "timeZoneName"
    // Examples:
    //   "weekday" => "day of the week"
    //   "dayPeriod" => "AM/PM"
    DateTimeField,
  };

  /**
   * Get a static string of the DisplayNames::Type that matches the equivalent
   * ECMA-402 option.
   */
  static const char* ToString(DisplayNames::Type type);

  enum class LanguageDisplay {
    Standard,
    Dialect,
  };

  /**
   * Determines the fallback behavior if no match is found for DisplayNames::Of.
   */
  enum class Fallback {
    // The buffer will contain an empty string.
    None,
    // The buffer will contain the code, but typically in a canonicalized form.
    Code
  };

  /**
   * These options map to ECMA 402 DisplayNames options. Make sure the defaults
   * map to the default initialized values of ECMA 402.
   *
   * Note that fallbacking is not currently implemented here in the unified API,
   * but is still handled in SpiderMonkey. This is due to support for the
   * LanguageTag. See Bug 1719746.
   *
   * https://tc39.es/ecma402/#intl-displaynames-objects
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames
   */
  struct Options {
    // The constructor ensures the required Type option is created.
    explicit Options(Type aType) : type(aType){};
    Options() = delete;

    // Required:
    Type type;

    // Optional:
    Style style = Style::Long;
    LanguageDisplay languageDisplay = LanguageDisplay::Standard;
    Span<const char> calendar;  // MozExtension, not part of ECMA-402.
  };

  DisplayNames(ULocaleDisplayNames* aDisplayNames, Span<const char> aLocale,
               Options aOptions)
      : mOptions(aOptions),
        mLocale(aLocale.data(), aLocale.size()),
        mULocaleDisplayNames(aDisplayNames) {
    MOZ_ASSERT(aDisplayNames);
  };

  /**
   * Initialize a new DisplayNames for the provided locale and using the
   * provided options.
   *
   * https://tc39.es/ecma402/#sec-Intl.DisplayNames
   */
  static Result<UniquePtr<DisplayNames>, ICUError> TryCreate(
      const char* aLocale, Options aOptions);

  // Not copyable or movable
  DisplayNames(const DisplayNames&) = delete;
  DisplayNames& operator=(const DisplayNames&) = delete;

  ~DisplayNames();

  /**
   * Easily convert to a more specific DisplayNames error.
   */
  DisplayNamesError ToError(ICUError aError) const;

  /**
   * Easily convert to a more specific DisplayNames error.
   */
  DisplayNamesError ToError(Locale::CanonicalizationError aError) const;

  /**
   * Get the results for a display name given a code. The code is specific to
   * the type of display name being requested.
   *
   * https://tc39.es/ecma402/#sec-Intl.DisplayNames.prototype.of
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/of
   */
  template <typename B>
  Result<Ok, DisplayNamesError> Of(B& aBuffer, Span<const char> aCode,
                                   Fallback aFallback = Fallback::None) {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
    switch (mOptions.type) {
      // ECMA 402 types:
      case Type::Currency:
        return this->GetCurrency(aBuffer, aCode, aFallback);
      case Type::Language:
        return this->GetLanguage(aBuffer, aCode, aFallback);
      case Type::Script:
        return this->GetScript(aBuffer, aCode, aFallback);
      case Type::Region:
        return this->GetRegion(aBuffer, aCode, aFallback);
      case Type::Calendar:
        return this->GetCalendar(aBuffer, aCode, aFallback);

      // Non-ECMA 402 types (available through MozExtension):
      case Type::Weekday:
        return this->GetWeekday(aBuffer, aCode, aFallback);
      case Type::Month:
        return this->GetMonth(aBuffer, aCode, aFallback);
      case Type::Quarter:
        return this->GetQuarter(aBuffer, aCode, aFallback);
      case Type::DayPeriod:
        return this->GetDayPeriod(aBuffer, aCode, aFallback);
      case Type::DateTimeField:
        return this->GetDateTimeField(aBuffer, aCode, aFallback);
    }
    MOZ_ASSERT_UNREACHABLE();
    return Err(DisplayNamesError::InternalError);
  }

 private:
  template <typename B, typename Fn>
  static Result<Ok, DisplayNamesError> HandleFallback(B& aBuffer,
                                                      Fallback aFallback,
                                                      Fn aGetFallbackSpan) {
    if (aBuffer.length() == 0 &&
        aFallback == mozilla::intl::DisplayNames::Fallback::Code) {
      if (!FillBuffer(aGetFallbackSpan(), aBuffer)) {
        return Err(DisplayNamesError::OutOfMemory);
      }
    }
    return Ok();
  }

  /**
   * This is a specialized form of the FillBufferWithICUCall for DisplayNames.
   * Different APIs report that no display name is found with different
   * statuses. This method signals no display name was found by setting the
   * buffer to 0.
   *
   * The display name APIs such as `uldn_scriptDisplayName`,
   * `uloc_getDisplayScript`, and `uldn_regionDisplayName` report
   * U_ILLEGAL_ARGUMENT_ERROR when no display name was found. In order to
   * accomodate fallbacking, return an empty string in this case.
   */
  template <typename B, typename F>
  static ICUResult FillBufferWithICUDisplayNames(
      B& aBuffer, UErrorCode aNoDisplayNameStatus, F aCallback) {
    return FillBufferWithICUCall(
        aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
          int32_t res = aCallback(target, length, status);

          if (*status == aNoDisplayNameStatus) {
            *status = U_ZERO_ERROR;
            res = 0;
          }
          return res;
        });
  }

  Result<Ok, DisplayNamesError> ComputeDateTimeDisplayNames(
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

    Span<const char> calendar = mOptions.calendar.empty()
                                    ? MakeStringSpan("gregory")
                                    : mOptions.calendar;

    // Add the calendar extension to the locale.
    Vector<char, 32> extension;
    Span<const char> prefix = MakeStringSpan("u-ca-");
    if (!extension.append(prefix.data(), prefix.size()) ||
        !extension.append(calendar.data(), calendar.size()) ||
        !extension.append('\0')) {
      return Err(DisplayNamesError::OutOfMemory);
    }
    if (!tag.setUnicodeExtension(extension.begin())) {
      return Err(DisplayNamesError::InternalError);
    };

    constexpr char16_t* timeZone = nullptr;
    constexpr int32_t timeZoneLength = 0;

    constexpr char16_t* pattern = nullptr;
    constexpr int32_t patternLength = 0;

    Vector<char, 32> localeWithCalendar;
    VectorToBufferAdaptor buffer(localeWithCalendar);
    if (auto result = tag.toString(buffer); result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }

    UErrorCode status = U_ZERO_ERROR;
    UDateFormat* fmt = udat_open(
        UDAT_DEFAULT, UDAT_DEFAULT, IcuLocale(localeWithCalendar.begin()),
        timeZone, timeZoneLength, pattern, patternLength, &status);
    if (U_FAILURE(status)) {
      return Err(DisplayNamesError::InternalError);
    }
    ScopedICUObject<UDateFormat, udat_close> datToClose(fmt);

    Vector<char16_t, 32> name;
    for (uint32_t i = 0; i < indices.size(); i++) {
      int32_t index = indices[i];
      auto result = FillBufferWithICUCall(
          name, [&](UChar* target, int32_t length, UErrorCode* status) {
            return udat_getSymbols(fmt, symbolType, index, target, length,
                                   status);
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

  /**
   * Get the display names for Apply the DisplayNames::Type::Language.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetLanguage(B& aBuffer,
                                            Span<const char> aLanguage,
                                            Fallback aFallback) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
    mozilla::intl::Locale tag;
    if (LocaleParser::tryParseBaseName(aLanguage, tag).isErr()) {
      return Err(DisplayNamesError::InvalidOption);
    }

    {
      // ICU always canonicalizes the input locale, but since we know that ICU's
      // canonicalization is incomplete, we need to perform our own
      // canonicalization to ensure consistent result.
      auto result = tag.canonicalizeBaseName();
      if (result.isErr()) {
        return Err(ToError(result.unwrapErr()));
      }
    }

    Vector<char, 32> tagVec;
    {
      VectorToBufferAdaptor tagBuffer(tagVec);
      auto result = tag.toString(tagBuffer);
      if (result.isErr()) {
        return Err(ToError(result.unwrapErr()));
      }
      if (!tagVec.append('\0')) {
        // The tag should be null terminated.
        return Err(DisplayNamesError::OutOfMemory);
      }
    }

    auto result = FillBufferWithICUDisplayNames(
        aBuffer, U_ILLEGAL_ARGUMENT_ERROR,
        [&](UChar* target, int32_t length, UErrorCode* status) {
          return uldn_localeDisplayName(mULocaleDisplayNames.GetConst(),
                                        tagVec.begin(), target, length, status);
        });
    if (result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }

    return HandleFallback(aBuffer, aFallback, [&] {
      // Remove the null terminator.
      return Span(tagVec.begin(), tagVec.length() - 1);
    });
  };

  /**
   * Get the display names for Apply the DisplayNames::Type::Region.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetRegion(B& aBuffer, Span<const char> aCode,
                                          Fallback aFallback) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);

    mozilla::intl::RegionSubtag region;
    if (!IsStructurallyValidRegionTag(aCode)) {
      return Err(DisplayNamesError::InvalidOption);
    }
    region.set(aCode);

    mozilla::intl::Locale tag;
    tag.setLanguage("und");
    tag.setRegion(region);

    {
      // ICU always canonicalizes the input locale, but since we know that ICU's
      // canonicalization is incomplete, we need to perform our own
      // canonicalization to ensure consistent result.
      auto result = tag.canonicalizeBaseName();
      if (result.isErr()) {
        return Err(ToError(result.unwrapErr()));
      }
    }

    MOZ_ASSERT(tag.region().present());

    // Note: ICU requires the region subtag to be in canonical case.
    const mozilla::intl::RegionSubtag& canonicalRegion = tag.region();

    char regionChars[mozilla::intl::LanguageTagLimits::RegionLength + 1] = {};
    std::copy_n(canonicalRegion.span().data(), canonicalRegion.length(),
                regionChars);

    auto result = FillBufferWithICUDisplayNames(
        aBuffer, U_ILLEGAL_ARGUMENT_ERROR,
        [&](UChar* chars, uint32_t size, UErrorCode* status) {
          return uldn_regionDisplayName(
              mULocaleDisplayNames.GetConst(), regionChars, chars,
              AssertedCast<int32_t, uint32_t>(size), status);
        });

    if (result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }

    if (aBuffer.length() == 0 && aFallback == Fallback::Code) {
      // Fallback to the case-canonicalized input.
      region.toUpperCase();
      if (!FillBuffer(region.span(), aBuffer)) {
        return Err(DisplayNamesError::OutOfMemory);
      }
    }

    return Ok();
  }

  /**
   * Given an ASCII alpha, convert it to upper case.
   */
  static inline char16_t AsciiAlphaToUpperCase(char16_t aCh) {
    MOZ_ASSERT(aCh >= 'a' && aCh <= 'z');
    return aCh - ('a' - 'A');
  }

  /**
   * Get the display names for Apply the DisplayNames::Type::Currency.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetCurrency(B& aBuffer,
                                            Span<const char> aCurrency,
                                            Fallback aFallback) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
    if (aCurrency.size() != 3) {
      return Err(DisplayNamesError::InvalidOption);
    }

    if (!mozilla::IsAsciiAlpha(aCurrency[0]) ||
        !mozilla::IsAsciiAlpha(aCurrency[1]) ||
        !mozilla::IsAsciiAlpha(aCurrency[2])) {
      return Err(DisplayNamesError::InvalidOption);
    }

    // Normally this type of operation wouldn't be safe, but ASCII characters
    // all take 1 byte in UTF-8 encoding, and can be zero padded to be valid
    // UTF-16. Currency codes are all three ASCII letters.
    char16_t currency[] = {static_cast<char16_t>(aCurrency[0]),
                           static_cast<char16_t>(aCurrency[1]),
                           static_cast<char16_t>(aCurrency[2]), u'\0'};

    UCurrNameStyle style;
    switch (mOptions.style) {
      case Style::Long:
        style = UCURR_LONG_NAME;
        break;
      case Style::Abbreviated:
      case Style::Short:
        style = UCURR_SYMBOL_NAME;
        break;
      case Style::Narrow:
        style = UCURR_NARROW_SYMBOL_NAME;
        break;
    }

    int32_t length = 0;
    UErrorCode status = U_ZERO_ERROR;
    const char16_t* name = ucurr_getName(currency, mLocale.data(), style,
                                         nullptr, &length, &status);
    if (U_FAILURE(status)) {
      return Err(DisplayNamesError::InternalError);
    }

    if (status == U_USING_DEFAULT_WARNING) {
      // A resource bundle lookup returned a result from the root locale.
      if (aFallback == DisplayNames::Fallback::Code) {
        // Return the canonicalized input when no localized currency name was
        // found. Canonical case for currency is upper case.
        if (!aBuffer.reserve(3)) {
          return Err(DisplayNamesError::OutOfMemory);
        }
        aBuffer.data()[0] = AsciiAlphaToUpperCase(currency[0]);
        aBuffer.data()[1] = AsciiAlphaToUpperCase(currency[1]);
        aBuffer.data()[2] = AsciiAlphaToUpperCase(currency[2]);
        aBuffer.written(3);
      } else if (aBuffer.length() != 0) {
        // Ensure an empty string is in the buffer when there is no fallback.
        aBuffer.written(0);
      }
      return Ok();
    }

    // Write out the name to the buffer.
    size_t amount = length;
    aBuffer.reserve(amount);
    for (size_t i = 0; i < amount; i++) {
      aBuffer.data()[i] = name[i];
    }
    aBuffer.written(amount);

    return Ok();
  }

  // Vector to hold a "und-Latn" style language code + script.
  // Total length: 9 ("und-" 4) + ("Latn" 4) + ("\0" 1)
  using ScriptLocaleVector = Vector<char, 9>;

  /**
   * Get the display names for Apply the DisplayNames::Type::Script.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetScript(B& aBuffer, Span<const char> aScript,
                                          Fallback aFallback) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
    mozilla::intl::ScriptSubtag script;
    if (!IsStructurallyValidScriptTag(aScript)) {
      return Err(DisplayNamesError::InvalidOption);
    }
    script.set(aScript);

    mozilla::intl::Locale tag;
    tag.setLanguage("und");

    tag.setScript(script);

    {
      // ICU always canonicalizes the input locale, but since we know that ICU's
      // canonicalization is incomplete, we need to perform our own
      // canonicalization to ensure consistent result.
      auto result = tag.canonicalizeBaseName();
      if (result.isErr()) {
        return Err(ToError(result.unwrapErr()));
      }
    }

    MOZ_ASSERT(tag.script().present());
    mozilla::Vector<char, 32> tagString;
    VectorToBufferAdaptor buffer(tagString);

    switch (mOptions.style) {
      case Style::Long: {
        // doesn't use the stand-alone form for script subtags.
        //
        // ICU bug: https://unicode-org.atlassian.net/browse/ICU-9301

        // |uloc_getDisplayScript| expects a full locale identifier as its
        // input.
        if (auto result = tag.toString(buffer); result.isErr()) {
          return Err(ToError(result.unwrapErr()));
        }

        // Null terminate the tag string.
        if (!tagString.append('\0')) {
          return Err(DisplayNamesError::OutOfMemory);
        }

        auto result = FillBufferWithICUDisplayNames(
            aBuffer, U_USING_DEFAULT_WARNING,
            [&](UChar* target, int32_t length, UErrorCode* status) {
              return uloc_getDisplayScript(tagString.begin(), mLocale.data(),
                                           target, length, status);
            });

        if (result.isErr()) {
          return Err(ToError(result.unwrapErr()));
        }
        break;
      }
      case Style::Abbreviated:
      case Style::Short:
      case Style::Narrow: {
        // Note: ICU requires the script subtag to be in canonical case.
        const mozilla::intl::ScriptSubtag& canonicalScript = tag.script();

        char scriptChars[mozilla::intl::LanguageTagLimits::ScriptLength + 1] =
            {};
        MOZ_ASSERT(canonicalScript.length() <=
                   mozilla::intl::LanguageTagLimits::ScriptLength + 1);
        std::copy_n(canonicalScript.span().data(), canonicalScript.length(),
                    scriptChars);

        auto result = FillBufferWithICUDisplayNames(
            aBuffer, U_ILLEGAL_ARGUMENT_ERROR,
            [&](UChar* target, int32_t length, UErrorCode* status) {
              return uldn_scriptDisplayName(mULocaleDisplayNames.GetConst(),
                                            scriptChars, target, length,
                                            status);
            });

        if (result.isErr()) {
          return Err(ToError(result.unwrapErr()));
        }
        break;
      }
    }

    return HandleFallback(aBuffer, aFallback, [&] {
      script.toTitleCase();
      return script.span();
    });
  };

  /**
   * Get the display names for DisplayNames::Type::Calendar.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetCalendar(B& aBuffer,
                                            Span<const char> aCalendar,
                                            Fallback aFallback) const {
    if (aCalendar.empty() || !IsAscii(aCalendar)) {
      return Err(DisplayNamesError::InvalidOption);
    }

    if (LocaleParser::canParseUnicodeExtensionType(aCalendar).isErr()) {
      return Err(DisplayNamesError::InvalidOption);
    }

    Vector<char, 16> lowerCaseCalendar;
    for (size_t i = 0; i < aCalendar.size(); i++) {
      if (!lowerCaseCalendar.append(AsciiToLowerCase(aCalendar[i]))) {
        return Err(DisplayNamesError::OutOfMemory);
      }
    }
    if (!lowerCaseCalendar.append('\0')) {
      return Err(DisplayNamesError::OutOfMemory);
    }

    Span<const char> canonicalCalendar = mozilla::Span(
        lowerCaseCalendar.begin(), lowerCaseCalendar.length() - 1);

    // Search if there's a replacement for the Unicode calendar keyword.
    {
      Span<const char> key = mozilla::MakeStringSpan("ca");
      Span<const char> type = canonicalCalendar;
      if (const char* replacement =
              mozilla::intl::Locale::replaceUnicodeExtensionType(key, type)) {
        canonicalCalendar = Span(replacement, strlen(replacement));
      }
    }

    // The input calendar name is user-controlled, so be extra cautious before
    // passing arbitrarily large strings to ICU.
    static constexpr size_t maximumCalendarLength = 100;

    if (canonicalCalendar.size() <= maximumCalendarLength) {
      // |uldn_keyValueDisplayName| expects old-style keyword values.
      if (const char* legacyCalendar =
              uloc_toLegacyType("calendar", canonicalCalendar.Elements())) {
        auto result = FillBufferWithICUDisplayNames(
            aBuffer, U_ILLEGAL_ARGUMENT_ERROR,
            [&](UChar* chars, uint32_t size, UErrorCode* status) {
              // |uldn_keyValueDisplayName| expects old-style keyword values.
              return uldn_keyValueDisplayName(mULocaleDisplayNames.GetConst(),
                                              "calendar", legacyCalendar, chars,
                                              size, status);
            });
        if (result.isErr()) {
          return Err(ToError(result.unwrapErr()));
        }
      }
    } else {
      aBuffer.written(0);
    }

    return HandleFallback(aBuffer, aFallback,
                          [&] { return canonicalCalendar; });
  }

  /**
   * Validate an ASCII string as a number 1-99.
   */
  static Maybe<uint8_t> ValidateDisplayNamesNumber(Span<const char> aNumber,
                                                   uint8_t aMax) {
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

  /**
   * Get the display names for DisplayNames::Type::Weekday.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetWeekday(B& aBuffer,
                                           Span<const char> aWeekday,
                                           Fallback aFallback) {
    Maybe<uint8_t> weekday = ValidateDisplayNamesNumber(aWeekday, 7);
    if (weekday.isNothing()) {
      return Err(DisplayNamesError::InvalidOption);
    }

    UDateFormatSymbolType symbolType;
    switch (mOptions.style) {
      case DisplayNames::Style::Long:
        symbolType = UDAT_STANDALONE_WEEKDAYS;
        break;

      case DisplayNames::Style::Abbreviated:
        // ICU "short" is CLDR "abbreviated" format.
        symbolType = UDAT_STANDALONE_SHORT_WEEKDAYS;
        break;

      case DisplayNames::Style::Short:
        // ICU "shorter" is CLDR "short" format.
        symbolType = UDAT_STANDALONE_SHORTER_WEEKDAYS;
        break;

      case DisplayNames::Style::Narrow:
        symbolType = UDAT_STANDALONE_NARROW_WEEKDAYS;
        break;
    }

    static constexpr int32_t indices[] = {
        UCAL_MONDAY, UCAL_TUESDAY,  UCAL_WEDNESDAY, UCAL_THURSDAY,
        UCAL_FRIDAY, UCAL_SATURDAY, UCAL_SUNDAY};

    if (auto result =
            ComputeDateTimeDisplayNames(symbolType, mozilla::Span(indices));
        result.isErr()) {
      return result.propagateErr();
    }
    MOZ_ASSERT(mDateTimeDisplayNames.length() == std::size(indices));

    auto& name = mDateTimeDisplayNames[weekday.value() - 1];
    if (!FillBuffer(Span(name.data(), name.size()), aBuffer)) {
      return Err(DisplayNamesError::OutOfMemory);
    }

    // There is no need to fallback, as invalid options are
    // DisplayNamesError::InvalidOption.
    return Ok();
  }

  /**
   * Get the display names for DisplayNames::Type::Month.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetMonth(B& aBuffer, Span<const char> aMonth,
                                         Fallback aFallback) {
    Maybe<uint8_t> month = ValidateDisplayNamesNumber(aMonth, 12);
    if (month.isNothing()) {
      return Err(DisplayNamesError::InvalidOption);
    }

    UDateFormatSymbolType symbolType;
    switch (mOptions.style) {
      case DisplayNames::Style::Long:
        symbolType = UDAT_STANDALONE_MONTHS;
        break;

      case DisplayNames::Style::Abbreviated:
      case DisplayNames::Style::Short:
        symbolType = UDAT_STANDALONE_SHORT_MONTHS;
        break;

      case DisplayNames::Style::Narrow:
        symbolType = UDAT_STANDALONE_NARROW_MONTHS;
        break;
    }

    static constexpr int32_t indices[] = {
        UCAL_JANUARY,   UCAL_FEBRUARY, UCAL_MARCH,    UCAL_APRIL,
        UCAL_MAY,       UCAL_JUNE,     UCAL_JULY,     UCAL_AUGUST,
        UCAL_SEPTEMBER, UCAL_OCTOBER,  UCAL_NOVEMBER, UCAL_DECEMBER,
        UCAL_UNDECIMBER};

    if (auto result =
            ComputeDateTimeDisplayNames(symbolType, mozilla::Span(indices));
        result.isErr()) {
      return result.propagateErr();
    }
    MOZ_ASSERT(mDateTimeDisplayNames.length() == std::size(indices));

    auto& name = mDateTimeDisplayNames[month.value() - 1];
    if (!FillBuffer(Span(name.data(), name.size()), aBuffer)) {
      return Err(DisplayNamesError::OutOfMemory);
    }

    // There is no need to fallback, as invalid options are
    // DisplayNamesError::InvalidOption.
    return Ok();
  }

  /**
   * Get the display names for DisplayNames::Type::Quarter.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetQuarter(B& aBuffer, Span<const char> aMonth,
                                           Fallback aFallback) {
    Maybe<uint8_t> quarter = ValidateDisplayNamesNumber(aMonth, 4);
    if (quarter.isNothing()) {
      return Err(DisplayNamesError::InvalidOption);
    }

    UDateFormatSymbolType symbolType;
    switch (mOptions.style) {
      case DisplayNames::Style::Long:
        symbolType = UDAT_STANDALONE_QUARTERS;
        break;

      case DisplayNames::Style::Abbreviated:
      case DisplayNames::Style::Short:
      case DisplayNames::Style::Narrow:
        // CLDR "narrow" style not supported in ICU.
        symbolType = UDAT_STANDALONE_SHORT_QUARTERS;
        break;
    }

    // ICU doesn't provide an enum for quarters.
    static constexpr int32_t indices[] = {0, 1, 2, 3};

    if (auto result =
            ComputeDateTimeDisplayNames(symbolType, mozilla::Span(indices));
        result.isErr()) {
      return result.propagateErr();
    }
    MOZ_ASSERT(mDateTimeDisplayNames.length() == std::size(indices));

    auto& name = mDateTimeDisplayNames[quarter.value() - 1];
    if (!FillBuffer(Span(name.data(), name.size()), aBuffer)) {
      return Err(DisplayNamesError::OutOfMemory);
    }

    // There is no need to fallback, as invalid options are
    // DisplayNamesError::InvalidOption.
    return Ok();
  }

  /**
   * Get the display names for DisplayNames::Type::DayPeriod.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetDayPeriod(B& aBuffer,
                                             Span<const char> aDayPeriod,
                                             Fallback aFallback) {
    uint32_t index;
    if (aDayPeriod == MakeStringSpan("am")) {
      index = 0;
    } else if (aDayPeriod == MakeStringSpan("pm")) {
      index = 1;
    } else {
      return Err(DisplayNamesError::InvalidOption);
    }

    UDateFormatSymbolType symbolType = UDAT_AM_PMS;

    static constexpr int32_t indices[] = {UCAL_AM, UCAL_PM};

    if (auto result =
            ComputeDateTimeDisplayNames(symbolType, mozilla::Span(indices));
        result.isErr()) {
      return result.propagateErr();
    }
    MOZ_ASSERT(mDateTimeDisplayNames.length() == std::size(indices));

    auto& name = mDateTimeDisplayNames[index];
    if (!FillBuffer(Span(name.data(), name.size()), aBuffer)) {
      return Err(DisplayNamesError::OutOfMemory);
    }

    // There is no need to fallback, as invalid options are
    // DisplayNamesError::InvalidOption.
    return Ok();
  }

  /**
   * Get the display names for DisplayNames::Type::DayPeriod.
   */
  template <typename B>
  Result<Ok, DisplayNamesError> GetDateTimeField(B& aBuffer,
                                                 Span<const char> aField,
                                                 Fallback aFallback) {
    UDateTimePatternField field;
    if (aField == MakeStringSpan("era")) {
      field = UDATPG_ERA_FIELD;
    } else if (aField == MakeStringSpan("year")) {
      field = UDATPG_YEAR_FIELD;
    } else if (aField == MakeStringSpan("quarter")) {
      field = UDATPG_QUARTER_FIELD;
    } else if (aField == MakeStringSpan("month")) {
      field = UDATPG_MONTH_FIELD;
    } else if (aField == MakeStringSpan("weekOfYear")) {
      field = UDATPG_WEEK_OF_YEAR_FIELD;
    } else if (aField == MakeStringSpan("weekday")) {
      field = UDATPG_WEEKDAY_FIELD;
    } else if (aField == MakeStringSpan("day")) {
      field = UDATPG_DAY_FIELD;
    } else if (aField == MakeStringSpan("dayPeriod")) {
      field = UDATPG_DAYPERIOD_FIELD;
    } else if (aField == MakeStringSpan("hour")) {
      field = UDATPG_HOUR_FIELD;
    } else if (aField == MakeStringSpan("minute")) {
      field = UDATPG_MINUTE_FIELD;
    } else if (aField == MakeStringSpan("second")) {
      field = UDATPG_SECOND_FIELD;
    } else if (aField == MakeStringSpan("timeZoneName")) {
      field = UDATPG_ZONE_FIELD;
    } else {
      return Err(DisplayNamesError::InvalidOption);
    }

    UDateTimePGDisplayWidth width;
    switch (mOptions.style) {
      case DisplayNames::Style::Long:
        width = UDATPG_WIDE;
        break;
      case DisplayNames::Style::Abbreviated:
      case DisplayNames::Style::Short:
        width = UDATPG_ABBREVIATED;
        break;
      case DisplayNames::Style::Narrow:
        width = UDATPG_NARROW;
        break;
    }

    // This is the only method that needs a date time pattern generator. Lazily
    // create one here.
    if (!mUDateTimePatternGen) {
      UErrorCode status = U_ZERO_ERROR;
      mUDateTimePatternGen = udatpg_open(mLocale.data(), &status);
      if (U_FAILURE(status)) {
        return Err(ToError(ToICUError(status)));
      }
    }

    auto result = FillBufferWithICUCall(
        aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
          return udatpg_getFieldDisplayName(mUDateTimePatternGen, field, width,
                                            target, length, status);
        });

    if (result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }
    // There is no need to fallback, as invalid options are
    // DisplayNamesError::InvalidOption.
    return Ok();
  }

  Options mOptions;
  std::string mLocale;
  Vector<std::u16string> mDateTimeDisplayNames;
  ICUPointer<ULocaleDisplayNames> mULocaleDisplayNames =
      ICUPointer<ULocaleDisplayNames>(nullptr);

  // Only lazily construct the date time pattern generator. This is only used
  // for the Type::DateTimeField, which is not part of ECMA 402.
  UDateTimePatternGenerator* mUDateTimePatternGen = nullptr;
};

}  // namespace mozilla::intl

#endif
