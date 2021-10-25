/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef intl_components_DisplayNames_h_
#define intl_components_DisplayNames_h_

#include "unicode/uldnames.h"
#include "unicode/uloc.h"
#include "unicode/ucurr.h"
#include "mozilla/intl/ICU4CGlue.h"
#include "mozilla/intl/Locale.h"
#include "mozilla/Casting.h"
#include "mozilla/Result.h"
#include "mozilla/ResultVariant.h"
#include "mozilla/Span.h"
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

class DisplayNames final {
 public:
  enum class LocaleMatcher {
    Lookup,
    BestFit,
  };

  enum class Style {
    Narrow,
    Short,
    Long,
    // Note: Abbreviated is not part of ECMA-402, but it is available for
    // internal Mozilla usage.
    Abbreviated,
  };

  enum class Type {
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

    Calendar,
    Weekday,
    Month,
    Quarter,
    DayPeriod,
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

  enum class Fallback { None, Code };

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
  };

  DisplayNames(ULocaleDisplayNames* aDisplayNames, Span<const char> aLocale,
               Options aOptions)
      : mOptions(aOptions),
        mLocale(aLocale.data(), aLocale.size()),
        mULocaleDisplayNames(aDisplayNames) {
    MOZ_ASSERT(aDisplayNames);
  };

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

  static bool SupportsUtf8(DisplayNames::Type aType);

  /**
   * Get the results for a display name.
   *
   * https://tc39.es/ecma402/#sec-Intl.DisplayNames.prototype.of
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/of
   *
   * Note that this function can take either a `char` or `char16_t` CharType.
   * This was done to ensure there is a single public DisplayName::Of method
   * exposed for computing everything. However, the underlying ICU4C calls may
   * require one type or another. Rather than introduce extraneous string
   * copying, this method enforces the correct CharType through a template.
   *
   * Use the `DisplayNames::SupportsUtf8()` method to determine which type of
   * buffer to use.
   *
   * In the future, if we switch from ICU4C to ICU4X, this will most likely
   * always require a `char` type.
   */
  template <typename B, typename CharType>
  Result<Ok, DisplayNamesError> Of(B& aBuffer, Span<const CharType> aCode,
                                   Fallback aFallback = Fallback::None) const {
    if constexpr (std::is_same<CharType, char>::value) {
      switch (mOptions.type) {
        case Type::Language:
          return this->GetLanguage(aBuffer, aCode, aFallback);
        case Type::Region: {
          auto result = ToResult(this->GetRegion(aBuffer, aCode));
          if (result.isOk()) {
            return Ok();
          } else {
            return Err(ToError(result.unwrapErr()));
          }
        }
        case Type::Script: {
          auto result = ToResult(this->GetScript(aBuffer, aCode));
          if (result.isOk()) {
            return Ok();
          } else {
            return Err(ToError(result.unwrapErr()));
          }
        }
        case Type::Currency:
          MOZ_ASSERT_UNREACHABLE("Type requires a char CharType.");
      }
    }
    if constexpr (std::is_same<CharType, char16_t>::value) {
      switch (mOptions.type) {
        case Type::Currency: {
          auto result = ToResult(this->GetCurrency(aBuffer, aCode));
          if (result.isOk()) {
            return Ok();
          } else {
            return Err(ToError(result.unwrapErr()));
          }
        }
        case Type::Language:
        case Type::Region:
        case Type::Script:
          MOZ_ASSERT_UNREACHABLE("Type requires a char16_t CharType.");
      }
    }
    MOZ_ASSERT_UNREACHABLE();
    return Err(DisplayNamesError::InternalError);
  }

 private:
  /**
   * This is a specialized form of the FillBufferWithICUCall for DisplayNames.
   *
   * The display name APIs such as `uldn_scriptDisplayName`,
   * `uloc_getDisplayScript`, and `uldn_regionDisplayName` report
   * U_ILLEGAL_ARGUMENT_ERROR when no display name was found. In order to
   * accomodate fallbacking, return an empty string in this case.
   */
  template <typename B, typename F>
  static ICUResult FillBufferWithICUDisplayNames(B& aBuffer, F aCallback) {
    return FillBufferWithICUCall(
        aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
          int32_t res = aCallback(target, length, status);

          if (*status == U_ILLEGAL_ARGUMENT_ERROR) {
            *status = U_ZERO_ERROR;
          }
          return res;
        });
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
        aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
          return uldn_localeDisplayName(mULocaleDisplayNames.GetConst(),
                                        tagVec.begin(), target, length, status);
        });
    if (result.isErr()) {
      return Err(ToError(result.unwrapErr()));
    }

    if (aBuffer.length() == 0 && aFallback == Fallback::Code) {
      // The language was empty, fallback to the Fallback code.
      if (!aBuffer.reserve(tagVec.length())) {
        return Err(DisplayNamesError::OutOfMemory);
      }
      for (size_t i = 0; i < tagVec.length(); i++) {
        aBuffer.data()[i] = tagVec.begin()[i];
      }
      // Do not include the null termination in the written amount.
      aBuffer.written(tagVec.length() - 1);
    }

    return Ok();
  };

  /**
   * Get the display names for Apply the DisplayNames::Type::Region.
   */
  template <typename B>
  ICUResult GetRegion(B& aBuffer, Span<const char> aRegion) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);

    return FillBufferWithICUDisplayNames(
        aBuffer, [&](UChar* chars, uint32_t size, UErrorCode* status) {
          return uldn_regionDisplayName(
              mULocaleDisplayNames.GetConst(),
              AssertNullTerminatedString(aRegion), chars,
              AssertedCast<int32_t, uint32_t>(size), status);
        });
  }

  /**
   * Get the display names for Apply the DisplayNames::Type::Currency.
   *
   * Note that this function requires a `const char16_t` for the currency. This
   * is done to match the underlying ICU4C call. This may change if we move to
   * ICU4X.
   */
  template <typename B>
  ICUResult GetCurrency(B& aBuffer, Span<const char16_t> aCurrency) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
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
    const char16_t* name =
        ucurr_getName(AssertNullTerminatedString(aCurrency), mLocale.data(),
                      style, nullptr, &length, &status);
    if (U_FAILURE(status)) {
      return Err(ICUError::InternalError);
    }

    if (status == U_USING_DEFAULT_WARNING) {
      // A resource bundle lookup returned a result from the root locale.
      // Do not write to the buffer.
      if (aBuffer.length() != 0) {
        // Ensure an empty string is in the buffer.
        aBuffer.written(0);
      }
      return Ok();
    }

    // Write the name, which is a static string, out to the buffer. This has a
    // small performance cost compared to just returning the reference to the
    // static string, but ensures a consistent DisplayNames::Of API.
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
  ICUResult GetScript(B& aBuffer, Span<const char> aScript) const {
    static_assert(std::is_same<typename B::CharType, char16_t>::value);
    mozilla::intl::ScriptSubtag script;

    if (mOptions.style == DisplayNames::Style::Long) {
      // |uldn_scriptDisplayName| doesn't use the stand-alone form for script
      // subtags, so we're using |uloc_getDisplayScript| instead. (This only
      // applies to the long form.)
      //
      // ICU bug: https://unicode-org.atlassian.net/browse/ICU-9301
      //
      // |uloc_getDisplayScript| expects a full locale identifier as its input.
      // Manually append the script. This could be handled more gracefully with
      // full language tag support. See Bug
      //
      // Total length: 9 ("und-" 4) + ("Latn" 4) + ("\0" 1)
      ScriptLocaleVector locale{};
      if (!ConvertScriptToLocale(locale, aScript)) {
        // In case the locale is not valid, do not write to the buffer to allow
        // for fallbacking.
        return Ok();
      }

      return FillBufferWithICUDisplayNames(
          aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
            return uloc_getDisplayScript(locale.begin(), mLocale.data(), target,
                                         length, status);
          });
    }

    return FillBufferWithICUDisplayNames(
        aBuffer, [&](UChar* target, int32_t length, UErrorCode* status) {
          return uldn_scriptDisplayName(mULocaleDisplayNames.GetConst(),
                                        AssertNullTerminatedString(aScript),
                                        target, length, status);
        });
  };

  [[nodiscard]] static bool ConvertScriptToLocale(ScriptLocaleVector& aLocale,
                                                  Span<const char> aScript);

  Options mOptions;
  std::string mLocale;
  ICUPointer<ULocaleDisplayNames> mULocaleDisplayNames =
      ICUPointer<ULocaleDisplayNames>(nullptr);
};

}  // namespace mozilla::intl

#endif
