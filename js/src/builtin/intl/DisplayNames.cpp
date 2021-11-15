/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: set ts=8 sts=2 et sw=2 tw=80:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Intl.DisplayNames implementation. */

#include "builtin/intl/DisplayNames.h"

#include "mozilla/Assertions.h"
#include "mozilla/Unused.h"
#include "mozilla/intl/DisplayNames.h"
#include "mozilla/PodOperations.h"
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

/**
 * intl_ComputeDisplayName(displayNames, locale, calendar, style,
 *                         languageDisplay, fallback, type, code)
 */
bool js::intl_ComputeDisplayName(JSContext* cx, unsigned argc, Value* vp) {
  return false;
}
