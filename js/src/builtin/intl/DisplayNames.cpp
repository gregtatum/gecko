/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: set ts=8 sts=2 et sw=2 tw=80:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Intl.DisplayNames implementation. */

#include "builtin/intl/DisplayNames.h"

#include "mozilla/Assertions.h"
#include "mozilla/intl/DisplayNames.h"
#include "mozilla/Span.h"
#include "mozilla/TextUtils.h"

#include <algorithm>
#include <cstring>
#include <iterator>

#include "jsnum.h"
#include "jspubtd.h"

#include "builtin/intl/CommonFunctions.h"
#include "builtin/intl/FormatBuffer.h"
#include "builtin/intl/StringAsciiChars.h"
#include "builtin/String.h"
#include "gc/AllocKind.h"
#include "gc/FreeOp.h"
#include "gc/Rooting.h"
#include "js/CallArgs.h"
#include "js/Class.h"
#include "js/experimental/Intl.h"     // JS::AddMozDisplayNamesConstructor
#include "js/friend/ErrorMessages.h"  // js::GetErrorMessage, JSMSG_*
#include "js/GCVector.h"
#include "js/PropertyAndElement.h"  // JS_DefineFunctions, JS_DefineProperties
#include "js/PropertyDescriptor.h"
#include "js/PropertySpec.h"
#include "js/Result.h"
#include "js/RootingAPI.h"
#include "js/TypeDecls.h"
#include "js/Utility.h"
#include "vm/GlobalObject.h"
#include "vm/JSAtom.h"
#include "vm/JSContext.h"
#include "vm/JSObject.h"
#include "vm/Printer.h"
#include "vm/Runtime.h"
#include "vm/SelfHosting.h"
#include "vm/Stack.h"
#include "vm/StringType.h"
#include "vm/WellKnownAtom.h"  // js_*_str

#include "vm/JSObject-inl.h"
#include "vm/NativeObject-inl.h"

using namespace js;

using js::intl::IcuLocale;

const JSClassOps DisplayNamesObject::classOps_ = {nullptr, /* addProperty */
                                                  nullptr, /* delProperty */
                                                  nullptr, /* enumerate */
                                                  nullptr, /* newEnumerate */
                                                  nullptr, /* resolve */
                                                  nullptr, /* mayResolve */
                                                  DisplayNamesObject::finalize};

const JSClass DisplayNamesObject::class_ = {
    "Intl.DisplayNames",
    JSCLASS_HAS_RESERVED_SLOTS(DisplayNamesObject::SLOT_COUNT) |
        JSCLASS_HAS_CACHED_PROTO(JSProto_DisplayNames) |
        JSCLASS_FOREGROUND_FINALIZE,
    &DisplayNamesObject::classOps_, &DisplayNamesObject::classSpec_};

const JSClass& DisplayNamesObject::protoClass_ = PlainObject::class_;

static bool displayNames_toSource(JSContext* cx, unsigned argc, Value* vp) {
  CallArgs args = CallArgsFromVp(argc, vp);
  args.rval().setString(cx->names().DisplayNames);
  return true;
}

static const JSFunctionSpec displayNames_static_methods[] = {
    JS_SELF_HOSTED_FN("supportedLocalesOf",
                      "Intl_DisplayNames_supportedLocalesOf", 1, 0),
    JS_FS_END};

static const JSFunctionSpec displayNames_methods[] = {
    JS_SELF_HOSTED_FN("of", "Intl_DisplayNames_of", 1, 0),
    JS_SELF_HOSTED_FN("resolvedOptions", "Intl_DisplayNames_resolvedOptions", 0,
                      0),
    JS_FN(js_toSource_str, displayNames_toSource, 0, 0), JS_FS_END};

static const JSPropertySpec displayNames_properties[] = {
    JS_STRING_SYM_PS(toStringTag, "Intl.DisplayNames", JSPROP_READONLY),
    JS_PS_END};

static bool DisplayNames(JSContext* cx, unsigned argc, Value* vp);

const ClassSpec DisplayNamesObject::classSpec_ = {
    GenericCreateConstructor<DisplayNames, 2, gc::AllocKind::FUNCTION>,
    GenericCreatePrototype<DisplayNamesObject>,
    displayNames_static_methods,
    nullptr,
    displayNames_methods,
    displayNames_properties,
    nullptr,
    ClassSpec::DontDefineConstructor};

enum class DisplayNamesOptions {
  Standard,

  // Calendar display names are no longer available with the current spec
  // proposal text, but may be re-enabled in the future. For our internal use
  // we still need to have them present, so use a feature guard for now.
  EnableMozExtensions,
};

/**
 * Initialize a new Intl.DisplayNames object using the named self-hosted
 * function.
 */
static bool InitializeDisplayNamesObject(JSContext* cx, HandleObject obj,
                                         HandlePropertyName initializer,
                                         HandleValue locales,
                                         HandleValue options,
                                         DisplayNamesOptions dnoptions) {
  FixedInvokeArgs<4> args(cx);

  args[0].setObject(*obj);
  args[1].set(locales);
  args[2].set(options);
  args[3].setBoolean(dnoptions == DisplayNamesOptions::EnableMozExtensions);

  RootedValue ignored(cx);
  if (!CallSelfHostedFunction(cx, initializer, NullHandleValue, args,
                              &ignored)) {
    return false;
  }

  MOZ_ASSERT(ignored.isUndefined(),
             "Unexpected return value from non-legacy Intl object initializer");
  return true;
}

/**
 * Intl.DisplayNames ([ locales [ , options ]])
 */
static bool DisplayNames(JSContext* cx, const CallArgs& args,
                         DisplayNamesOptions dnoptions) {
  // Step 1.
  if (!ThrowIfNotConstructing(cx, args, "Intl.DisplayNames")) {
    return false;
  }

  // Step 2 (Inlined 9.1.14, OrdinaryCreateFromConstructor).
  RootedObject proto(cx);
  if (dnoptions == DisplayNamesOptions::Standard) {
    if (!GetPrototypeFromBuiltinConstructor(cx, args, JSProto_DisplayNames,
                                            &proto)) {
      return false;
    }
  } else {
    RootedObject newTarget(cx, &args.newTarget().toObject());
    if (!GetPrototypeFromConstructor(cx, newTarget, JSProto_Null, &proto)) {
      return false;
    }
  }

  Rooted<DisplayNamesObject*> displayNames(cx);
  displayNames = NewObjectWithClassProto<DisplayNamesObject>(cx, proto);
  if (!displayNames) {
    return false;
  }

  HandleValue locales = args.get(0);
  HandleValue options = args.get(1);

  // Steps 3-26.
  if (!InitializeDisplayNamesObject(cx, displayNames,
                                    cx->names().InitializeDisplayNames, locales,
                                    options, dnoptions)) {
    return false;
  }

  // Step 27.
  args.rval().setObject(*displayNames);
  return true;
}

static bool DisplayNames(JSContext* cx, unsigned argc, Value* vp) {
  CallArgs args = CallArgsFromVp(argc, vp);
  return DisplayNames(cx, args, DisplayNamesOptions::Standard);
}

static bool MozDisplayNames(JSContext* cx, unsigned argc, Value* vp) {
  CallArgs args = CallArgsFromVp(argc, vp);
  return DisplayNames(cx, args, DisplayNamesOptions::EnableMozExtensions);
}

void js::DisplayNamesObject::finalize(JSFreeOp* fop, JSObject* obj) {
  MOZ_ASSERT(fop->onMainThread());

  if (mozilla::intl::DisplayNames* displayNames =
          obj->as<DisplayNamesObject>().getDisplayNames()) {
    intl::RemoveICUCellMemory(fop, obj, DisplayNamesObject::EstimatedMemoryUse);
    delete displayNames;
  }
}

bool JS::AddMozDisplayNamesConstructor(JSContext* cx, HandleObject intl) {
  RootedObject ctor(cx, GlobalObject::createConstructor(
                            cx, MozDisplayNames, cx->names().DisplayNames, 2));
  if (!ctor) {
    return false;
  }

  RootedObject proto(
      cx, GlobalObject::createBlankPrototype<PlainObject>(cx, cx->global()));
  if (!proto) {
    return false;
  }

  if (!LinkConstructorAndPrototype(cx, ctor, proto)) {
    return false;
  }

  if (!JS_DefineFunctions(cx, ctor, displayNames_static_methods)) {
    return false;
  }

  if (!JS_DefineFunctions(cx, proto, displayNames_methods)) {
    return false;
  }

  if (!JS_DefineProperties(cx, proto, displayNames_properties)) {
    return false;
  }

  RootedValue ctorValue(cx, ObjectValue(*ctor));
  return DefineDataProperty(cx, intl, cx->names().DisplayNames, ctorValue, 0);
}

static mozilla::intl::DisplayNames* NewDisplayNames(
    JSContext* cx, const char* locale,
    mozilla::intl::DisplayNames::Options& options) {
  auto result =
      mozilla::intl::DisplayNames::TryCreate(IcuLocale(locale), options);
  if (result.isErr()) {
    intl::ReportInternalError(cx, result.unwrapErr());
    return nullptr;
  }
  return result.unwrap().release();
}

static mozilla::intl::DisplayNames* GetOrCreateDisplayNames(
    JSContext* cx, Handle<DisplayNamesObject*> displayNames, const char* locale,
    mozilla::intl::DisplayNames::Options& options) {
  // Obtain a cached mozilla::intl::DisplayNames object.
  mozilla::intl::DisplayNames* dn = displayNames->getDisplayNames();
  if (!dn) {
    dn = NewDisplayNames(cx, locale, options);
    if (!dn) {
      return nullptr;
    }
    displayNames->setDisplayNames(dn);

    intl::AddICUCellMemory(displayNames,
                           DisplayNamesObject::EstimatedMemoryUse);
  }
  return dn;
}

static void ReportInvalidOptionError(JSContext* cx, const char* type,
                                     HandleString option) {
  if (UniqueChars str = QuoteString(cx, option, '"')) {
    JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr,
                              JSMSG_INVALID_OPTION_VALUE, type, str.get());
  }
}

/**
 * intl_ComputeDisplayName(displayNames, locale, calendar, style,
 *                         languageDisplay, fallback, type, code)
 */
bool js::intl_ComputeDisplayName(JSContext* cx, unsigned argc, Value* vp) {
  CallArgs args = CallArgsFromVp(argc, vp);
  MOZ_ASSERT(args.length() == 8);

  Rooted<DisplayNamesObject*> displayNames(
      cx, &args[0].toObject().as<DisplayNamesObject>());

  UniqueChars locale = intl::EncodeLocale(cx, args[1].toString());
  if (!locale) {
    return false;
  }

  RootedLinearString calendar(cx, args[2].toString()->ensureLinear(cx));
  if (!calendar) {
    return false;
  }

  RootedLinearString code(cx, args[7].toString()->ensureLinear(cx));
  if (!code) {
    return false;
  }

  mozilla::intl::DisplayNames::Style displayStyle;
  {
    JSLinearString* style = args[3].toString()->ensureLinear(cx);
    if (!style) {
      return false;
    }

    if (StringEqualsLiteral(style, "long")) {
      displayStyle = mozilla::intl::DisplayNames::Style::Long;
    } else if (StringEqualsLiteral(style, "short")) {
      displayStyle = mozilla::intl::DisplayNames::Style::Short;
    } else if (StringEqualsLiteral(style, "narrow")) {
      displayStyle = mozilla::intl::DisplayNames::Style::Narrow;
    } else {
      MOZ_ASSERT(StringEqualsLiteral(style, "abbreviated"));
      displayStyle = mozilla::intl::DisplayNames::Style::Abbreviated;
    }
  }

  mozilla::intl::DisplayNames::LanguageDisplay languageDisplay;
  {
    JSLinearString* language = args[4].toString()->ensureLinear(cx);
    if (!language) {
      return false;
    }

    if (StringEqualsLiteral(language, "dialect")) {
      languageDisplay = mozilla::intl::DisplayNames::LanguageDisplay::Dialect;
    } else {
      MOZ_ASSERT(language->empty() ||
                 StringEqualsLiteral(language, "standard"));
      languageDisplay = mozilla::intl::DisplayNames::LanguageDisplay::Standard;
    }
  }

  mozilla::intl::DisplayNames::Fallback fallback;
  {
    JSLinearString* fallbackStr = args[5].toString()->ensureLinear(cx);
    if (!fallbackStr) {
      return false;
    }

    if (StringEqualsLiteral(fallbackStr, "none")) {
      fallback = mozilla::intl::DisplayNames::Fallback::None;
    } else {
      MOZ_ASSERT(StringEqualsLiteral(fallbackStr, "code"));
      fallback = mozilla::intl::DisplayNames::Fallback::Code;
    }
  }

  mozilla::intl::DisplayNames::Type type;
  {
    JSLinearString* typeStr = args[6].toString()->ensureLinear(cx);
    if (!typeStr) {
      return false;
    }
    using Type = mozilla::intl::DisplayNames::Type;
    if (StringEqualsLiteral(typeStr, "language")) {
      type = Type::Language;
    } else if (StringEqualsLiteral(typeStr, "script")) {
      type = Type::Script;
    } else if (StringEqualsLiteral(typeStr, "region")) {
      type = Type::Region;
    } else if (StringEqualsLiteral(typeStr, "currency")) {
      type = Type::Currency;
    } else if (StringEqualsLiteral(typeStr, "calendar")) {
      type = Type::Calendar;
    } else if (StringEqualsLiteral(typeStr, "weekday")) {
      type = Type::Weekday;
    } else if (StringEqualsLiteral(typeStr, "month")) {
      type = Type::Month;
    } else if (StringEqualsLiteral(typeStr, "quarter")) {
      type = Type::Quarter;
    } else if (StringEqualsLiteral(typeStr, "dayPeriod")) {
      type = Type::DayPeriod;
    } else {
      MOZ_ASSERT(StringEqualsLiteral(typeStr, "dateTimeField"));
      type = Type::DateTimeField;
    }
  }

  mozilla::intl::DisplayNames::Options options(type);
  options.style = displayStyle;
  options.languageDisplay = languageDisplay;

  mozilla::intl::DisplayNames* dn =
      GetOrCreateDisplayNames(cx, displayNames, locale.get(), options);
  if (!dn) {
    return false;
  }

  // mozilla::intl::DisplayNames::Of matches the API of the Intl.DisplayNames
  // API. The code gets passed in as UTF-8 as the string commonly has an ASCII
  // representation.
  JSString* str = nullptr;
  mozilla::Maybe<mozilla::intl::DisplayNamesError> error = mozilla::Nothing();
  {
    // Do not GC while querying mozilla::intl::DisplayNames::Of, as it directly
    // references JSString contents.
    JS::AutoCheckCannotGC nogc;

    mozilla::Span<const char> span;
    // Only allocate a temporary string if the code is non-ASCII.
    JS::UniqueChars utf8 = nullptr;
    if (StringIsAscii(code)) {
      // The string is just ascii characters, so there is no need to allocate a
      // new string. This is a common case for BCP47 language tags, and probably
      // other codes.
      span = mozilla::MakeStringSpan(
          // reinterpret_cast is required to cast from |const unsigned char*|
          // to |const char*|
          reinterpret_cast<const char*>(code.get()->latin1Chars(nogc)));
    } else {
      utf8 = JS_EncodeStringToUTF8(cx, code);
      span = mozilla::MakeStringSpan(utf8.get());
    }

    intl::FormatBuffer<char16_t, intl::INITIAL_CHAR_BUFFER_SIZE> buffer(cx);
    auto result = dn->Of(buffer, span, fallback);
    if (result.isErr()) {
      error = mozilla::Some(result.unwrapErr());
    } else {
      str = buffer.toString(cx);
    }
  }

  if (error) {
    switch (error.value()) {
      case mozilla::intl::DisplayNamesError::InternalError:
        intl::ReportInternalError(cx);
        break;
      case mozilla::intl::DisplayNamesError::OutOfMemory:
        ReportOutOfMemory(cx);
        break;
      case mozilla::intl::DisplayNamesError::InvalidOption:
        ReportInvalidOptionError(
            cx, mozilla::intl::DisplayNames::ToString(type), code);
        break;
      case mozilla::intl::DisplayNamesError::DuplicateVariantSubtag:
        JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr,
                                  JSMSG_DUPLICATE_VARIANT_SUBTAG);
        break;
      case mozilla::intl::DisplayNamesError::InvalidLanguageTag:
        JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr,
                                  JSMSG_INVALID_LANGUAGE_TAG);
        break;
    }
    return false;
  }

  if (str->empty()) {
    args.rval().setUndefined();
  } else {
    args.rval().setString(str);
  }

  return true;
}
