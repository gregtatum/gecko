/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//! Machinery to initialise interface prototype objects and interface objects.

use dom::bindings::codegen::PrototypeList;
use dom::bindings::conversions::get_dom_class;
use js::glue::UncheckedUnwrapObject;
use js::jsapi::{Class, ClassExtension, ClassSpec, HandleObject, HandleValue, JSClass};
use js::jsapi::{JSContext, JSFunctionSpec, JSPropertySpec, JSString, JS_DefineProperty1};
use js::jsapi::{JS_DefineProperty2, JS_DefineProperty4, JS_GetFunctionObject};
use js::jsapi::{JS_GetPrototype, JS_InternString, JS_LinkConstructorAndPrototype};
use js::jsapi::{JS_NewFunction, JS_NewObject, JS_NewObjectWithUniqueType, JS_DefineProperty};
use js::jsapi::{MutableHandleObject, MutableHandleValue, ObjectOps, RootedObject};
use js::jsapi::{RootedString, Value};
use js::jsapi::{RootedValue};
use js::jsval::{BooleanValue, DoubleValue, Int32Value, JSVal, NullValue, UInt32Value};
use js::rust::{define_methods, define_properties};
use js::{JSPROP_ENUMERATE, JSFUN_CONSTRUCTOR, JSPROP_PERMANENT, JSPROP_READONLY};
use libc;
use libc::c_uint;
use std::ptr;

/// Representation of an IDL constant value.
#[derive(Clone)]
pub enum ConstantVal {
    /// `long` constant.
    IntVal(i32),
    /// `unsigned long` constant.
    UintVal(u32),
    /// `double` constant.
    DoubleVal(f64),
    /// `boolean` constant.
    BoolVal(bool),
    /// `null` constant.
    NullVal,
}

/// Representation of an IDL constant.
#[derive(Clone)]
pub struct ConstantSpec {
    /// name of the constant.
    pub name: &'static [u8],
    /// value of the constant.
    pub value: ConstantVal,
}

impl ConstantSpec {
    /// Returns a `JSVal` that represents the value of this `ConstantSpec`.
    pub fn get_value(&self) -> JSVal {
        match self.value {
            ConstantVal::NullVal => NullValue(),
            ConstantVal::IntVal(i) => Int32Value(i),
            ConstantVal::UintVal(u) => UInt32Value(u),
            ConstantVal::DoubleVal(d) => DoubleValue(d),
            ConstantVal::BoolVal(b) => BooleanValue(b),
        }
    }
}

/// A JSNative that cannot be null.
pub type NonNullJSNative =
    unsafe extern "C" fn (arg1: *mut JSContext, arg2: c_uint, arg3: *mut JSVal) -> bool;

/// Defines constants on `obj`.
/// Fails on JSAPI failure.
pub fn define_constants(cx: *mut JSContext, obj: HandleObject, constants: &'static [ConstantSpec]) {
    for spec in constants {
        let value = RootedValue::new(cx, spec.get_value());
        unsafe {
            assert!(JS_DefineProperty(cx,
                                      obj,
                                      spec.name.as_ptr() as *const libc::c_char,
                                      value.handle(),
                                      JSPROP_ENUMERATE | JSPROP_READONLY | JSPROP_PERMANENT,
                                      None,
                                      None));
        }
    }
}

/// A constructor class hook.
pub type ConstructorClassHook =
    unsafe extern "C" fn(cx: *mut JSContext, argc: u32, vp: *mut Value) -> bool;

/// A has_instance class hook.
pub type HasInstanceClassHook =
    unsafe extern "C" fn(cx: *mut JSContext,
                         obj: HandleObject,
                         vp: MutableHandleValue,
                         bp: *mut bool)
                         -> bool;

/// A fun_to_string class hook.
pub type FunToStringHook =
    unsafe extern "C" fn(cx: *mut JSContext,
                         obj: HandleObject,
                         indent: u32)
                         -> *mut JSString;

/// The class of a non-callback interface object.
#[derive(Copy, Clone)]
pub struct NonCallbackInterfaceObjectClass {
    /// The SpiderMonkey Class structure.
    pub class: Class,
}
unsafe impl Sync for NonCallbackInterfaceObjectClass {}

impl NonCallbackInterfaceObjectClass {
    /// Create a new `NonCallbackInterfaceObjectClass` structure.
    pub const fn new(
            constructor: ConstructorClassHook,
            has_instance: HasInstanceClassHook,
            fun_to_string: FunToStringHook)
            -> NonCallbackInterfaceObjectClass {
        NonCallbackInterfaceObjectClass {
            class: Class {
                name: b"Function\0" as *const _ as *const libc::c_char,
                flags: 0,
                addProperty: None,
                delProperty: None,
                getProperty: None,
                setProperty: None,
                enumerate: None,
                resolve: None,
                convert: None,
                finalize: None,
                call: Some(constructor),
                hasInstance: Some(has_instance),
                construct: Some(constructor),
                trace: None,
                spec: ClassSpec {
                    createConstructor: None,
                    createPrototype: None,
                    constructorFunctions: ptr::null(),
                    constructorProperties: ptr::null(),
                    prototypeFunctions: ptr::null(),
                    prototypeProperties: ptr::null(),
                    finishInit: None,
                    flags: 0,
                },
                ext: ClassExtension {
                    outerObject: None,
                    innerObject: None,
                    isWrappedNative: false,
                    weakmapKeyDelegateOp: None,
                    objectMovedOp: None,
                },
                ops: ObjectOps {
                    lookupProperty: None,
                    defineProperty: None,
                    hasProperty: None,
                    getProperty: None,
                    setProperty: None,
                    getOwnPropertyDescriptor: None,
                    deleteProperty: None,
                    watch: None,
                    unwatch: None,
                    getElements: None,
                    enumerate: None,
                    thisObject: None,
                    funToString: Some(fun_to_string),
                }
            },
        }
    }

    /// cast own reference to `JSClass` reference
    pub fn as_jsclass(&self) -> &JSClass {
        unsafe {
            &*(self as *const _ as *const JSClass)
        }
    }
}

/// Create and define the interface object of a callback interface.
pub unsafe fn create_callback_interface_object(
        cx: *mut JSContext,
        receiver: HandleObject,
        constants: &'static [ConstantSpec],
        name: &'static [u8]) {
    assert!(!constants.is_empty());
    let interface_object = RootedObject::new(cx, JS_NewObject(cx, ptr::null()));
    assert!(!interface_object.ptr.is_null());
    define_constants(cx, interface_object.handle(), constants);
    define_name(cx, interface_object.handle(), name);
    define_on_global_object(cx, receiver, name, interface_object.handle());
}

/// Create the interface prototype object of a non-callback interface.
pub unsafe fn create_interface_prototype_object(
        cx: *mut JSContext,
        proto: HandleObject,
        class: &'static JSClass,
        regular_methods: Option<&'static [JSFunctionSpec]>,
        regular_properties: Option<&'static [JSPropertySpec]>,
        constants: &'static [ConstantSpec],
        rval: MutableHandleObject) {
    create_object(cx, proto, class, regular_methods, regular_properties, constants, rval);
}

/// Create and define the interface object of a non-callback interface.
pub unsafe fn create_noncallback_interface_object(
        cx: *mut JSContext,
        receiver: HandleObject,
        proto: HandleObject,
        class: &'static NonCallbackInterfaceObjectClass,
        static_methods: Option<&'static [JSFunctionSpec]>,
        static_properties: Option<&'static [JSPropertySpec]>,
        constants: &'static [ConstantSpec],
        interface_prototype_object: HandleObject,
        name: &'static [u8],
        length: u32,
        rval: MutableHandleObject) {
    create_object(cx,
                  proto,
                  class.as_jsclass(),
                  static_methods,
                  static_properties,
                  constants,
                  rval);
    assert!(JS_LinkConstructorAndPrototype(cx, rval.handle(), interface_prototype_object));
    define_name(cx, rval.handle(), name);
    define_length(cx, rval.handle(), length);
    define_on_global_object(cx, receiver, name, rval.handle());
}

/// Create and define the named constructors of a non-callback interface.
pub unsafe fn create_named_constructors(
        cx: *mut JSContext,
        receiver: HandleObject,
        named_constructors: &[(NonNullJSNative, &'static [u8], u32)],
        interface_prototype_object: HandleObject) {
    let mut constructor = RootedObject::new(cx, ptr::null_mut());

    for &(native, name, arity) in named_constructors {
        assert!(*name.last().unwrap() == b'\0');

        let fun = JS_NewFunction(cx,
                                 Some(native),
                                 arity,
                                 JSFUN_CONSTRUCTOR,
                                 name.as_ptr() as *const libc::c_char);
        assert!(!fun.is_null());
        constructor.ptr = JS_GetFunctionObject(fun);
        assert!(!constructor.ptr.is_null());

        assert!(JS_DefineProperty1(cx,
                                   constructor.handle(),
                                   b"prototype\0".as_ptr() as *const libc::c_char,
                                   interface_prototype_object,
                                   JSPROP_PERMANENT | JSPROP_READONLY,
                                   None,
                                   None));

        define_on_global_object(cx, receiver, name, constructor.handle());
    }
}

/// Return whether a value is an instance of a given prototype.
/// http://heycam.github.io/webidl/#es-interface-hasinstance
pub unsafe fn has_instance(
        cx: *mut JSContext,
        prototype: HandleObject,
        value: HandleValue,
        id: PrototypeList::ID,
        index: usize)
        -> Result<bool, ()> {
    if !value.is_object() {
        // Step 1.
        return Ok(false);
    }
    let mut value = RootedObject::new(cx, value.to_object());

    // Steps 2-3 only concern callback interface objects.

    if let Ok(dom_class) = get_dom_class(UncheckedUnwrapObject(value.ptr, /* stopAtOuter = */ 0)) {
        if dom_class.interface_chain[index] == id {
            // Step 4.
            return Ok(true);
        }
    }

    while JS_GetPrototype(cx, value.handle(), value.handle_mut()) {
        if value.ptr.is_null() {
            // Step 5.2.
            return Ok(false);
        } else if value.ptr as *const _ == prototype.ptr {
            // Step 5.3.
            return Ok(true);
        }
    }
    // JS_GetPrototype threw an exception.
    Err(())
}

unsafe fn create_object(
        cx: *mut JSContext,
        proto: HandleObject,
        class: &'static JSClass,
        methods: Option<&'static [JSFunctionSpec]>,
        properties: Option<&'static [JSPropertySpec]>,
        constants: &'static [ConstantSpec],
        rval: MutableHandleObject) {
    rval.set(JS_NewObjectWithUniqueType(cx, class, proto));
    assert!(!rval.ptr.is_null());
    if let Some(methods) = methods {
        define_methods(cx, rval.handle(), methods).unwrap();
    }
    if let Some(properties) = properties {
        define_properties(cx, rval.handle(), properties).unwrap();
    }
    define_constants(cx, rval.handle(), constants);
}

unsafe fn define_name(cx: *mut JSContext, obj: HandleObject, name: &'static [u8]) {
    assert!(*name.last().unwrap() == b'\0');
    let name =
        RootedString::new(cx, JS_InternString(cx, name.as_ptr() as *const libc::c_char));
    assert!(!name.ptr.is_null());
    assert!(JS_DefineProperty2(cx,
                               obj,
                               b"name\0".as_ptr() as *const libc::c_char,
                               name.handle(),
                               JSPROP_READONLY,
                               None, None));
}

unsafe fn define_length(cx: *mut JSContext, obj: HandleObject, length: u32) {
    assert!(JS_DefineProperty4(cx,
                               obj,
                               b"length\0".as_ptr() as *const libc::c_char,
                               length,
                               JSPROP_READONLY,
                               None, None));
}

unsafe fn define_on_global_object(
        cx: *mut JSContext,
        receiver: HandleObject,
        name: &'static [u8],
        obj: HandleObject) {
    assert!(*name.last().unwrap() == b'\0');
    assert!(JS_DefineProperty1(cx,
                               receiver,
                               name.as_ptr() as *const libc::c_char,
                               obj,
                               0,
                               None, None));
}
