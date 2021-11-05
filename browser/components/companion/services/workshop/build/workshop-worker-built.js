// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY
var WorkshopBackend = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __require = (x) => {
    if (typeof require !== "undefined")
      return require(x);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  };
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[Object.keys(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    __markAsModule(target);
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __reExport = (target, module, desc) => {
    if (module && typeof module === "object" || typeof module === "function") {
      for (let key of __getOwnPropNames(module))
        if (!__hasOwnProp.call(target, key) && key !== "default")
          __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
    }
    return target;
  };
  var __toModule = (module) => {
    return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
  };

  // src/vendor/evt.js
  var require_evt = __commonJS({
    "src/vendor/evt.js"(exports, module) {
      (function(root, factory) {
        "use strict";
        if (typeof define === "function" && define.amd) {
          define(factory);
        } else if (typeof exports === "object") {
          module.exports = factory();
        } else {
          root.evt = factory();
        }
      })(exports, function() {
        "use strict";
        var evt4, slice = Array.prototype.slice, props = [
          "_events",
          "_pendingEvents",
          "on",
          "once",
          "latest",
          "latestOnce",
          "removeObjectListener",
          "removeListener",
          "emitWhenListener",
          "emit"
        ];
        function objFnPair(obj, fn) {
          if (!fn) {
            fn = obj;
            obj = void 0;
            if (!(fn instanceof Function)) {
              throw new Error("You did not provide a function!");
            }
          } else {
            if (typeof fn === "string") {
              if (!(obj[fn] instanceof Function)) {
                throw new Error(`String ${fn} does not reference a function on obj!`);
              }
            } else if (!(fn instanceof Function)) {
              throw new Error("fn is neither a function or a string!");
            }
          }
          return [obj, fn];
        }
        function callApply(applyPair, args) {
          var obj = applyPair[0], fn = applyPair[1];
          if (typeof fn === "string") {
            fn = obj[fn];
          }
          return fn.apply(obj, args);
        }
        function cleanEventEntry(emitter, id) {
          var listeners2 = emitter._events[id];
          if (listeners2 && !listeners2.length) {
            delete emitter._events[id];
          }
        }
        function emitError(err) {
          if (evt4._events.hasOwnProperty("error")) {
            evt4.emit("error", err);
          } else {
            console.error(err, err.stack);
          }
        }
        class Emitter8 {
          constructor() {
            this._events = {};
            this._pendingEvents = {};
          }
          on(id, obj, fnName) {
            var applyPair = objFnPair(obj, fnName);
            var listeners2 = this._events[id], pending = this._pendingEvents[id];
            if (!listeners2) {
              listeners2 = this._events[id] = [];
            }
            listeners2.push(applyPair);
            if (pending) {
              pending.forEach(function(args) {
                callApply(applyPair, args);
              });
              delete this._pendingEvents[id];
            }
            return this;
          }
          once(id, obj, fnName) {
            const self2 = this;
            let fired = false;
            const applyPair = objFnPair(obj, fnName);
            const one = (...args) => {
              if (fired) {
                return;
              }
              fired = true;
              callApply(applyPair, args);
              setTimeout(() => self2.removeListener(id, one));
            };
            return this.on(id, applyPair[0], one);
          }
          promisedOnce(id) {
            return new Promise((resolve) => {
              this.once(id, resolve);
            });
          }
          latest(id, obj, fnName) {
            var applyPair = objFnPair(obj, fnName);
            if (this[id] && !this._pendingEvents[id]) {
              callApply(applyPair, [this[id]]);
            }
            this.on(id, applyPair[0], applyPair[1]);
          }
          latestOnce(id, obj, fnName) {
            var applyPair = objFnPair(obj, fnName);
            if (this[id] && !this._pendingEvents[id]) {
              callApply(applyPair, [this[id]]);
            } else {
              this.once(id, applyPair[0], applyPair[1]);
            }
          }
          promisedLatestOnce(id) {
            return new Promise((resolve) => {
              this.latestOnce(id, resolve);
            });
          }
          removeObjectListener(obj) {
            Object.keys(this._events).forEach(function(eventId) {
              var listeners2 = this._events[eventId];
              for (var i = 0; i < listeners2.length; i++) {
                var applyPair = listeners2[i];
                if (applyPair[0] === obj) {
                  listeners2.splice(i, 1);
                  i -= 1;
                }
              }
              cleanEventEntry(this, eventId);
            }.bind(this));
          }
          removeListener(id, obj, fnName) {
            var listeners2 = this._events[id], applyPair = objFnPair(obj, fnName);
            if (listeners2) {
              listeners2.some(function(listener, i) {
                if (listener[0] === applyPair[0] && listener[1] === applyPair[1]) {
                  listeners2.splice(i, 1);
                  return true;
                }
              });
              cleanEventEntry(this, id);
            }
          }
          emitWhenListener(id, ...args) {
            var listeners2 = this._events[id];
            if (listeners2) {
              this.emit.apply(this, [id, ...args]);
            } else {
              if (!this._pendingEvents[id]) {
                this._pendingEvents[id] = [];
              }
              this._pendingEvents[id].push(args);
            }
          }
          emit(id, ...args) {
            var listeners2 = this._events[id];
            if (listeners2) {
              for (var i = 0; i < listeners2.length; i++) {
                var thisObj = listeners2[i][0], fn = listeners2[i][1];
                try {
                  callApply(listeners2[i], args);
                } catch (e) {
                  emitError(e);
                }
                if (!listeners2[i] || listeners2[i][0] !== thisObj || listeners2[i][1] !== fn) {
                  i -= 1;
                }
              }
            }
          }
        }
        evt4 = new Emitter8();
        evt4.Emitter = Emitter8;
        evt4.mix = function(obj) {
          var e = new Emitter8();
          props.forEach(function(prop) {
            if (obj.hasOwnProperty(prop)) {
              throw new Error('Object already has a property "' + prop + '"');
            }
            obj[prop] = e[prop];
          });
          return obj;
        };
        return evt4;
      });
    }
  });

  // src/vendor/equal.js
  function boundedCmpObjs(a, b, depthLeft) {
    var aAttrCount = 0, bAttrCount = 0, key, nextDepth = depthLeft - 1;
    if ("toJSON" in a)
      a = a.toJSON();
    if ("toJSON" in b)
      b = b.toJSON();
    for (key in a) {
      aAttrCount++;
      if (!(key in b))
        return false;
      if (depthLeft) {
        if (!equal(a[key], b[key], nextDepth))
          return false;
      } else {
        if (a[key] !== b[key])
          return false;
      }
    }
    for (key in b) {
      bAttrCount++;
    }
    if (aAttrCount !== bAttrCount)
      return false;
    return true;
  }
  function equal(a, b, depthLeft) {
    if (depthLeft === void 0) {
      depthLeft = COMPARE_DEPTH;
    }
    var ta = typeof a, tb = typeof b;
    if (ta !== "object" || tb !== ta || a == null || b == null)
      return a === b;
    if (a === b)
      return true;
    if (Array.isArray(a)) {
      if (!Array.isArray(b))
        return false;
      if (a.length !== b.length)
        return false;
      for (var iArr = 0; iArr < a.length; iArr++) {
        if (!equal(a[iArr], b[iArr], depthLeft - 1))
          return false;
      }
      return true;
    }
    return boundedCmpObjs(a, b, depthLeft);
  }
  var COMPARE_DEPTH;
  var init_equal = __esm({
    "src/vendor/equal.js"() {
      COMPARE_DEPTH = 6;
    }
  });

  // src/shared/logic.js
  function logic() {
    return logic.event.apply(logic, arguments);
  }
  function toScope(scope4) {
    if (!(scope4 instanceof Scope)) {
      scope4 = objectToScope.get(scope4);
      if (!scope4) {
        throw new Error("Invalid scope " + scope4 + " passed to logic.event(); did you remember to call logic.defineScope()? " + new Error().stack);
      }
    }
    return scope4;
  }
  function MismatchError(matcher, event) {
    this.matcher = matcher;
    this.event = event;
  }
  function LogicMatcher(opts) {
    this.matchedLogs = opts.prevMatcher ? opts.prevMatcher.matchedLogs : [];
    this.capturedLogs = [];
    this.ns = opts.ns;
    this.type = opts.type;
    this.detailPredicate = opts.detailPredicate;
    this.failOnMismatchedDetails = true;
    this.not = opts.not;
    this.timeoutMS = 2e3;
    this.resolved = false;
    this.anotherMatcherNeedsMyLogs = false;
    if (opts.prevMatcher) {
      opts.prevMatcher.anotherMatcherNeedsMyLogs = true;
    }
    logic.defineScope(this, "LogicMatcher");
    var hasPrevPromise = !!opts.prevPromise;
    var normalizedPrevPromise = opts.prevPromise || Promise.resolve();
    if (this.not) {
      this.promise = normalizedPrevPromise.then(() => {
        this.capturedLogs.some((event) => {
          if ((!this.ns || event.namespace === this.ns) && event.matches(this.type, this.detailPredicate)) {
            throw new MismatchError(this, event);
          }
        });
      });
    } else if (this.type) {
      this.promise = new Promise((resolve, reject) => {
        var subscribeToNextMatch = () => {
          var timeoutId = setTimeout(() => {
            logic(this, "failedMatch", {
              ns: this.ns,
              type: this.type,
              detailPredicate: this.detailPredicate,
              capturedLogs: this.capturedLogs
            });
            reject(new Error("LogicMatcherTimeout: " + this));
          }, this.timeoutMS);
          var resolveThisMatcher = (event) => {
            this.resolved = true;
            this.capturedLogs = [];
            if (!this.anotherMatcherNeedsMyLogs) {
              this.removeMatchListener();
            }
          };
          var matchFn = (event) => {
            this.capturedLogs.push(event);
            if (this.resolved) {
              return true;
            }
            if (this.ns && event.namespace !== this.ns || event.type !== this.type) {
              return false;
            }
            if (event.matches(this.type, this.detailPredicate)) {
              resolveThisMatcher(event);
              this.matchedLogs.push(event);
              clearTimeout(timeoutId);
              logic(this, "match", {
                ns: this.ns,
                type: this.type,
                event
              });
              resolve(event);
              return true;
            } else if (this.failOnMismatchedDetails) {
              resolveThisMatcher(event);
              reject(new MismatchError(this, event));
              return true;
            }
            return false;
          };
          this.removeMatchListener = () => {
            logic.removeListener("event", matchFn);
          };
          logic.on("event", matchFn);
          if (opts.prevMatcher) {
            var prevLogs = opts.prevMatcher.capturedLogs;
            var matchIndex = prevLogs.findIndex(matchFn);
            if (matchIndex !== -1) {
              this.capturedLogs = prevLogs.slice(matchIndex + 1);
            }
            opts.prevMatcher.removeMatchListener();
          }
        };
        if (hasPrevPromise) {
          normalizedPrevPromise.then(subscribeToNextMatch, (e) => reject(e));
        } else {
          try {
            subscribeToNextMatch();
          } catch (e) {
            reject(e);
          }
        }
      });
    } else {
      this.promise = normalizedPrevPromise;
    }
  }
  function Scope(namespace, defaultDetails) {
    this.namespace = namespace;
    if (defaultDetails && !isPlainObject(defaultDetails)) {
      throw new Error("Invalid defaultDetails; expected a plain-old object: " + defaultDetails);
    }
    this.defaultDetails = defaultDetails;
  }
  function ObjectSimplifier(opts) {
    opts = opts || {};
    this.maxDepth = opts.maxDepth || 10;
    this.maxStringLength = opts.maxStringLength || 1e3;
    this.maxArrayLength = opts.maxArrayLength || 1e3;
    this.maxObjectLength = opts.maxObjectLength || 100;
  }
  function LogicEvent(scope4, type, details) {
    if (!(scope4 instanceof Scope)) {
      throw new Error('Invalid "scope" passed to LogicEvent(); did you remember to call logic.defineScope()?');
    }
    this.scope = scope4;
    this.type = type;
    this.details = details;
    this.time = Date.now();
    this.id = logic.uniqueId();
    this.jsonRepresentation = {
      namespace: this.scope.namespace,
      type: this.type,
      details: new ObjectSimplifier().simplify(this.details),
      time: this.time,
      id: this.id
    };
  }
  function isPlainObject(obj) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    if (obj.toString && obj.toString() !== "[object Object]") {
      return false;
    }
    for (var k in obj) {
      if (typeof k === "function") {
        return false;
      }
    }
    return true;
  }
  function shallowClone(x) {
    if (isPlainObject(x)) {
      var ret = {};
      for (var key in x) {
        ret[key] = x[key];
      }
      return ret;
    }
    return x;
  }
  function into(target, source) {
    if (!target) {
      target = {};
    }
    for (var key in source) {
      target[key] = source[key];
    }
    return target;
  }
  var import_evt, objectToScope, nextId, interceptions, promiseToStartEventMap, promiseToResultEventMap;
  var init_logic = __esm({
    "src/shared/logic.js"() {
      import_evt = __toModule(require_evt());
      init_equal();
      import_evt.default.mix(logic);
      logic.scope = function(namespace, defaultDetails) {
        return new Scope(namespace, defaultDetails);
      };
      objectToScope = new WeakMap();
      logic.defineScope = function(obj, namespace, defaultDetails) {
        if (!namespace && obj && obj.constructor && obj.constructor.name) {
          namespace = obj.constructor.name;
        }
        var scope4 = new Scope(namespace, defaultDetails);
        objectToScope.set(obj, scope4);
        return scope4;
      };
      logic.subscope = function(scope4, defaultDetails) {
        scope4 = toScope(scope4);
        return new Scope(scope4.namespace, into(shallowClone(scope4.defaultDetails), shallowClone(defaultDetails)));
      };
      logic.event = function(scope4, type, details) {
        scope4 = toScope(scope4);
        var isDefaultPrevented = false;
        var preprocessEvent = {
          scope: scope4,
          namespace: scope4.namespace,
          type,
          details,
          preventDefault() {
            isDefaultPrevented = true;
          }
        };
        logic.emit("preprocessEvent", preprocessEvent);
        if (isDefaultPrevented) {
          return { id: 0 };
        }
        type = preprocessEvent.type;
        details = preprocessEvent.details;
        if (typeof type !== "string") {
          throw new Error('Invalid "type" passed to logic.event(); expected a string, got "' + type + '"');
        }
        if (scope4.defaultDetails) {
          if (isPlainObject(details)) {
            details = into(shallowClone(scope4.defaultDetails), shallowClone(details));
          } else {
            details = shallowClone(scope4.defaultDetails);
          }
        } else {
          details = shallowClone(details);
        }
        var event = new LogicEvent(scope4, type, details);
        logic.emit("censorEvent", event);
        logic.emit("event", event);
        if (logic.bc) {
          logic.bc.postMessage({
            mode: "append",
            tid: logic.tid,
            event: event.jsonRepresentation
          });
        }
        if (logic.realtimeLogEverything) {
          dump(`logic[${logic.tid}]: ${JSON.stringify(event)}
`);
        }
        return event;
      };
      logic.underTest = false;
      logic._currentTestRejectFunction = null;
      logic.fail = function(ex) {
        if (logic.underTest) {
          if (logic._currentTestRejectFunction) {
            logic._currentTestRejectFunction(ex);
          } else {
            throw ex;
          }
        } else {
          console.error("Logic fail:", ex);
        }
      };
      nextId = 1;
      logic.uniqueId = function() {
        return nextId++;
      };
      logic.isCensored = false;
      logic.realtimeLogEverything = false;
      logic.bc = null;
      interceptions = {};
      logic.interceptable = function(type, fn) {
        if (interceptions[type]) {
          return interceptions[type]();
        }
        return fn();
      };
      logic.interceptOnce = function(type, replacementFn) {
        var prevFn = interceptions[type];
        interceptions[type] = function() {
          interceptions[type] = prevFn;
          return replacementFn();
        };
      };
      logic.match = function(ns, type, detailPredicate) {
        return new LogicMatcher(LogicMatcher.normalizeMatchArgs(ns, type, detailPredicate));
      };
      MismatchError.prototype = Object.create(Error.prototype, {
        constructor: { value: MismatchError },
        toString: {
          value() {
            if (this.matcher.not) {
              return "MismatchError: expected " + this.event + " to not occur (failIfMatched " + this.matcher + ").";
            }
            return "MismatchError: expected " + this.event + " to match " + JSON.stringify(this.matcher.detailPredicate) + ".";
          }
        }
      });
      LogicMatcher.normalizeMatchArgs = function(ns, type, details) {
        if (typeof type === "object") {
          details = type;
          type = ns;
          ns = null;
        }
        return { ns, type, detailPredicate: details };
      };
      LogicMatcher.prototype = {
        match(ns, type, details) {
          var args = LogicMatcher.normalizeMatchArgs(ns, type, details);
          args.prevMatcher = this;
          args.prevPromise = this.promise;
          return new LogicMatcher(args);
        },
        failIfMatched(ns, type, details) {
          var args = LogicMatcher.normalizeMatchArgs(ns, type, details);
          args.not = true;
          args.prevMatcher = this;
          args.prevPromise = this.promise;
          return new LogicMatcher(args);
        },
        then(fn, catchFn) {
          return new LogicMatcher({
            prevPromise: this.promise.then(() => {
              var ret = fn(this.matchedLogs.slice());
              if (ret instanceof Promise) {
                ret = new LogicMatcher({
                  prevPromise: ret
                });
              }
              return ret;
            }, catchFn)
          });
        },
        toString() {
          return "<LogicMatcher " + (this.ns ? this.ns + "/" : "") + this.type + " " + new ObjectSimplifier().simplify(this.detailPredicate) + ">";
        }
      };
      ObjectSimplifier.prototype = {
        simplify(x) {
          return this._simplify(x, 0, new WeakSet());
        },
        _simplify(x, depth, cacheSet) {
          if (cacheSet.has(x)) {
            return "(cycle)";
          }
          if (typeof x === "number") {
            return x;
          } else if (typeof x === "string") {
            return x.slice(0, this.maxStringLength);
          } else if (x && x.BYTES_PER_ELEMENT) {
            return x.slice(0, this.maxArrayLength);
          } else if (Array.isArray(x)) {
            if (depth < this.maxDepth) {
              return x.slice(0, this.maxArrayLength).map((element) => this._simplify(element, depth + 1, cacheSet));
            }
            return "[Array length=" + x.length + "]";
          } else if (x && typeof x === "object") {
            cacheSet.add(x);
            if (!isPlainObject(x)) {
              if (x.toJSON) {
                return this._simplify(x.toJSON(), depth, cacheSet);
              } else if (x instanceof Map) {
                return this._simplify([...Map.prototype.entries.call(x)], depth + 1, cacheSet);
              } else if (x instanceof Set) {
                return this._simplify([...Set.prototype.entries.call(x)], depth + 1, cacheSet);
              } else if (x.toString) {
                return this._simplify(x.toString(), depth, cacheSet);
              }
              return "(?)";
            }
            if (depth < this.maxDepth) {
              var retObj = {};
              var idx = 0;
              for (var key in x) {
                if (idx > this.maxObjectLength) {
                  break;
                }
                retObj[key] = this._simplify(x[key], depth + 1, cacheSet);
                idx++;
              }
              return retObj;
            } else if (x.toString) {
              return this._simplify(x.toString(), depth, cacheSet);
            }
            return "(object?)";
          } else if (typeof x === "function") {
            return "(function)";
          }
          return x;
        }
      };
      LogicEvent.fromJSON = function(data) {
        var event = new LogicEvent(new Scope(data.namespace), data.type, data.details);
        event.time = data.time;
        event.id = data.id;
        return event;
      };
      LogicEvent.prototype = {
        get namespace() {
          return this.scope.namespace;
        },
        toJSON() {
          return this.jsonRepresentation;
        },
        toString() {
          return "<LogicEvent [34m" + this.namespace + "[0m/[36m" + this.type + "[0m\n[37m" + JSON.stringify(this.jsonRepresentation.details, null, 2) + "[0m>";
        },
        matches(type, detailPredicate) {
          if (this.type !== type) {
            return false;
          }
          if (typeof detailPredicate === "function") {
            return !!detailPredicate(this.details);
          } else if (isPlainObject(detailPredicate)) {
            for (var key in detailPredicate) {
              var expected = detailPredicate && detailPredicate[key];
              var actual = this.details && this.details[key];
              if (actual === void 0) {
                actual = null;
              }
              if (expected === void 0) {
                continue;
              } else if (!this.details || !equal(expected, actual)) {
                return false;
              }
            }
            return true;
          } else if (detailPredicate != null) {
            return equal(this.details, detailPredicate);
          }
          return true;
        }
      };
      logic.isPlainObject = isPlainObject;
      promiseToStartEventMap = new WeakMap();
      promiseToResultEventMap = new WeakMap();
      logic.startAsync = function(scope4, type, details) {
        var resolve, reject;
        logic.async(scope4, type, details, (_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        return {
          resolve,
          reject
        };
      };
      logic.async = function(scope4, type, details, fn) {
        if (!fn && typeof details === "function") {
          fn = details;
          details = null;
        }
        scope4 = logic.subscope(scope4, details);
        var startEvent;
        var promise = new Promise((resolve, reject) => {
          startEvent = logic(scope4, "begin " + type, {
            asyncStatus: 0,
            asyncName: type
          });
          fn((result) => {
            promiseToResultEventMap.set(promise, logic(scope4, type, {
              asyncStatus: 1,
              sourceEventIds: [startEvent.id],
              result
            }));
            resolve(result);
          }, (error) => {
            promiseToResultEventMap.set(promise, logic(scope4, type, {
              asyncStatus: 2,
              sourceEventIds: [startEvent.id],
              error
            }));
            reject(error);
          });
        });
        promiseToStartEventMap.set(promise, startEvent);
        return promise;
      };
      logic.await = function(scope4, type, details, promise) {
        if (!promise && details.then) {
          promise = details;
          details = null;
        }
        scope4 = logic.subscope(scope4, details);
        var startEvent = promiseToStartEventMap.get(promise);
        var awaitEvent = logic.event(scope4, "await " + type, {
          awaitStatus: 0,
          sourceEventIds: startEvent ? [startEvent.id] : null,
          awaitName: type
        });
        return promise.then((result) => {
          var resultEvent = promiseToResultEventMap.get(promise);
          logic(scope4, type, {
            awaitStatus: 1,
            result,
            sourceEventIds: resultEvent ? [resultEvent.id, awaitEvent.id] : [awaitEvent.id]
          });
          return result;
        }, (error) => {
          var resultEvent = promiseToResultEventMap.get(promise);
          logic(scope4, type, {
            awaitStatus: 2,
            error,
            stack: error && error.stack,
            sourceEventIds: resultEvent ? [resultEvent.id, awaitEvent.id] : [awaitEvent.id]
          });
          throw error;
        });
      };
    }
  });

  // src/backend/worker-router.js
  function runOnConnect(handler) {
    onConnectHandler = handler;
  }
  function getFirstPort() {
    return allPorts.keys().next().value;
  }
  function _eventuallySendToDefaultHelper(message, resolve, reject) {
    const port = getFirstPort();
    if (!port) {
      reject(new Error("No default route to the main thread."));
      return;
    }
    const uid = message.uid = nextMessageUid++;
    port._messages.set(uid, { message, resolve, reject });
    port.postMessage(message);
  }
  async function eventuallySendToDefault(message) {
    return new Promise((resolve, reject) => {
      _eventuallySendToDefaultHelper(message, resolve, reject);
    });
  }
  function unregister(type) {
    listeners.delete(type);
  }
  function registerSimple(type, callback) {
    listeners.set(type, callback);
    return function sendSimpleMessage(cmd, args, explicitPort) {
      const msg = { type, uid: null, cmd, args };
      if (explicitPort) {
        explicitPort.postMessage(msg);
      } else {
        eventuallySendToDefault(msg).then(callback);
      }
    };
  }
  function registerCallbackType(type) {
    let sender = callbackSenders.get(type);
    if (!sender) {
      sender = function sendCallbackMessage(cmd, args) {
        return eventuallySendToDefault({ type, cmd, args });
      };
      callbackSenders.set(type, sender);
    }
    return sender;
  }
  function registerInstanceType(type) {
    const instanceMap = new Map();
    listeners.set(type, function receiveInstanceMessage(data) {
      instanceMap.get(data.uid)?.(data);
    });
    return {
      register(instanceListener, usePort) {
        const uid = nextMessageUid++;
        instanceMap.set(uid, instanceListener);
        return {
          sendMessage: function sendInstanceMessage(cmd, args) {
            try {
              usePort.postMessage({ type, uid, cmd, args });
            } catch (ex) {
              console.error("serialization error", ex, "on", args);
            }
          },
          unregister: function unregisterInstance() {
            instanceMap.delete(uid);
          }
        };
      }
    };
  }
  async function callOnMainThread({ cmd, args }) {
    const { args: result } = await eventuallySendToDefault({
      type: "mainThreadService",
      cmd,
      args
    });
    return result;
  }
  var nextMessageUid, onConnectHandler, allPorts, callbackSenders, listeners;
  var init_worker_router = __esm({
    "src/backend/worker-router.js"() {
      nextMessageUid = 0;
      onConnectHandler = null;
      allPorts = new Map();
      callbackSenders = new Map();
      listeners = new Map([
        [
          "willDie",
          (data, port) => {
            const { resolveCleanupPromise } = allPorts.get(port);
            resolveCleanupPromise();
            allPorts.delete(port);
            for (const { message, resolve, reject } of port._messages.values()) {
              _eventuallySendToDefaultHelper(message, resolve, reject);
            }
          }
        ]
      ]);
      onconnect = (connectionEvent) => {
        const port = connectionEvent.ports[0];
        let portCleanupInfo = {};
        const cleanupPromise = new Promise((resolveCleanupPromise) => {
          portCleanupInfo.resolveCleanupPromise = resolveCleanupPromise;
          allPorts.set(port, portCleanupInfo);
        });
        portCleanupInfo.cleanupPromise = cleanupPromise;
        const portMessages = port._messages = new Map();
        port.onmessage = (messageEvent) => {
          if (!allPorts.has(port)) {
            return;
          }
          const { data } = messageEvent;
          if (portMessages.has(data.uid)) {
            const { uid, cmd, args, error } = data;
            const { resolve, reject } = portMessages.get(uid);
            portMessages.delete(uid);
            if (error) {
              reject(new Error(error));
            } else {
              resolve({ cmd, args });
            }
          } else {
            listeners.get(data.type)?.(data, port, cleanupPromise);
          }
        };
        onConnectHandler?.(port);
      };
    }
  });

  // src/backend/bodies/mailchew_strings.js
  function set(_strings) {
    strings = _strings;
    events.emit("strings", strings);
  }
  var import_evt2, events, strings;
  var init_mailchew_strings = __esm({
    "src/backend/bodies/mailchew_strings.js"() {
      import_evt2 = __toModule(require_evt());
      events = new import_evt2.default.Emitter();
      strings = null;
    }
  });

  // src/shared/date.js
  function EVENT_IN_SYNC_RANGE(eventInfo, syncRangeInfo) {
    return eventInfo.endDate < syncRangeInfo.rangeOldestTS || eventInfo.startDate > syncRangeInfo.rangeNewestTS;
  }
  function EVENT_OUTSIDE_SYNC_RANGE(eventInfo, syncRangeInfo) {
    return !EVENT_IN_SYNC_RANGE(eventInfo, syncRangeInfo);
  }
  function TEST_LetsDoTheTimewarpAgain(fakeNow) {
    if (fakeNow === null) {
      TIME_WARPED_NOW = null;
      return;
    }
    if (typeof fakeNow !== "number") {
      fakeNow = fakeNow.valueOf();
    }
    TIME_WARPED_NOW = fakeNow;
  }
  function NOW() {
    return TIME_WARPED_NOW || Date.now();
  }
  function PERFNOW() {
    return TIME_WARPED_NOW || perfObj.now();
  }
  function makeDaysAgo(numDays) {
    var past = quantizeDate(TIME_WARPED_NOW || Date.now()) - numDays * DAY_MILLIS;
    return past;
  }
  function quantizeDate(date) {
    if (date === null) {
      return null;
    }
    if (typeof date === "number") {
      date = new Date(date);
    }
    return date.setUTCHours(0, 0, 0, 0).valueOf();
  }
  var HOUR_MILLIS, DAY_MILLIS, TIME_WARPED_NOW, perfObj;
  var init_date = __esm({
    "src/shared/date.js"() {
      HOUR_MILLIS = 60 * 60 * 1e3;
      DAY_MILLIS = 24 * 60 * 60 * 1e3;
      TIME_WARPED_NOW = null;
      perfObj = typeof performance !== "undefined" ? performance : Date;
    }
  });

  // src/backend/parsers/xml/namespaces.js
  var NamespaceIds;
  var init_namespaces = __esm({
    "src/backend/parsers/xml/namespaces.js"() {
      NamespaceIds = new Map([
        [
          "local",
          {
            id: 0,
            check: (ns) => false
          }
        ],
        [
          "atom",
          {
            id: 1,
            check: (ns) => ns === "http://www.w3.org/2005/Atom"
          }
        ],
        [
          "xhtml",
          {
            id: 2,
            check: (ns) => ns === "http://www.w3.org/1999/xhtml"
          }
        ]
      ]);
    }
  });

  // src/backend/parsers/xml/utils.js
  function validateString({ data, defaultValue, validate: validate2, convert = null }) {
    if (!data) {
      return defaultValue;
    }
    data = data.trim();
    if (validate2(data)) {
      return convert ? convert(data) : data;
    }
    return defaultValue;
  }
  function encodeToXmlString(str) {
    const buffer = [];
    let start = 0;
    for (let i = 0, ii = str.length; i < ii; i++) {
      const char = str.codePointAt(i);
      if (32 <= char && char <= 126) {
        const entity = XMLEntities[char];
        if (entity) {
          if (start < i) {
            buffer.push(str.substring(start, i));
          }
          buffer.push(entity);
          start = i + 1;
        }
      } else {
        if (start < i) {
          buffer.push(str.substring(start, i));
        }
        buffer.push(`&#x${char.toString(16).toUpperCase()};`);
        if (char > 55295 && (char < 57344 || char > 65533)) {
          i++;
        }
        start = i + 1;
      }
    }
    if (buffer.length === 0) {
      return str;
    }
    if (start < str.length) {
      buffer.push(str.substring(start, str.length));
    }
    return buffer.join("");
  }
  var XMLEntities;
  var init_utils = __esm({
    "src/backend/parsers/xml/utils.js"() {
      XMLEntities = {
        60: "&lt;",
        62: "&gt;",
        38: "&amp;",
        34: "&quot;",
        39: "&apos;"
      };
    }
  });

  // src/backend/parsers/xml/xml_object.js
  var XMLObject, XMLObjectArray, StringObject, XmlNodeObject;
  var init_xml_object = __esm({
    "src/backend/parsers/xml/xml_object.js"() {
      init_utils();
      XMLObject = class {
        constructor(nsId, name) {
          this.$namespaceId = nsId;
          this.$nodeName = name;
        }
        $onChild(child) {
          if (!this.$onChildCheck(child)) {
            return;
          }
          const name = child.$nodeName;
          const node = this[name];
          if (node instanceof XMLObjectArray) {
            node.push(child);
          } else {
            this[name] = child;
          }
        }
        $onChildCheck(child) {
          return this.hasOwnProperty(child.$nodeName) && child.$namespaceId === this.$namespaceId;
        }
        $onText(_) {
        }
        $finalize() {
        }
        $clean(builder) {
          if (this.$cleanup) {
            builder.clean(this.$cleanup);
            delete this.$cleanup;
          }
        }
        $dump() {
          const dumped = Object.create(null);
          let empty = true;
          for (const name of Object.getOwnPropertyNames(this)) {
            if (name.startsWith("$")) {
              continue;
            }
            const value = this[name];
            const dumpedValue = value?.$dump ? value.$dump() : value;
            if (dumpedValue === null || dumpedValue === void 0 || dumpedValue === "" || Array.isArray(dumpedValue) && dumpedValue.length === 0) {
              continue;
            }
            empty = false;
            dumped[name] = dumpedValue;
          }
          if (!this.$content) {
            return empty ? null : dumped;
          }
          const content = this.$content?.$dump ? this.$content.$dump() : this.$content;
          if (empty) {
            return content;
          }
          dumped["#content"] = content;
          return dumped;
        }
      };
      XMLObjectArray = class {
        #max;
        constructor(max = Infinity) {
          this.#max = max;
          this.children = [];
        }
        push(child) {
          if (this.children.length <= this.#max) {
            this.children.push(child);
          }
        }
        isEmpty() {
          return this.children.length === 0;
        }
        $dump() {
          return this.children.map((v) => v.$dump()).filter((v) => !!v);
        }
      };
      StringObject = class extends XMLObject {
        constructor(nsId, name) {
          super(nsId, name);
          this.$content = "";
        }
        $onChild(child) {
        }
        $onText(text) {
          this.$content += text;
        }
      };
      XmlNodeObject = class extends XMLObject {
        constructor(nsId, name, attributes = null) {
          super(nsId, name);
          this.$content = "";
          if (name !== "#text") {
            this.$attributes = attributes;
          }
          this.$children = [];
        }
        $serialize(buf) {
          const tagName = this.$nodeName;
          if (tagName === "#text") {
            buf.push(encodeToXmlString(this.$content));
            return;
          }
          buf.push(`<${tagName}`);
          if (this.$attributes) {
            for (const [ns, map] of this.$attributes) {
              const prefix = !ns ? "" : `${ns}:`;
              for (const [name, value] of map) {
                buf.push(` ${prefix}${name}="${encodeToXmlString(value)}"`);
              }
            }
          }
          if (!this.$content && this.$children.length === 0) {
            buf.push("/>");
            return;
          }
          buf.push(">");
          if (this.$content) {
            if (typeof this.$content === "string") {
              buf.push(encodeToXmlString(this.$content));
            } else {
              this.$content.$serialize(buf);
            }
          } else {
            for (const child of this.$children) {
              child.$serialize?.(buf);
            }
          }
          buf.push(`</${tagName}>`);
        }
        $onChild(child) {
          if (this.$content) {
            const node = new XmlNodeObject(this.$namespaceId, "#text");
            this.$children.push(node);
            node.$content = this.$content;
            this.$content = "";
          }
          this.$children.push(child);
        }
        $onText(str) {
          this.$content += str;
        }
        $finalize() {
          if (this.$content && this.$children.length) {
            const node = new XmlNodeObject(this.$namespaceId, "#text");
            this.$children.push(node);
            node.$content = this.$content;
            delete this.$content;
          }
        }
        $dump() {
          const buffer = [];
          this.$serialize(buffer);
          return buffer.join("");
        }
      };
    }
  });

  // src/backend/parsers/xml/atom.js
  var ATOM_NS_ID, XHTML_NS_ID, Atom, StringAtom, PlainTextConstruct, XHTMLTextConstruct, PersonConstruct, Name, Uri, Email, DateConstruct, Feed, Entry, InlineTextContent, InlineXHTMLContent, InlineOtherContent, OutOfLineContent, Author, Category, Contributor, Generator, Icon, Id, Link, Logo, Published, Source, Updated, AtomNamespace;
  var init_atom = __esm({
    "src/backend/parsers/xml/atom.js"() {
      init_namespaces();
      init_xml_object();
      init_utils();
      ATOM_NS_ID = NamespaceIds.get("atom").id;
      XHTML_NS_ID = NamespaceIds.get("xhtml").id;
      Atom = class extends XMLObject {
        constructor(name, attributes) {
          super(ATOM_NS_ID, name);
          this.base = attributes.get("base") || "";
          this.lang = validateString({
            data: attributes.get("lang"),
            defaultValue: "",
            validate: (s) => s.match(/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/)
          });
        }
        $onChildCheck(child) {
          return !child.$isInvalid && super.$onChildCheck(child);
        }
      };
      StringAtom = class extends Atom {
        constructor(name, attributes) {
          super(name, attributes);
          this.$content = "";
        }
        $onChild(child) {
        }
        $onText(text) {
          this.$content += text;
        }
      };
      PlainTextConstruct = class extends StringAtom {
        constructor(name, attributes) {
          super(name, attributes);
          this.$content = "";
          this.type = validateString({
            data: attributes.get("type"),
            defaultValue: "",
            validate: (s) => s === "text" || s === "html"
          });
        }
      };
      XHTMLTextConstruct = class extends Atom {
        constructor(name, attributes) {
          super(name, attributes);
          this.type = validateString({
            data: attributes.get("type"),
            defaultValue: "xhtml",
            validate: (s) => false
          });
          this.div = null;
        }
        $onChild(child) {
          if (child.$namespaceId === XHTML_NS_ID && child.$nodeName === "div") {
            this.div = child;
          }
        }
      };
      PersonConstruct = class extends Atom {
        constructor(name, attributes) {
          super(name, attributes);
          this.name = null;
          this.uri = null;
          this.email = null;
        }
        $finalize() {
          for (const propr of ["name", "uri", "email"]) {
            if (this[propr]) {
              this[propr] = this[propr].$content;
            }
          }
        }
      };
      Name = class extends StringObject {
        constructor() {
          super(ATOM_NS_ID, "name");
        }
      };
      Uri = class extends StringObject {
        constructor() {
          super(ATOM_NS_ID, "uri");
        }
      };
      Email = class extends StringObject {
        constructor() {
          super(ATOM_NS_ID, "email");
        }
        $finalize() {
          if (!this.$content.match(/^.+@.+$/)) {
            this.$content = "";
          }
        }
      };
      DateConstruct = class extends StringAtom {
        $finalize() {
          try {
            this.$content = new Date(this.$content);
          } catch {
            this.$isInvalid = true;
          }
        }
      };
      Feed = class extends Atom {
        constructor(attributes) {
          super("feed", attributes);
          this.author = new XMLObjectArray();
          this.category = new XMLObjectArray();
          this.contributor = new XMLObjectArray();
          this.generator = null;
          this.icon = null;
          this.id = null;
          this.link = new XMLObjectArray();
          this.logo = null;
          this.rights = null;
          this.subtitle = null;
          this.title = null;
          this.updated = null;
          this.entry = new XMLObjectArray();
        }
        $finalize() {
          for (const propr of ["id", "title", "updated"]) {
            if (this[propr] === null) {
              console.warn(`Atom - Required field ${propr} is not present.`);
            }
          }
          if (this.author.isEmpty() && this.entry.children.some((e) => e.author.isEmpty())) {
            console.warn("An atom:feed must have an atom:author unless all of its atom:entry children have an atom:author.");
          }
        }
      };
      Entry = class extends Atom {
        constructor(attributes) {
          super("entry", attributes);
          this.author = new XMLObjectArray();
          this.category = new XMLObjectArray();
          this.content = null;
          this.contributor = new XMLObjectArray();
          this.id = null;
          this.link = new XMLObjectArray();
          this.published = null;
          this.rights = null;
          this.source = null;
          this.summary = null;
          this.title = null;
          this.updated = null;
        }
        $finalize() {
          for (const propr of ["id", "title", "updated"]) {
            if (this[propr] === null) {
              console.warn(`Atom - Required field ${propr} is not present.`);
            }
          }
          if (!this.link.children.some((e) => e.rel === "alternate") && this.content === null) {
            console.warn("An atom:entry must have at least one atom:link element with a rel attribute of 'alternate' or an atom:content.");
          }
        }
      };
      InlineTextContent = class extends PlainTextConstruct {
        constructor(attributes) {
          super("content", attributes);
        }
      };
      InlineXHTMLContent = class extends XHTMLTextConstruct {
        constructor(attributes) {
          super("content", attributes);
        }
      };
      InlineOtherContent = class extends Atom {
        constructor(attributes) {
          super("content", attributes);
          this.$content = "";
          this.type = validateString({
            data: attributes.get("type"),
            defaultValue: "",
            validate: (s) => s.match(/^.+\/.+$/)
          });
        }
        $onText(text) {
          if (typeof this.$content === "string") {
            this.$content += text;
          } else {
            this.$content = text;
          }
        }
        $onChild(child) {
          this.$content = child;
        }
      };
      OutOfLineContent = class extends Atom {
        constructor(attributes) {
          super("content", attributes);
          this.type = validateString({
            data: attributes.get("type"),
            defaultValue: "",
            validate: (s) => s.match(/^.+\/.+$/)
          });
          this.src = attributes.get("src") || "";
        }
      };
      Author = class extends PersonConstruct {
        constructor(attributes) {
          super("author", attributes);
        }
      };
      Category = class extends Atom {
        constructor(attributes) {
          super("category", attributes);
          this.term = attributes.get("term") || "";
          this.scheme = attributes.get("scheme") || "";
          this.label = attributes.get("label") || "";
        }
        $onChild(child) {
        }
      };
      Contributor = class extends PersonConstruct {
        constructor(attributes) {
          super("contributor", attributes);
        }
      };
      Generator = class extends StringAtom {
        constructor(attributes) {
          super("generator", attributes);
          this.uri = attributes.get("uri") || "";
          this.version = attributes.get("version") || "";
        }
      };
      Icon = class extends StringAtom {
        constructor(attributes) {
          super("icon", attributes);
        }
      };
      Id = class extends StringAtom {
        constructor(attributes) {
          super("id", attributes);
        }
      };
      Link = class extends Atom {
        constructor(attributes) {
          super("link", attributes);
          this.href = attributes.get("href") || "";
          this.rel = attributes.get("rel") || "";
          this.type = attributes.get("type") || "";
          this.title = attributes.get("title") || "";
          this.length = attributes.get("length") || "";
        }
      };
      Logo = class extends StringAtom {
        constructor(attributes) {
          super("logo", attributes);
        }
      };
      Published = class extends DateConstruct {
        constructor(attributes) {
          super("published", attributes);
        }
      };
      Source = class extends Atom {
        constructor(attributes) {
          super("source", attributes);
          this.author = new XMLObjectArray();
          this.category = new XMLObjectArray();
          this.contributor = new XMLObjectArray();
          this.generator = null;
          this.icon = null;
          this.link = new XMLObjectArray();
          this.logo = null;
          this.rights = null;
          this.subtitle = null;
          this.updated = null;
        }
      };
      Updated = class extends DateConstruct {
        constructor(attributes) {
          super("updated", attributes);
        }
      };
      AtomNamespace = class {
        static $buildXMLObject(name, attributes) {
          attributes = attributes.get("");
          if (AtomNamespace.hasOwnProperty(name)) {
            return AtomNamespace[name](attributes);
          }
          if (["rights", "subtitle", "summary", "title"].includes(name)) {
            if (attributes.get("type") === "xhtml") {
              return new XHTMLTextConstruct(name, attributes);
            }
            return new PlainTextConstruct(name, attributes);
          }
          return void 0;
        }
        static name(attributes) {
          return new Name(attributes);
        }
        static uri(attributes) {
          return new Uri(attributes);
        }
        static email(attributes) {
          return new Email(attributes);
        }
        static feed(attributes) {
          return new Feed(attributes);
        }
        static entry(attributes) {
          return new Entry(attributes);
        }
        static content(attributes) {
          switch (attributes.get("type")) {
            case "text":
            case "html":
              return new InlineTextContent(attributes);
            case "xhtml":
              return new InlineXHTMLContent(attributes);
          }
          if (attributes.has("src")) {
            return new OutOfLineContent(attributes);
          }
          return new InlineOtherContent(attributes);
        }
        static author(attributes) {
          return new Author(attributes);
        }
        static category(attributes) {
          return new Category(attributes);
        }
        static contributor(attributes) {
          return new Contributor(attributes);
        }
        static generator(attributes) {
          return new Generator(attributes);
        }
        static icon(attributes) {
          return new Icon(attributes);
        }
        static id(attributes) {
          return new Id(attributes);
        }
        static logo(attributes) {
          return new Logo(attributes);
        }
        static link(attributes) {
          return new Link(attributes);
        }
        static published(attributes) {
          return new Published(attributes);
        }
        static source(attributes) {
          return new Source(attributes);
        }
        static updated(attributes) {
          return new Updated(attributes);
        }
      };
    }
  });

  // src/backend/parsers/xml/node_builder.js
  var Empty, NodeBuilder;
  var init_node_builder = __esm({
    "src/backend/parsers/xml/node_builder.js"() {
      init_namespaces();
      init_xml_object();
      Empty = class extends XMLObject {
        constructor() {
          super(-1, "");
        }
        $onChild() {
        }
      };
      NodeBuilder = class {
        #namespaceStack;
        #namespaceSetup;
        #rootNode;
        #currentNamespace;
        #namespacePrefixes;
        #namespaces;
        constructor(namespaceSetup, rootNode, localNamespace = null) {
          this.#namespaceStack = [];
          this.#namespaceSetup = namespaceSetup;
          this.#rootNode = rootNode;
          this.#currentNamespace = localNamespace;
          this.#namespacePrefixes = new Map();
          this.#namespaces = new Map();
        }
        buildRoot() {
          return this.#rootNode;
        }
        build({ nsPrefix, name, attributes }) {
          const namespace = attributes.get("").get("xmlns");
          const prefixes = attributes.get("xmlns");
          if (namespace) {
            this.#namespaceStack.push(this.#currentNamespace);
            this.#currentNamespace = this.#searchNamespace(namespace);
          }
          if (prefixes) {
            this.#addNamespacePrefix(prefixes);
          }
          const namespaceToUse = this.#getNamespaceToUse(nsPrefix);
          const node = namespaceToUse?.$buildXMLObject(name, attributes) || new Empty();
          if (namespace || prefixes) {
            node.$cleanup = {
              hasNamespace: !!namespace,
              prefixes
            };
          }
          return node;
        }
        #searchNamespace(nsName) {
          let ns = this.#namespaces.get(nsName);
          if (ns) {
            return ns;
          }
          for (const [name, { check }] of NamespaceIds) {
            if (!check(nsName)) {
              continue;
            }
            ns = this.#namespaceSetup[name];
            if (ns) {
              this.#namespaces.set(nsName, ns);
              return ns;
            }
            break;
          }
          return null;
        }
        #addNamespacePrefix(prefixes) {
          for (const [prefix, value] of prefixes) {
            const namespace = this.#searchNamespace(value);
            let prefixStack = this.#namespacePrefixes.get(prefix);
            if (!prefixStack) {
              prefixStack = [];
              this.#namespacePrefixes.set(prefix, prefixStack);
            }
            prefixStack.push(namespace);
          }
        }
        #getNamespaceToUse(prefix) {
          if (!prefix) {
            return this.#currentNamespace;
          }
          const prefixStack = this.#namespacePrefixes.get(prefix);
          if (prefixStack?.length) {
            return prefixStack[prefixStack.length - 1];
          }
          return null;
        }
        clean(data) {
          const { hasNamespace, prefixes } = data;
          if (hasNamespace) {
            this.#currentNamespace = this.#namespaceStack.pop();
          }
          if (prefixes) {
            for (const prefix of prefixes.keys()) {
              this.#namespacePrefixes.get(prefix).pop();
            }
          }
        }
      };
    }
  });

  // src/backend/parsers/xml/rss.js
  var RSS_NS_ID, DEFAULT_IMG_WIDTH, DEFAULT_IMG_HEIGHT, MAX_IMG_WIDTH, MAX_IMG_HEIGHT, Rss, Channel, PubDate, LastBuildDate, Category2, Cloud, Ttl, Image, Width, Height, TextInput, Item, Enclosure, Guid, Source2, RssNamespace;
  var init_rss = __esm({
    "src/backend/parsers/xml/rss.js"() {
      init_namespaces();
      init_xml_object();
      RSS_NS_ID = NamespaceIds.get("local").id;
      DEFAULT_IMG_WIDTH = 88;
      DEFAULT_IMG_HEIGHT = 31;
      MAX_IMG_WIDTH = 144;
      MAX_IMG_HEIGHT = 400;
      Rss = class extends XMLObject {
        constructor(attributes) {
          super(RSS_NS_ID, "rss");
          this.version = attributes.get("version") || "";
          this.channel = null;
        }
        $onChildCheck(child) {
          return !child.$isInvalid && super.$onChildCheck(child);
        }
      };
      Channel = class extends XMLObject {
        constructor(attributges) {
          super(RSS_NS_ID, "channel");
          this.title = null;
          this.link = null;
          this.description = null;
          this.language = null;
          this.copyright = null;
          this.managingEditor = null;
          this.webMaster = null;
          this.pubDate = null;
          this.lastBuildDate = null;
          this.category = null;
          this.generator = null;
          this.docs = null;
          this.cloud = null;
          this.ttl = null;
          this.image = null;
          this.textInput = null;
          this.skipHours = null;
          this.skipDays = null;
          this.item = new XMLObjectArray();
        }
        $onChildCheck(child) {
          return !child.$isInvalid && super.$onChildCheck(child);
        }
        $finalize() {
          this.$isInvalid = !(this.title && this.link && this.description);
        }
      };
      PubDate = class extends StringObject {
        constructor() {
          super(RSS_NS_ID, "pubDate");
        }
        $finalize() {
          this.$content = new Date(this.$content);
          this.$isInvalid = isNaN(this.$content);
        }
      };
      LastBuildDate = class extends StringObject {
        constructor() {
          super(RSS_NS_ID, "lastBuildDate");
        }
        $finalize() {
          this.$content = new Date(this.$content);
          this.$isInvalid = isNaN(this.$content);
        }
      };
      Category2 = class extends StringObject {
        constructor(attributes) {
          super(RSS_NS_ID, "category");
          this.domain = attributes.get("domain") || "";
        }
      };
      Cloud = class extends StringObject {
        constructor(attributes) {
          super(RSS_NS_ID, "cloud");
          this.domain = attributes.get("domain") || "";
          this.port = attributes.get("port") || "";
          this.path = attributes.get("path") || "";
          this.registerProcedure = attributes.get("registerProcedure") || "";
          this.protocol = attributes.get("protocol") || "";
        }
        $onText(text) {
        }
      };
      Ttl = class extends StringObject {
        constructor(attributes) {
          super(RSS_NS_ID, "ttl");
        }
        $finalize() {
          this.$content = parseInt(this.$content);
          if (isNaN(this.$content)) {
            this.$isInvalid = true;
          }
        }
      };
      Image = class extends XMLObject {
        constructor(attributes) {
          super(RSS_NS_ID, "image");
          this.url = null;
          this.title = null;
          this.link = null;
          this.width = null;
          this.height = null;
          this.description = null;
        }
        $onChild(child) {
          if (!this.$onChildCheck(child)) {
            return;
          }
          switch (child.$nodeName) {
            case "width":
              this.width = child.$content || DEFAULT_IMG_WIDTH;
              break;
            case "height":
              this.height = child.$content || DEFAULT_IMG_HEIGHT;
              break;
          }
        }
        $finalize() {
          this.$isInvalid = !(this.url && this.title && this.link);
        }
      };
      Width = class extends StringObject {
        constructor() {
          super(RSS_NS_ID, "width");
        }
        $finalize() {
          this.$content = parseInt(this.$content);
          this.$content = isNaN(this.$content) ? null : Math.min(MAX_IMG_WIDTH, Math.max(0, this.$content));
        }
      };
      Height = class extends StringObject {
        constructor() {
          super(RSS_NS_ID, "height");
        }
        $finalize() {
          this.$content = parseInt(this.$content);
          this.$content = isNaN(this.$content) ? null : Math.min(MAX_IMG_HEIGHT, Math.max(0, this.$content));
        }
      };
      TextInput = class extends XMLObject {
        constructor(attributes) {
          super(RSS_NS_ID, "textInput");
          this.title = null;
          this.description = null;
          this.name = null;
          this.link = null;
        }
      };
      Item = class extends XMLObject {
        constructor(attributes) {
          super(RSS_NS_ID, "item");
          this.title = null;
          this.description = null;
          this.link = null;
          this.author = null;
          this.category = new XMLObjectArray();
          this.comments = null;
          this.enclosure = null;
          this.guid = null;
          this.pubDate = null;
          this.source = null;
        }
      };
      Enclosure = class extends XMLObject {
        constructor(attributes) {
          super(RSS_NS_ID, "enclosure");
          this.url = attributes.get("url") || "";
          this.length = attributes.get("length") || "";
          this.type = attributes.get("type") || "";
        }
      };
      Guid = class extends StringObject {
        constructor(attributes) {
          super(RSS_NS_ID, "guid");
          this.isPermaLink = attributes.get("isPermaLink") || "";
        }
      };
      Source2 = class extends StringObject {
        constructor(attributes) {
          super(RSS_NS_ID, "source");
          this.url = attributes.get("url") || "";
        }
      };
      RssNamespace = class {
        static $buildXMLObject(name, attributes) {
          attributes = attributes.get("");
          if (RssNamespace.hasOwnProperty(name)) {
            return RssNamespace[name](attributes);
          }
          if ([
            "title",
            "link",
            "description",
            "name",
            "language",
            "copyright",
            "managingEditor",
            "webMaster",
            "generator",
            "docs",
            "author",
            "comments"
          ].includes(name)) {
            return new StringObject(RSS_NS_ID, name);
          }
          return void 0;
        }
        static rss(attributes) {
          return new Rss(attributes);
        }
        static channel(attributes) {
          return new Channel(attributes);
        }
        static pubDate(attributes) {
          return new PubDate(attributes);
        }
        static lastBuildDate(attributes) {
          return new LastBuildDate(attributes);
        }
        static category(attributes) {
          return new Category2(attributes);
        }
        static cloud(attributes) {
          return new Cloud(attributes);
        }
        static ttl(attributes) {
          return new Ttl(attributes);
        }
        static image(attributes) {
          return new Image(attributes);
        }
        static width(attributes) {
          return new Width(attributes);
        }
        static height(attributes) {
          return new Height(attributes);
        }
        static textInput(attributes) {
          return new TextInput(attributes);
        }
        static item(attributes) {
          return new Item(attributes);
        }
        static enclosure(attributes) {
          return new Enclosure(attributes);
        }
        static guid(attributes) {
          return new Guid(attributes);
        }
        static source(attributes) {
          return new Source2(attributes);
        }
      };
    }
  });

  // src/backend/parsers/xml/xhtml.js
  var XHTML_NS_ID2, XhtmlNamespace;
  var init_xhtml = __esm({
    "src/backend/parsers/xml/xhtml.js"() {
      init_xml_object();
      init_namespaces();
      XHTML_NS_ID2 = NamespaceIds.get("xhtml").id;
      XhtmlNamespace = class {
        static $buildXMLObject(name, attributes) {
          return new XmlNodeObject(XHTML_NS_ID2, name, attributes);
        }
      };
    }
  });

  // src/vendor/xml/basic_xml_parser.js
  function isWhitespace(s, index) {
    const ch = s[index];
    return ch === " " || ch === "\n" || ch === "\r" || ch === "	";
  }
  var XMLParserErrorCode, XMLParserBase;
  var init_basic_xml_parser = __esm({
    "src/vendor/xml/basic_xml_parser.js"() {
      XMLParserErrorCode = {
        NoError: 0,
        EndOfDocument: -1,
        UnterminatedCdat: -2,
        UnterminatedXmlDeclaration: -3,
        UnterminatedDoctypeDeclaration: -4,
        UnterminatedComment: -5,
        MalformedElement: -6,
        OutOfMemory: -7,
        UnterminatedAttributeValue: -8,
        UnterminatedElement: -9,
        ElementNeverBegun: -10
      };
      XMLParserBase = class {
        _resolveEntities(s) {
          return s.replace(/&([^;]+);/g, (all, entity) => {
            if (entity.substring(0, 2) === "#x") {
              return String.fromCodePoint(parseInt(entity.substring(2), 16));
            } else if (entity.substring(0, 1) === "#") {
              return String.fromCodePoint(parseInt(entity.substring(1), 10));
            }
            switch (entity) {
              case "lt":
                return "<";
              case "gt":
                return ">";
              case "amp":
                return "&";
              case "quot":
                return '"';
              case "apos":
                return "'";
            }
            return this.onResolveEntity(entity);
          });
        }
        _parseContent(s, start) {
          const attributes = [];
          let pos = start;
          function skipWs() {
            while (pos < s.length && isWhitespace(s, pos)) {
              ++pos;
            }
          }
          while (pos < s.length && !isWhitespace(s, pos) && s[pos] !== ">" && s[pos] !== "/") {
            ++pos;
          }
          const name = s.substring(start, pos);
          skipWs();
          while (pos < s.length && s[pos] !== ">" && s[pos] !== "/" && s[pos] !== "?") {
            skipWs();
            let attrName = "", attrValue = "";
            while (pos < s.length && !isWhitespace(s, pos) && s[pos] !== "=") {
              attrName += s[pos];
              ++pos;
            }
            skipWs();
            if (s[pos] !== "=") {
              return null;
            }
            ++pos;
            skipWs();
            const attrEndChar = s[pos];
            if (attrEndChar !== '"' && attrEndChar !== "'") {
              return null;
            }
            const attrEndIndex = s.indexOf(attrEndChar, ++pos);
            if (attrEndIndex < 0) {
              return null;
            }
            attrValue = s.substring(pos, attrEndIndex);
            attributes.push({
              name: attrName,
              value: this._resolveEntities(attrValue)
            });
            pos = attrEndIndex + 1;
            skipWs();
          }
          return {
            name,
            attributes,
            parsed: pos - start
          };
        }
        _parseProcessingInstruction(s, start) {
          let pos = start;
          function skipWs() {
            while (pos < s.length && isWhitespace(s, pos)) {
              ++pos;
            }
          }
          while (pos < s.length && !isWhitespace(s, pos) && s[pos] !== ">" && s[pos] !== "?" && s[pos] !== "/") {
            ++pos;
          }
          const name = s.substring(start, pos);
          skipWs();
          const attrStart = pos;
          while (pos < s.length && (s[pos] !== "?" || s[pos + 1] !== ">")) {
            ++pos;
          }
          const value = s.substring(attrStart, pos);
          return {
            name,
            value,
            parsed: pos - start
          };
        }
        parseXml(s) {
          let i = 0;
          while (i < s.length) {
            const ch = s[i];
            let j = i;
            if (ch === "<") {
              ++j;
              const ch2 = s[j];
              let q;
              switch (ch2) {
                case "/":
                  ++j;
                  q = s.indexOf(">", j);
                  if (q < 0) {
                    this.onError(XMLParserErrorCode.UnterminatedElement);
                    return;
                  }
                  this.onEndElement(s.substring(j, q));
                  j = q + 1;
                  break;
                case "?":
                  ++j;
                  const pi = this._parseProcessingInstruction(s, j);
                  if (s.substring(j + pi.parsed, j + pi.parsed + 2) !== "?>") {
                    this.onError(XMLParserErrorCode.UnterminatedXmlDeclaration);
                    return;
                  }
                  this.onPi(pi.name, pi.value);
                  j += pi.parsed + 2;
                  break;
                case "!":
                  if (s.substring(j + 1, j + 3) === "--") {
                    q = s.indexOf("-->", j + 3);
                    if (q < 0) {
                      this.onError(XMLParserErrorCode.UnterminatedComment);
                      return;
                    }
                    this.onComment(s.substring(j + 3, q));
                    j = q + 3;
                  } else if (s.substring(j + 1, j + 8) === "[CDATA[") {
                    q = s.indexOf("]]>", j + 8);
                    if (q < 0) {
                      this.onError(XMLParserErrorCode.UnterminatedCdat);
                      return;
                    }
                    this.onCdata(s.substring(j + 8, q));
                    j = q + 3;
                  } else if (s.substring(j + 1, j + 8) === "DOCTYPE") {
                    const q2 = s.indexOf("[", j + 8);
                    let complexDoctype = false;
                    q = s.indexOf(">", j + 8);
                    if (q < 0) {
                      this.onError(XMLParserErrorCode.UnterminatedDoctypeDeclaration);
                      return;
                    }
                    if (q2 > 0 && q > q2) {
                      q = s.indexOf("]>", j + 8);
                      if (q < 0) {
                        this.onError(XMLParserErrorCode.UnterminatedDoctypeDeclaration);
                        return;
                      }
                      complexDoctype = true;
                    }
                    const doctypeContent = s.substring(j + 8, q + (complexDoctype ? 1 : 0));
                    this.onDoctype(doctypeContent);
                    j = q + (complexDoctype ? 2 : 1);
                  } else {
                    this.onError(XMLParserErrorCode.MalformedElement);
                    return;
                  }
                  break;
                default:
                  const content = this._parseContent(s, j);
                  if (content === null) {
                    this.onError(XMLParserErrorCode.MalformedElement);
                    return;
                  }
                  let isClosed = false;
                  if (s.substring(j + content.parsed, j + content.parsed + 2) === "/>") {
                    isClosed = true;
                  } else if (s.substring(j + content.parsed, j + content.parsed + 1) !== ">") {
                    this.onError(XMLParserErrorCode.UnterminatedElement);
                    return;
                  }
                  this.onBeginElement(content.name, content.attributes, isClosed);
                  j += content.parsed + (isClosed ? 2 : 1);
                  break;
              }
            } else {
              while (j < s.length && s[j] !== "<") {
                j++;
              }
              const text = s.substring(i, j);
              this.onText(this._resolveEntities(text));
            }
            i = j;
          }
        }
        onResolveEntity(name) {
          return `&${name};`;
        }
        onPi(name, value) {
        }
        onComment(text) {
        }
        onCdata(text) {
        }
        onDoctype(doctypeContent) {
        }
        onText(text) {
        }
        onBeginElement(name, attributes, isEmpty) {
        }
        onEndElement(name) {
        }
        onError(code) {
        }
      };
    }
  });

  // src/backend/parsers/xml/xml_parser.js
  var XMLParser;
  var init_xml_parser = __esm({
    "src/backend/parsers/xml/xml_parser.js"() {
      init_basic_xml_parser();
      XMLParser = class extends XMLParserBase {
        #builder;
        #stack;
        #current;
        #errorCode;
        constructor(builder) {
          super();
          this.#builder = builder;
          this.#stack = [];
          this.#current = this.#builder.buildRoot();
          this.#errorCode = XMLParserErrorCode.NoError;
        }
        parse(data) {
          this.parseXml(data);
          if (this.#errorCode !== XMLParserErrorCode.NoError) {
            return null;
          }
          this.#current.$finalize();
          return this.#current.$dump();
        }
        onText(text) {
          this.#current.$onText(text.trim());
        }
        onCdata(text) {
          this.onText(text);
        }
        #getNameAndPrefix(name) {
          const i = name.indexOf(":");
          return [name.substring(i + 1), name.substring(0, i)];
        }
        #mkAttributes(attributes) {
          const attributesMap = new Map();
          attributesMap.set("", new Map());
          for (const { name, value } of attributes) {
            const [attribute, prefix] = this.#getNameAndPrefix(name);
            let attrs = attributesMap.get(prefix);
            if (!attrs) {
              attrs = new Map();
              attributesMap.set(prefix, attrs);
            }
            attrs.set(attribute, value);
          }
          return attributesMap;
        }
        onBeginElement(tagName, attributes, isEmpty) {
          const attributesMap = this.#mkAttributes(attributes);
          const [name, nsPrefix] = this.#getNameAndPrefix(tagName);
          const node = this.#builder.build({
            nsPrefix,
            name,
            attributes: attributesMap
          });
          if (isEmpty) {
            node.$finalize();
            this.#current.$onChild(node);
            node.$clean(this.#builder);
            return;
          }
          this.#stack.push(this.#current);
          this.#current = node;
        }
        onEndElement(name) {
          const node = this.#current;
          node.$finalize();
          this.#current = this.#stack.pop();
          this.#current.$onChild(node);
          node.$clean(this.#builder);
        }
        onError(code) {
          this.#errorCode = code;
        }
      };
    }
  });

  // src/backend/parsers/xml/feed_parser.js
  function parseFeed(str) {
    const nsSetUp = {
      atom: AtomNamespace,
      xhtml: XhtmlNamespace
    };
    const nodeBuilder = new NodeBuilder(nsSetUp, new Root(), RssNamespace);
    const parser = new XMLParser(nodeBuilder);
    return parser.parse(str);
  }
  var Root;
  var init_feed_parser = __esm({
    "src/backend/parsers/xml/feed_parser.js"() {
      init_atom();
      init_namespaces();
      init_node_builder();
      init_rss();
      init_xhtml();
      init_xml_object();
      init_xml_parser();
      Root = class extends XMLObject {
        constructor() {
          super(-1, "root");
        }
        $onChild(child) {
          const name = child.$nodeName;
          switch (name) {
            case "feed":
            case "entry":
              if (child.$namespaceId === NamespaceIds.get("atom").id && !this[name]) {
                this[name] = child;
              }
              break;
            case "rss":
              if (child.$namespaceId === NamespaceIds.get("local").id) {
                this.rss = child;
              }
              break;
          }
        }
      };
    }
  });

  // src/backend/parsers/json/feed_parser.js
  function isJsonFeed(headers) {
    return (headers.get("content-type") || "").toLowerCase().split(";").map((e) => e.trim()).some((e) => ["application/json", "application/feed+json"].includes(e));
  }
  function validate(obj, validator) {
    const newObj = Object.create(null);
    for (const [name, valueValidator] of Object.entries(validator.properties)) {
      if (!obj.hasOwnProperty(name)) {
        if (!valueValidator.optional) {
          throw new MissingRequiredError(name);
        }
        continue;
      }
      const value = obj[name];
      const result = valueValidator.validate(value, name);
      if (result !== null) {
        newObj[name] = result;
      }
    }
    if (validator.finalCheck && !validator.finalCheck(newObj)) {
      return null;
    }
    return Object.getOwnPropertyNames(newObj).length !== 0 ? newObj : null;
  }
  function makeOptionalOrRequired(validator, optional) {
    return {
      validate: (data, name) => {
        if (optional) {
          try {
            return validator.validate(data);
          } catch {
            return null;
          }
        }
        const result = validator.validate(data);
        if (result !== null) {
          return result;
        }
        throw new InvalidValueError(name);
      },
      optional
    };
  }
  function OptionalArray(validator) {
    return {
      validate: (x) => {
        if (!Array.isArray(x)) {
          return null;
        }
        const result = [];
        for (const el of x) {
          try {
            const r = validate(el, validator);
            if (r !== null) {
              result.push(r);
            }
          } catch {
          }
        }
        return result;
      },
      optional: true
    };
  }
  function Optional(validator) {
    return {
      validate: (x) => {
        try {
          return validate(x, validator);
        } catch {
          return null;
        }
      },
      optional: true
    };
  }
  function parseJsonFeed(str) {
    const obj = JSON.parse(str);
    return validate(obj, MainValidator);
  }
  var MissingRequiredError, InvalidValueError, StringValidator, OptionalString, RequiredString, OptionalInteger, OptionalBoolean, OptionalDate, AuthorValidator, HubValidator, AttachmentValidator, ItemValidator, MainValidator;
  var init_feed_parser2 = __esm({
    "src/backend/parsers/json/feed_parser.js"() {
      MissingRequiredError = class extends Error {
        constructor(name) {
          super(`"${name}" is a required property`);
          this.name = "JSONFeedMissingRequired";
        }
      };
      InvalidValueError = class extends Error {
        constructor(name) {
          super(`Invalid value for ${name} property`);
          this.name = "JSONFeedInvalidValue";
        }
      };
      StringValidator = {
        validate: (x) => typeof x === "string" ? x : null
      };
      OptionalString = makeOptionalOrRequired(StringValidator, true);
      RequiredString = makeOptionalOrRequired(StringValidator, false);
      OptionalInteger = makeOptionalOrRequired({
        validate: (x) => !isNaN(x) && x >= 0 ? parseInt(x) : null
      }, true);
      OptionalBoolean = makeOptionalOrRequired({
        validate: (x) => x === !!x ? x : null
      }, true);
      OptionalDate = makeOptionalOrRequired({
        validate: (x) => {
          const date = new Date(x);
          return isNaN(date) ? null : date;
        }
      }, true);
      AuthorValidator = {
        properties: {
          name: OptionalString,
          url: OptionalString,
          avatar: OptionalString
        }
      };
      HubValidator = {
        properties: {
          type: RequiredString,
          url: RequiredString
        }
      };
      AttachmentValidator = {
        properties: {
          url: RequiredString,
          mime_type: RequiredString,
          title: OptionalString,
          size_in_bytes: OptionalInteger,
          duration_in_seconds: OptionalInteger
        }
      };
      ItemValidator = {
        properties: {
          id: RequiredString,
          url: OptionalString,
          external_url: OptionalString,
          title: OptionalString,
          content_html: OptionalString,
          content_text: OptionalString,
          summary: OptionalString,
          image: OptionalString,
          banner_image: OptionalString,
          date_published: OptionalDate,
          date_modified: OptionalDate,
          authors: OptionalArray(AuthorValidator),
          author: Optional(AuthorValidator),
          tags: OptionalArray(StringValidator),
          language: OptionalString,
          attachments: OptionalArray(AttachmentValidator)
        },
        finalCheck(obj) {
          if (!obj.content_html && !obj.content_text) {
            return false;
          }
          if (obj.author) {
            if (!obj.authors) {
              obj.authors = [];
            }
            obj.authors.push(obj.author);
            delete obj.author;
          }
          return true;
        }
      };
      MainValidator = {
        properties: {
          version: RequiredString,
          title: RequiredString,
          home_page_url: OptionalString,
          feed_url: OptionalString,
          description: OptionalString,
          user_comment: OptionalString,
          next_url: OptionalString,
          icon: OptionalString,
          favicon: OptionalString,
          authors: OptionalArray(AuthorValidator),
          language: OptionalString,
          expired: OptionalBoolean,
          hubs: OptionalArray(HubValidator),
          items: OptionalArray(ItemValidator)
        },
        finalCheck(obj) {
          if (obj.feed_url && obj.next_url === obj.feed_url) {
            delete obj.next_url;
          }
          return true;
        }
      };
    }
  });

  // src/backend/parsers/html/feed_parser.js
  function isHFeed(headers) {
    return (headers.get("content-type") || "").toLowerCase().split(";").map((e) => e.trim()).some((e) => e === "text/html");
  }
  function parseHFeedFromUrl(url) {
    return callOnMainThread({
      cmd: "parseHFromUrl",
      args: [url, "feed"]
    });
  }
  function parseHFeed(str, url) {
    return callOnMainThread({
      cmd: "parseHFromStr",
      args: [str, url, "feed"]
    });
  }
  var init_feed_parser3 = __esm({
    "src/backend/parsers/html/feed_parser.js"() {
      init_worker_router();
    }
  });

  // src/shared/a64.js
  function encodeInt(v, padTo) {
    var sbits = [];
    do {
      sbits.push(ORDERED_ARBITRARY_BASE64_CHARS[v & 63]);
      v = Math.floor(v / 64);
    } while (v > 0);
    sbits.reverse();
    var estr = sbits.join("");
    if (padTo && estr.length < padTo) {
      return ZERO_PADDING.substring(0, padTo - estr.length) + estr;
    }
    return estr;
  }
  function decodeA64Int(es) {
    return parseInt(decodeUI64(es), 10);
  }
  function decodeUI64(es) {
    var iNonZero = 0;
    for (; es.charCodeAt(iNonZero) === 48; iNonZero++) {
    }
    if (iNonZero) {
      es = es.substring(iNonZero);
    }
    var v, i;
    if (es.length <= 8) {
      v = 0;
      for (i = 0; i < es.length; i++) {
        v = v * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(es[i]);
      }
      return v.toString(10);
    }
    var ues = es.substring(0, es.length - 6), uv = 0, les = es.substring(es.length - 6), lv = 0;
    for (i = 0; i < ues.length; i++) {
      uv = uv * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(ues[i]);
    }
    for (i = 0; i < les.length; i++) {
      lv = lv * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(les[i]);
    }
    var rsh14val = uv * P2_22 + Math.floor(lv / P2_14), uraw = rsh14val / E10_14_RSH_14, udv = Math.floor(uraw), uds = udv.toString();
    var rsh14Leftover = rsh14val - udv * E10_14_RSH_14, lowBitsRemoved = rsh14Leftover * P2_14 + lv % P2_14;
    var lds = lowBitsRemoved.toString();
    if (lds.length < 14) {
      lds = ZERO_PADDING.substring(0, 14 - lds.length) + lds;
    }
    return uds + lds;
  }
  var ORDERED_ARBITRARY_BASE64_CHARS, ZERO_PADDING, E10_14_RSH_14, P2_14, P2_22, P2_36;
  var init_a64 = __esm({
    "src/shared/a64.js"() {
      ORDERED_ARBITRARY_BASE64_CHARS = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j",
        "k",
        "l",
        "m",
        "n",
        "o",
        "p",
        "q",
        "r",
        "s",
        "t",
        "u",
        "v",
        "w",
        "x",
        "y",
        "z",
        "{",
        "}"
      ];
      ZERO_PADDING = "0000000000000000";
      E10_14_RSH_14 = Math.pow(10, 14) / Math.pow(2, 14);
      P2_14 = Math.pow(2, 14);
      P2_22 = Math.pow(2, 22);
      P2_36 = Math.pow(2, 36);
    }
  });

  // src/shared/id_conversions.js
  function makeAccountId(accountNum) {
    return encodeInt(accountNum);
  }
  function makeIdentityId(accountId, identityNum) {
    if (/\0/.test(accountId)) {
      throw new Error(`AccountId '${accountId}' has a nul!`);
    }
    return `${accountId}\0${encodeInt(identityNum)}`;
  }
  function accountIdFromIdentityId(identityId) {
    const pieces = identityId.split(/\0/g);
    if (pieces.length !== 2) {
      throw new Error(`Malformed IdentityId: ${identityId}`);
    }
    return pieces[0];
  }
  function getAccountIdBounds(accountId) {
    return {
      lower: accountId + "\0",
      upper: accountId + "\0\uFFF0"
    };
  }
  function makeFolderId(accountId, folderNum) {
    if (/\0/.test(accountId)) {
      throw new Error(`AccountId '${accountId}' has a nul!`);
    }
    return `${accountId}\0${encodeInt(folderNum)}`;
  }
  function accountIdFromFolderId(folderId) {
    const pieces = folderId.split(/\0/g);
    if (pieces.length !== 2) {
      throw new Error(`Malformed FolderId: ${folderId}`);
    }
    return pieces[0];
  }
  function decodeFolderIdComponentFromFolderId(folderId) {
    const pieces = folderId.split(/\0/g);
    if (pieces.length !== 2) {
      throw new Error(`Malformed FolderId: ${folderId}`);
    }
    return decodeA64Int(pieces[1]);
  }
  function makeFolderNamespacedConvId(folderId, convIdComponent) {
    const pieces = folderId.split(/\0/g);
    if (pieces.length !== 2) {
      throw new Error(`Malformed FolderId: ${folderId}`);
    }
    if (/\0/.test(convIdComponent)) {
      throw new Error(`ConvIdComnponent '${convIdComponent}' has a nul!`);
    }
    return `${folderId}\0${convIdComponent}`;
  }
  function makeGlobalNamespacedConvId(accountId, convIdComponent) {
    if (/\0/.test(accountId)) {
      throw new Error(`AccountId '${accountId}' has a nul!`);
    }
    return `${accountId}\0\0${convIdComponent}`;
  }
  function accountIdFromConvId(convId) {
    const pieces = convId.split(/\0/g);
    if (pieces.length !== 3) {
      throw new Error(`Malformed ConversationId: ${convId}`);
    }
    return pieces[0];
  }
  function makeMessageId(convId, messageIdComponent) {
    const pieces = convId.split(/\0/g);
    if (pieces.length !== 3) {
      throw new Error(`Malformed ConversationId: ${convId}`);
    }
    if (/\0/.test(messageIdComponent)) {
      throw new Error(`MessageIdComponent '${messageIdComponent}' has a nul!`);
    }
    return `${convId}\0${messageIdComponent}`;
  }
  function accountIdFromMessageId(messageId) {
    const pieces = messageId.split(/\0/g);
    if (pieces.length !== 4) {
      throw new Error(`Malformed MessageId: ${messageId}`);
    }
    return pieces[0];
  }
  function convIdFromMessageId(messageId) {
    const pieces = messageId.split(/\0/g);
    if (pieces.length !== 4) {
      throw new Error(`Malformed MessageId: ${messageId}`);
    }
    return pieces.slice(0, 3).join("\0");
  }
  function messageIdComponentFromMessageId(messageId) {
    const pieces = messageId.split(/\0/g);
    if (pieces.length !== 4) {
      throw new Error(`Malformed MessageId: ${messageId}`);
    }
    return pieces[3];
  }
  var init_id_conversions = __esm({
    "src/shared/id_conversions.js"() {
      init_a64();
    }
  });

  // src/backend/accounts/feed/configurator.js
  var configurator_exports = {};
  __export(configurator_exports, {
    default: () => configurateFeed
  });
  function configurateFeed(userDetails) {
    return {
      userDetails,
      credentials: {},
      typeFields: {},
      connInfoFields: {
        feedUrl: userDetails.feedUrl,
        feedType: ""
      }
    };
  }
  var init_configurator = __esm({
    "src/backend/accounts/feed/configurator.js"() {
    }
  });

  // src/backend/accounts/gapi/configurator.js
  var configurator_exports2 = {};
  __export(configurator_exports2, {
    default: () => configurateGapi
  });
  function configurateGapi(userDetails, domainInfo) {
    const credentials = {};
    if (domainInfo.oauth2Tokens) {
      credentials.oauth2 = {
        authEndpoint: domainInfo.oauth2Settings.authEndpoint,
        tokenEndpoint: domainInfo.oauth2Settings.tokenEndpoint,
        scope: domainInfo.oauth2Settings.scope,
        clientId: domainInfo.oauth2Secrets.clientId,
        clientSecret: domainInfo.oauth2Secrets.clientSecret,
        refreshToken: domainInfo.oauth2Tokens.refreshToken,
        accessToken: domainInfo.oauth2Tokens.accessToken,
        expireTimeMS: domainInfo.oauth2Tokens.expireTimeMS,
        _transientLastRenew: PERFNOW()
      };
    }
    return {
      userDetails,
      credentials,
      typeFields: {},
      connInfoFields: {},
      kind: "calendar"
    };
  }
  var init_configurator2 = __esm({
    "src/backend/accounts/gapi/configurator.js"() {
      init_date();
    }
  });

  // src/backend/accounts/mapi/configurator.js
  var configurator_exports3 = {};
  __export(configurator_exports3, {
    default: () => configurateMapi
  });
  function configurateMapi(userDetails, domainInfo) {
    const credentials = {};
    if (domainInfo.oauth2Tokens) {
      credentials.oauth2 = {
        authEndpoint: domainInfo.oauth2Settings.authEndpoint,
        tokenEndpoint: domainInfo.oauth2Settings.tokenEndpoint,
        scope: domainInfo.oauth2Settings.scope,
        clientId: domainInfo.oauth2Secrets.clientId,
        clientSecret: domainInfo.oauth2Secrets.clientSecret,
        refreshToken: domainInfo.oauth2Tokens.refreshToken,
        accessToken: domainInfo.oauth2Tokens.accessToken,
        expireTimeMS: domainInfo.oauth2Tokens.expireTimeMS,
        _transientLastRenew: PERFNOW()
      };
    }
    return {
      userDetails,
      credentials,
      typeFields: {},
      connInfoFields: {},
      kind: "calendar"
    };
  }
  var init_configurator3 = __esm({
    "src/backend/accounts/mapi/configurator.js"() {
      init_date();
    }
  });

  // src/backend/accounts/ical/configurator.js
  var configurator_exports4 = {};
  __export(configurator_exports4, {
    default: () => configurateICal
  });
  function configurateICal(userDetails) {
    return {
      userDetails,
      credentials: {},
      typeFields: {},
      connInfoFields: {
        calendarUrl: userDetails.calendarUrl
      }
    };
  }
  var init_configurator4 = __esm({
    "src/backend/accounts/ical/configurator.js"() {
    }
  });

  // src/backend/accounts/feed/validator.js
  var validator_exports = {};
  __export(validator_exports, {
    default: () => validateFeed
  });
  async function validateFeed({
    userDetails,
    credentials,
    connInfoFields
  }) {
    const { feedUrl } = connInfoFields;
    try {
      const feedReq = new Request(feedUrl, {});
      const feedResp = await fetch(feedReq);
      if (feedResp.status >= 400) {
        return {
          error: "unknown",
          errorDetails: {
            status: feedResp.status,
            feedUrl
          }
        };
      }
      const feedText = await feedResp.text();
      const headers = feedResp.headers;
      let parsed;
      if (isJsonFeed(headers)) {
        parsed = parseJsonFeed(feedText);
        connInfoFields.feedType = "json";
      } else if (isHFeed(headers)) {
        parsed = await parseHFeed(feedText, feedUrl);
        connInfoFields.feedType = "html";
      } else {
        parsed = parseFeed(feedText);
        connInfoFields.feedType = "xml";
      }
      if (!parsed) {
        throw new Error("Cannot parse the feed stream");
      }
    } catch (ex) {
      return {
        error: "unknown",
        errorDetails: {
          message: ex.toString()
        }
      };
    }
    return {
      engineFields: {
        engine: "feed",
        engineData: {},
        receiveProtoConn: null
      }
    };
  }
  var init_validator = __esm({
    "src/backend/accounts/feed/validator.js"() {
      init_feed_parser3();
      init_feed_parser2();
      init_feed_parser();
    }
  });

  // src/backend/utils/normalize_err.js
  function normalizeError(err) {
    return {
      name: err?.name,
      message: err?.message,
      stack: err?.stack
    };
  }
  var init_normalize_err = __esm({
    "src/backend/utils/normalize_err.js"() {
    }
  });

  // src/backend/errorutils.js
  function analyzeException(err) {
    if (err === "Connection refused") {
      err = { name: "ConnectionRefusedError" };
    } else if (typeof err === "string") {
      return err;
    }
    if (!err.name) {
      return null;
    }
    if (/^Security/.test(err.name)) {
      return "bad-security";
    } else if (/^ConnectionRefused/i.test(err.name)) {
      return "unresponsive-server";
    }
    return null;
  }
  var init_errorutils = __esm({
    "src/backend/errorutils.js"() {
    }
  });

  // src/backend/syncbase.js
  var AUTOCONFIG_TIMEOUT_MS, ISPDB_AUTOCONFIG_ROOT, POP3_INFER_ATTACHMENTS_SIZE, POP3_SNIPPET_SIZE_GOAL, OLDEST_SYNC_DATE, BYTES_PER_BLOB_CHUNK, BYTES_PER_IMAP_FETCH_CHUNK_REQUEST, CHECK_INTERVALS_ENUMS_TO_MS, CONNECT_TIMEOUT_MS, SYNC_RANGE_ENUMS_TO_MS, DESIRED_SNIPPET_LENGTH, DEFAULT_SEARCH_EXCERPT_SETTINGS, BLOB_BASE64_BATCH_CONVERT_SIZE, CRONSYNC_MAX_DURATION_MS;
  var init_syncbase = __esm({
    "src/backend/syncbase.js"() {
      init_date();
      AUTOCONFIG_TIMEOUT_MS = 30 * 1e3;
      ISPDB_AUTOCONFIG_ROOT = "https://live.mozillamessaging.com/autoconfig/v1.1/";
      POP3_INFER_ATTACHMENTS_SIZE = 512 * 1024;
      POP3_SNIPPET_SIZE_GOAL = 4 * 1024;
      OLDEST_SYNC_DATE = Date.UTC(1990, 0, 1);
      BYTES_PER_BLOB_CHUNK = 1024 * 1024;
      BYTES_PER_IMAP_FETCH_CHUNK_REQUEST = 1024 * 1024;
      CHECK_INTERVALS_ENUMS_TO_MS = {
        manual: 0,
        "3min": 3 * 60 * 1e3,
        "5min": 5 * 60 * 1e3,
        "10min": 10 * 60 * 1e3,
        "15min": 15 * 60 * 1e3,
        "30min": 30 * 60 * 1e3,
        "60min": 60 * 60 * 1e3
      };
      CONNECT_TIMEOUT_MS = 3e4;
      SYNC_RANGE_ENUMS_TO_MS = {
        auto: 30 * DAY_MILLIS,
        "1d": 1 * DAY_MILLIS,
        "3d": 3 * DAY_MILLIS,
        "1w": 7 * DAY_MILLIS,
        "2w": 14 * DAY_MILLIS,
        "1m": 30 * DAY_MILLIS,
        all: 30 * 365 * DAY_MILLIS
      };
      DESIRED_SNIPPET_LENGTH = 160;
      DEFAULT_SEARCH_EXCERPT_SETTINGS = {
        charsBefore: 16,
        charsAfter: 40
      };
      BLOB_BASE64_BATCH_CONVERT_SIZE = 9198 * 57;
      CRONSYNC_MAX_DURATION_MS = 60 * 1e3;
    }
  });

  // src/backend/oauth.js
  function ensureUpdatedCredentials(credentials, credsUpdatedCallback, forceRenew) {
    if (forceRenew) {
      console.log("ensureUpdatedCredentials: force renewing token");
    }
    var oauth2 = credentials.oauth2;
    if (oauth2 && (!oauth2.accessToken || oauth2.expireTimeMS < NOW()) || forceRenew) {
      return renewAccessToken(oauth2).then(function(newTokenData) {
        oauth2.accessToken = newTokenData.accessToken;
        oauth2.expireTimeMS = newTokenData.expireTimeMS;
        logic(scope, "credentials-changed", {
          _accessToken: oauth2.accessToken,
          expireTimeMS: oauth2.expireTimeMS
        });
        if (credsUpdatedCallback) {
          credsUpdatedCallback(credentials);
        }
      });
    }
    logic(scope, "credentials-ok");
    return Promise.resolve(false);
  }
  function renewAccessToken(oauthInfo) {
    logic(scope, "renewing-access-token");
    return new Promise(function(resolve, reject) {
      oauthInfo._transientLastRenew = PERFNOW();
      var xhr = logic.interceptable("oauth:renew-xhr", function() {
        return new XMLHttpRequest({ mozSystem: true });
      });
      xhr.open("POST", oauthInfo.tokenEndpoint, true);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.timeout = CONNECT_TIMEOUT_MS;
      xhr.send([
        "client_id=",
        encodeURIComponent(oauthInfo.clientId),
        "&client_secret=",
        encodeURIComponent(oauthInfo.clientSecret),
        "&refresh_token=",
        encodeURIComponent(oauthInfo.refreshToken),
        "&grant_type=refresh_token"
      ].join(""));
      xhr.onload = function() {
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            var errResp = JSON.parse(xhr.responseText);
          } catch (ex) {
          }
          logic(scope, "xhr-fail", {
            tokenEndpoint: oauthInfo.tokenEndpoint,
            status: xhr.status,
            errResp
          });
          reject("needs-oauth-reauth");
        } else {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data && data.access_token) {
              logic(scope, "got-access-token", {
                _accessToken: data.access_token
              });
              var expiresInMS = data.expires_in * 1e3;
              var expireTimeMS = NOW() + Math.max(0, expiresInMS - TIMEOUT_MS);
              resolve({
                accessToken: data.access_token,
                expireTimeMS
              });
            } else {
              logic(scope, "no-access-token", {
                data: xhr.responseText
              });
              reject("needs-oauth-reauth");
            }
          } catch (e) {
            logic(scope, "bad-json", {
              error: e,
              data: xhr.responseText
            });
            reject("needs-oauth-reauth");
          }
        }
      };
      xhr.onerror = function(err) {
        reject(analyzeException(err));
      };
      xhr.ontimeout = function() {
        reject("unresponsive-server");
      };
    });
  }
  var RENEW_WINDOW_MS, TIMEOUT_MS, scope;
  var init_oauth = __esm({
    "src/backend/oauth.js"() {
      init_errorutils();
      init_syncbase();
      init_logic();
      init_date();
      RENEW_WINDOW_MS = 30 * 60 * 1e3;
      TIMEOUT_MS = 30 * 1e3;
      scope = logic.scope("OAuth");
    }
  });

  // src/backend/utils/api_client.js
  var ApiClient;
  var init_api_client = __esm({
    "src/backend/utils/api_client.js"() {
      init_logic();
      init_oauth();
      ApiClient = class {
        constructor(credentials, accountId) {
          logic.defineScope(this, "ApiClient", { accountId });
          this.credentials = credentials;
          this._dirtyCredentials = false;
        }
        credentialsUpdated() {
          this._dirtyCredentials = true;
        }
        async apiGetCall(endpointUrl, params) {
          await ensureUpdatedCredentials(this.credentials, () => {
            this.credentialsUpdated();
          });
          const accessToken = this.credentials.oauth2.accessToken;
          const url = new URL(endpointUrl);
          for (const [key, value] of Object.entries(params || {})) {
            url.searchParams.set(key, value);
          }
          const headers = {
            Authorization: `Bearer ${accessToken}`
          };
          const resp = await fetch(url, {
            credentials: "omit",
            headers
          });
          const result = await resp.json();
          logic(this, "apiCall", { endpointUrl, _params: params, _result: result });
          return result;
        }
        async pagedApiGetCall(url, params, resultPropertyName, nextPageGetter) {
          let apiUrl = url;
          let useParams = Object.assign({}, params);
          const resultsSoFar = [];
          while (true) {
            const thisResult = await this.apiGetCall(apiUrl, useParams);
            if (thisResult.error) {
              return thisResult;
            }
            resultsSoFar.push(...thisResult[resultPropertyName]);
            const connectionInfo = nextPageGetter(thisResult);
            if (!connectionInfo) {
              thisResult[resultPropertyName] = resultsSoFar;
              return thisResult;
            }
            useParams = Object.assign({}, connectionInfo.params || params);
            apiUrl = connectionInfo.url || url;
          }
        }
      };
    }
  });

  // src/backend/accounts/gapi/validator.js
  var validator_exports2 = {};
  __export(validator_exports2, {
    default: () => validateGapi
  });
  async function validateGapi({
    userDetails,
    credentials,
    connInfoFields
  }) {
    const client = new ApiClient(credentials);
    const endpoint = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
    try {
      const whoami = await client.apiGetCall(endpoint, {});
      userDetails.displayName = "";
      userDetails.emailAddress = whoami.emailAddress;
    } catch (ex) {
      return {
        error: "unknown",
        errorDetails: {
          endpoint,
          ex: normalizeError(ex)
        }
      };
    }
    return {
      engineFields: {
        engine: "gapi",
        engineData: {}
      },
      receiveProtoConn: null
    };
  }
  var init_validator2 = __esm({
    "src/backend/accounts/gapi/validator.js"() {
      init_normalize_err();
      init_api_client();
    }
  });

  // src/backend/accounts/mapi/validator.js
  var validator_exports3 = {};
  __export(validator_exports3, {
    default: () => validateMapi
  });
  async function validateMapi({
    userDetails,
    credentials,
    connInfoFields
  }) {
    const client = new ApiClient(credentials);
    const endpoint = "https://graph.microsoft.com/v1.0/me";
    try {
      const whoami = await client.apiGetCall(endpoint, {});
      userDetails.displayName = whoami.displayName;
      userDetails.emailAddress = whoami.userPrincipalName;
    } catch (ex) {
      return {
        error: "unknown",
        errorDetails: {
          endpoint,
          ex
        }
      };
    }
    return {
      engineFields: {
        engine: "mapi",
        engineData: {},
        receiveProtoConn: null
      }
    };
  }
  var init_validator3 = __esm({
    "src/backend/accounts/mapi/validator.js"() {
      init_api_client();
    }
  });

  // src/vendor/ical.js
  var require_ical = __commonJS({
    "src/vendor/ical.js"(exports, module) {
      if (typeof module === "object") {
        ICAL = module.exports;
      } else if (typeof ICAL !== "object") {
        exports.ICAL = {};
      }
      ICAL.foldLength = 75;
      ICAL.newLineChar = "\r\n";
      ICAL.helpers = {
        updateTimezones: function(vcal) {
          var allsubs, properties, vtimezones, reqTzid, i, tzid;
          if (!vcal || vcal.name !== "vcalendar") {
            return vcal;
          }
          allsubs = vcal.getAllSubcomponents();
          properties = [];
          vtimezones = {};
          for (i = 0; i < allsubs.length; i++) {
            if (allsubs[i].name === "vtimezone") {
              tzid = allsubs[i].getFirstProperty("tzid").getFirstValue();
              vtimezones[tzid] = allsubs[i];
            } else {
              properties = properties.concat(allsubs[i].getAllProperties());
            }
          }
          reqTzid = {};
          for (i = 0; i < properties.length; i++) {
            if (tzid = properties[i].getParameter("tzid")) {
              reqTzid[tzid] = true;
            }
          }
          for (i in vtimezones) {
            if (vtimezones.hasOwnProperty(i) && !reqTzid[i]) {
              vcal.removeSubcomponent(vtimezones[i]);
            }
          }
          for (i in reqTzid) {
            if (reqTzid.hasOwnProperty(i) && !vtimezones[i] && ICAL.TimezoneService.has(i)) {
              vcal.addSubcomponent(ICAL.TimezoneService.get(i).component);
            }
          }
          return vcal;
        },
        isStrictlyNaN: function(number) {
          return typeof number === "number" && isNaN(number);
        },
        strictParseInt: function(string) {
          var result = parseInt(string, 10);
          if (ICAL.helpers.isStrictlyNaN(result)) {
            throw new Error('Could not extract integer from "' + string + '"');
          }
          return result;
        },
        formatClassType: function formatClassType(data, type) {
          if (typeof data === "undefined") {
            return void 0;
          }
          if (data instanceof type) {
            return data;
          }
          return new type(data);
        },
        unescapedIndexOf: function(buffer, search, pos) {
          while ((pos = buffer.indexOf(search, pos)) !== -1) {
            if (pos > 0 && buffer[pos - 1] === "\\") {
              pos += 1;
            } else {
              return pos;
            }
          }
          return -1;
        },
        binsearchInsert: function(list, seekVal, cmpfunc) {
          if (!list.length)
            return 0;
          var low = 0, high = list.length - 1, mid, cmpval;
          while (low <= high) {
            mid = low + Math.floor((high - low) / 2);
            cmpval = cmpfunc(seekVal, list[mid]);
            if (cmpval < 0)
              high = mid - 1;
            else if (cmpval > 0)
              low = mid + 1;
            else
              break;
          }
          if (cmpval < 0)
            return mid;
          else if (cmpval > 0)
            return mid + 1;
          else
            return mid;
        },
        dumpn: function() {
          if (!ICAL.debug) {
            return;
          }
          if (typeof console !== "undefined" && "log" in console) {
            ICAL.helpers.dumpn = function consoleDumpn(input) {
              console.log(input);
            };
          } else {
            ICAL.helpers.dumpn = function geckoDumpn(input) {
              dump(input + "\n");
            };
          }
          ICAL.helpers.dumpn(arguments[0]);
        },
        clone: function(aSrc, aDeep) {
          if (!aSrc || typeof aSrc != "object") {
            return aSrc;
          } else if (aSrc instanceof Date) {
            return new Date(aSrc.getTime());
          } else if ("clone" in aSrc) {
            return aSrc.clone();
          } else if (Array.isArray(aSrc)) {
            var arr = [];
            for (var i = 0; i < aSrc.length; i++) {
              arr.push(aDeep ? ICAL.helpers.clone(aSrc[i], true) : aSrc[i]);
            }
            return arr;
          } else {
            var obj = {};
            for (var name in aSrc) {
              if (Object.prototype.hasOwnProperty.call(aSrc, name)) {
                if (aDeep) {
                  obj[name] = ICAL.helpers.clone(aSrc[name], true);
                } else {
                  obj[name] = aSrc[name];
                }
              }
            }
            return obj;
          }
        },
        foldline: function foldline(aLine) {
          var result = "";
          var line = aLine || "";
          while (line.length) {
            result += ICAL.newLineChar + " " + line.substr(0, ICAL.foldLength);
            line = line.substr(ICAL.foldLength);
          }
          return result.substr(ICAL.newLineChar.length + 1);
        },
        pad2: function pad(data) {
          if (typeof data !== "string") {
            if (typeof data === "number") {
              data = parseInt(data);
            }
            data = String(data);
          }
          var len = data.length;
          switch (len) {
            case 0:
              return "00";
            case 1:
              return "0" + data;
            default:
              return data;
          }
        },
        trunc: function trunc(number) {
          return number < 0 ? Math.ceil(number) : Math.floor(number);
        },
        inherits: function(base, child, extra) {
          function F() {
          }
          F.prototype = base.prototype;
          child.prototype = new F();
          if (extra) {
            ICAL.helpers.extend(extra, child.prototype);
          }
        },
        extend: function(source, target) {
          for (var key in source) {
            var descr = Object.getOwnPropertyDescriptor(source, key);
            if (descr && !Object.getOwnPropertyDescriptor(target, key)) {
              Object.defineProperty(target, key, descr);
            }
          }
          return target;
        }
      };
      ICAL.design = function() {
        "use strict";
        var FROM_ICAL_NEWLINE = /\\\\|\\;|\\,|\\[Nn]/g;
        var TO_ICAL_NEWLINE = /\\|;|,|\n/g;
        var FROM_VCARD_NEWLINE = /\\\\|\\,|\\[Nn]/g;
        var TO_VCARD_NEWLINE = /\\|,|\n/g;
        function createTextType(fromNewline, toNewline) {
          var result = {
            matches: /.*/,
            fromICAL: function(aValue, structuredEscape) {
              return replaceNewline(aValue, fromNewline, structuredEscape);
            },
            toICAL: function(aValue, structuredEscape) {
              var regEx = toNewline;
              if (structuredEscape)
                regEx = new RegExp(regEx.source + "|" + structuredEscape);
              return aValue.replace(regEx, function(str) {
                switch (str) {
                  case "\\":
                    return "\\\\";
                  case ";":
                    return "\\;";
                  case ",":
                    return "\\,";
                  case "\n":
                    return "\\n";
                  default:
                    return str;
                }
              });
            }
          };
          return result;
        }
        var DEFAULT_TYPE_TEXT = { defaultType: "text" };
        var DEFAULT_TYPE_TEXT_MULTI = { defaultType: "text", multiValue: "," };
        var DEFAULT_TYPE_TEXT_STRUCTURED = { defaultType: "text", structuredValue: ";" };
        var DEFAULT_TYPE_INTEGER = { defaultType: "integer" };
        var DEFAULT_TYPE_DATETIME_DATE = { defaultType: "date-time", allowedTypes: ["date-time", "date"] };
        var DEFAULT_TYPE_DATETIME = { defaultType: "date-time" };
        var DEFAULT_TYPE_URI = { defaultType: "uri" };
        var DEFAULT_TYPE_UTCOFFSET = { defaultType: "utc-offset" };
        var DEFAULT_TYPE_RECUR = { defaultType: "recur" };
        var DEFAULT_TYPE_DATE_ANDOR_TIME = { defaultType: "date-and-or-time", allowedTypes: ["date-time", "date", "text"] };
        function replaceNewlineReplace(string) {
          switch (string) {
            case "\\\\":
              return "\\";
            case "\\;":
              return ";";
            case "\\,":
              return ",";
            case "\\n":
            case "\\N":
              return "\n";
            default:
              return string;
          }
        }
        function replaceNewline(value, newline, structuredEscape) {
          if (value.indexOf("\\") === -1) {
            return value;
          }
          if (structuredEscape)
            newline = new RegExp(newline.source + "|\\\\" + structuredEscape);
          return value.replace(newline, replaceNewlineReplace);
        }
        var commonProperties = {
          "categories": DEFAULT_TYPE_TEXT_MULTI,
          "url": DEFAULT_TYPE_URI,
          "version": DEFAULT_TYPE_TEXT,
          "uid": DEFAULT_TYPE_TEXT
        };
        var commonValues = {
          "boolean": {
            values: ["TRUE", "FALSE"],
            fromICAL: function(aValue) {
              switch (aValue) {
                case "TRUE":
                  return true;
                case "FALSE":
                  return false;
                default:
                  return false;
              }
            },
            toICAL: function(aValue) {
              if (aValue) {
                return "TRUE";
              }
              return "FALSE";
            }
          },
          float: {
            matches: /^[+-]?\d+\.\d+$/,
            fromICAL: function(aValue) {
              var parsed = parseFloat(aValue);
              if (ICAL.helpers.isStrictlyNaN(parsed)) {
                return 0;
              }
              return parsed;
            },
            toICAL: function(aValue) {
              return String(aValue);
            }
          },
          integer: {
            fromICAL: function(aValue) {
              var parsed = parseInt(aValue);
              if (ICAL.helpers.isStrictlyNaN(parsed)) {
                return 0;
              }
              return parsed;
            },
            toICAL: function(aValue) {
              return String(aValue);
            }
          },
          "utc-offset": {
            toICAL: function(aValue) {
              if (aValue.length < 7) {
                return aValue.substr(0, 3) + aValue.substr(4, 2);
              } else {
                return aValue.substr(0, 3) + aValue.substr(4, 2) + aValue.substr(7, 2);
              }
            },
            fromICAL: function(aValue) {
              if (aValue.length < 6) {
                return aValue.substr(0, 3) + ":" + aValue.substr(3, 2);
              } else {
                return aValue.substr(0, 3) + ":" + aValue.substr(3, 2) + ":" + aValue.substr(5, 2);
              }
            },
            decorate: function(aValue) {
              return ICAL.UtcOffset.fromString(aValue);
            },
            undecorate: function(aValue) {
              return aValue.toString();
            }
          }
        };
        var icalParams = {
          "cutype": {
            values: ["INDIVIDUAL", "GROUP", "RESOURCE", "ROOM", "UNKNOWN"],
            allowXName: true,
            allowIanaToken: true
          },
          "delegated-from": {
            valueType: "cal-address",
            multiValue: ",",
            multiValueSeparateDQuote: true
          },
          "delegated-to": {
            valueType: "cal-address",
            multiValue: ",",
            multiValueSeparateDQuote: true
          },
          "encoding": {
            values: ["8BIT", "BASE64"]
          },
          "fbtype": {
            values: ["FREE", "BUSY", "BUSY-UNAVAILABLE", "BUSY-TENTATIVE"],
            allowXName: true,
            allowIanaToken: true
          },
          "member": {
            valueType: "cal-address",
            multiValue: ",",
            multiValueSeparateDQuote: true
          },
          "partstat": {
            values: [
              "NEEDS-ACTION",
              "ACCEPTED",
              "DECLINED",
              "TENTATIVE",
              "DELEGATED",
              "COMPLETED",
              "IN-PROCESS"
            ],
            allowXName: true,
            allowIanaToken: true
          },
          "range": {
            values: ["THISANDFUTURE"]
          },
          "related": {
            values: ["START", "END"]
          },
          "reltype": {
            values: ["PARENT", "CHILD", "SIBLING"],
            allowXName: true,
            allowIanaToken: true
          },
          "role": {
            values: [
              "REQ-PARTICIPANT",
              "CHAIR",
              "OPT-PARTICIPANT",
              "NON-PARTICIPANT"
            ],
            allowXName: true,
            allowIanaToken: true
          },
          "rsvp": {
            values: ["TRUE", "FALSE"]
          },
          "sent-by": {
            valueType: "cal-address"
          },
          "tzid": {
            matches: /^\//
          },
          "value": {
            values: [
              "binary",
              "boolean",
              "cal-address",
              "date",
              "date-time",
              "duration",
              "float",
              "integer",
              "period",
              "recur",
              "text",
              "time",
              "uri",
              "utc-offset"
            ],
            allowXName: true,
            allowIanaToken: true
          }
        };
        var icalValues = ICAL.helpers.extend(commonValues, {
          text: createTextType(FROM_ICAL_NEWLINE, TO_ICAL_NEWLINE),
          uri: {},
          "binary": {
            decorate: function(aString) {
              return ICAL.Binary.fromString(aString);
            },
            undecorate: function(aBinary) {
              return aBinary.toString();
            }
          },
          "cal-address": {},
          "date": {
            decorate: function(aValue, aProp) {
              if (design.strict) {
                return ICAL.Time.fromDateString(aValue, aProp);
              } else {
                return ICAL.Time.fromString(aValue, aProp);
              }
            },
            undecorate: function(aValue) {
              return aValue.toString();
            },
            fromICAL: function(aValue) {
              if (!design.strict && aValue.length >= 15) {
                return icalValues["date-time"].fromICAL(aValue);
              } else {
                return aValue.substr(0, 4) + "-" + aValue.substr(4, 2) + "-" + aValue.substr(6, 2);
              }
            },
            toICAL: function(aValue) {
              var len = aValue.length;
              if (len == 10) {
                return aValue.substr(0, 4) + aValue.substr(5, 2) + aValue.substr(8, 2);
              } else if (len >= 19) {
                return icalValues["date-time"].toICAL(aValue);
              } else {
                return aValue;
              }
            }
          },
          "date-time": {
            fromICAL: function(aValue) {
              if (!design.strict && aValue.length == 8) {
                return icalValues.date.fromICAL(aValue);
              } else {
                var result = aValue.substr(0, 4) + "-" + aValue.substr(4, 2) + "-" + aValue.substr(6, 2) + "T" + aValue.substr(9, 2) + ":" + aValue.substr(11, 2) + ":" + aValue.substr(13, 2);
                if (aValue[15] && aValue[15] === "Z") {
                  result += "Z";
                }
                return result;
              }
            },
            toICAL: function(aValue) {
              var len = aValue.length;
              if (len == 10 && !design.strict) {
                return icalValues.date.toICAL(aValue);
              } else if (len >= 19) {
                var result = aValue.substr(0, 4) + aValue.substr(5, 2) + aValue.substr(8, 5) + aValue.substr(14, 2) + aValue.substr(17, 2);
                if (aValue[19] && aValue[19] === "Z") {
                  result += "Z";
                }
                return result;
              } else {
                return aValue;
              }
            },
            decorate: function(aValue, aProp) {
              if (design.strict) {
                return ICAL.Time.fromDateTimeString(aValue, aProp);
              } else {
                return ICAL.Time.fromString(aValue, aProp);
              }
            },
            undecorate: function(aValue) {
              return aValue.toString();
            }
          },
          duration: {
            decorate: function(aValue) {
              return ICAL.Duration.fromString(aValue);
            },
            undecorate: function(aValue) {
              return aValue.toString();
            }
          },
          period: {
            fromICAL: function(string) {
              var parts = string.split("/");
              parts[0] = icalValues["date-time"].fromICAL(parts[0]);
              if (!ICAL.Duration.isValueString(parts[1])) {
                parts[1] = icalValues["date-time"].fromICAL(parts[1]);
              }
              return parts;
            },
            toICAL: function(parts) {
              if (!design.strict && parts[0].length == 10) {
                parts[0] = icalValues.date.toICAL(parts[0]);
              } else {
                parts[0] = icalValues["date-time"].toICAL(parts[0]);
              }
              if (!ICAL.Duration.isValueString(parts[1])) {
                if (!design.strict && parts[1].length == 10) {
                  parts[1] = icalValues.date.toICAL(parts[1]);
                } else {
                  parts[1] = icalValues["date-time"].toICAL(parts[1]);
                }
              }
              return parts.join("/");
            },
            decorate: function(aValue, aProp) {
              return ICAL.Period.fromJSON(aValue, aProp, !design.strict);
            },
            undecorate: function(aValue) {
              return aValue.toJSON();
            }
          },
          recur: {
            fromICAL: function(string) {
              return ICAL.Recur._stringToData(string, true);
            },
            toICAL: function(data) {
              var str = "";
              for (var k in data) {
                if (!Object.prototype.hasOwnProperty.call(data, k)) {
                  continue;
                }
                var val = data[k];
                if (k == "until") {
                  if (val.length > 10) {
                    val = icalValues["date-time"].toICAL(val);
                  } else {
                    val = icalValues.date.toICAL(val);
                  }
                } else if (k == "wkst") {
                  if (typeof val === "number") {
                    val = ICAL.Recur.numericDayToIcalDay(val);
                  }
                } else if (Array.isArray(val)) {
                  val = val.join(",");
                }
                str += k.toUpperCase() + "=" + val + ";";
              }
              return str.substr(0, str.length - 1);
            },
            decorate: function decorate(aValue) {
              return ICAL.Recur.fromData(aValue);
            },
            undecorate: function(aRecur) {
              return aRecur.toJSON();
            }
          },
          time: {
            fromICAL: function(aValue) {
              if (aValue.length < 6) {
                return aValue;
              }
              var result = aValue.substr(0, 2) + ":" + aValue.substr(2, 2) + ":" + aValue.substr(4, 2);
              if (aValue[6] === "Z") {
                result += "Z";
              }
              return result;
            },
            toICAL: function(aValue) {
              if (aValue.length < 8) {
                return aValue;
              }
              var result = aValue.substr(0, 2) + aValue.substr(3, 2) + aValue.substr(6, 2);
              if (aValue[8] === "Z") {
                result += "Z";
              }
              return result;
            }
          }
        });
        var icalProperties = ICAL.helpers.extend(commonProperties, {
          "action": DEFAULT_TYPE_TEXT,
          "attach": { defaultType: "uri" },
          "attendee": { defaultType: "cal-address" },
          "calscale": DEFAULT_TYPE_TEXT,
          "class": DEFAULT_TYPE_TEXT,
          "comment": DEFAULT_TYPE_TEXT,
          "completed": DEFAULT_TYPE_DATETIME,
          "contact": DEFAULT_TYPE_TEXT,
          "created": DEFAULT_TYPE_DATETIME,
          "description": DEFAULT_TYPE_TEXT,
          "dtend": DEFAULT_TYPE_DATETIME_DATE,
          "dtstamp": DEFAULT_TYPE_DATETIME,
          "dtstart": DEFAULT_TYPE_DATETIME_DATE,
          "due": DEFAULT_TYPE_DATETIME_DATE,
          "duration": { defaultType: "duration" },
          "exdate": {
            defaultType: "date-time",
            allowedTypes: ["date-time", "date"],
            multiValue: ","
          },
          "exrule": DEFAULT_TYPE_RECUR,
          "freebusy": { defaultType: "period", multiValue: "," },
          "geo": { defaultType: "float", structuredValue: ";" },
          "last-modified": DEFAULT_TYPE_DATETIME,
          "location": DEFAULT_TYPE_TEXT,
          "method": DEFAULT_TYPE_TEXT,
          "organizer": { defaultType: "cal-address" },
          "percent-complete": DEFAULT_TYPE_INTEGER,
          "priority": DEFAULT_TYPE_INTEGER,
          "prodid": DEFAULT_TYPE_TEXT,
          "related-to": DEFAULT_TYPE_TEXT,
          "repeat": DEFAULT_TYPE_INTEGER,
          "rdate": {
            defaultType: "date-time",
            allowedTypes: ["date-time", "date", "period"],
            multiValue: ",",
            detectType: function(string) {
              if (string.indexOf("/") !== -1) {
                return "period";
              }
              return string.indexOf("T") === -1 ? "date" : "date-time";
            }
          },
          "recurrence-id": DEFAULT_TYPE_DATETIME_DATE,
          "resources": DEFAULT_TYPE_TEXT_MULTI,
          "request-status": DEFAULT_TYPE_TEXT_STRUCTURED,
          "rrule": DEFAULT_TYPE_RECUR,
          "sequence": DEFAULT_TYPE_INTEGER,
          "status": DEFAULT_TYPE_TEXT,
          "summary": DEFAULT_TYPE_TEXT,
          "transp": DEFAULT_TYPE_TEXT,
          "trigger": { defaultType: "duration", allowedTypes: ["duration", "date-time"] },
          "tzoffsetfrom": DEFAULT_TYPE_UTCOFFSET,
          "tzoffsetto": DEFAULT_TYPE_UTCOFFSET,
          "tzurl": DEFAULT_TYPE_URI,
          "tzid": DEFAULT_TYPE_TEXT,
          "tzname": DEFAULT_TYPE_TEXT
        });
        var vcardValues = ICAL.helpers.extend(commonValues, {
          text: createTextType(FROM_VCARD_NEWLINE, TO_VCARD_NEWLINE),
          uri: createTextType(FROM_VCARD_NEWLINE, TO_VCARD_NEWLINE),
          date: {
            decorate: function(aValue) {
              return ICAL.VCardTime.fromDateAndOrTimeString(aValue, "date");
            },
            undecorate: function(aValue) {
              return aValue.toString();
            },
            fromICAL: function(aValue) {
              if (aValue.length == 8) {
                return icalValues.date.fromICAL(aValue);
              } else if (aValue[0] == "-" && aValue.length == 6) {
                return aValue.substr(0, 4) + "-" + aValue.substr(4);
              } else {
                return aValue;
              }
            },
            toICAL: function(aValue) {
              if (aValue.length == 10) {
                return icalValues.date.toICAL(aValue);
              } else if (aValue[0] == "-" && aValue.length == 7) {
                return aValue.substr(0, 4) + aValue.substr(5);
              } else {
                return aValue;
              }
            }
          },
          time: {
            decorate: function(aValue) {
              return ICAL.VCardTime.fromDateAndOrTimeString("T" + aValue, "time");
            },
            undecorate: function(aValue) {
              return aValue.toString();
            },
            fromICAL: function(aValue) {
              var splitzone = vcardValues.time._splitZone(aValue, true);
              var zone = splitzone[0], value = splitzone[1];
              if (value.length == 6) {
                value = value.substr(0, 2) + ":" + value.substr(2, 2) + ":" + value.substr(4, 2);
              } else if (value.length == 4 && value[0] != "-") {
                value = value.substr(0, 2) + ":" + value.substr(2, 2);
              } else if (value.length == 5) {
                value = value.substr(0, 3) + ":" + value.substr(3, 2);
              }
              if (zone.length == 5 && (zone[0] == "-" || zone[0] == "+")) {
                zone = zone.substr(0, 3) + ":" + zone.substr(3);
              }
              return value + zone;
            },
            toICAL: function(aValue) {
              var splitzone = vcardValues.time._splitZone(aValue);
              var zone = splitzone[0], value = splitzone[1];
              if (value.length == 8) {
                value = value.substr(0, 2) + value.substr(3, 2) + value.substr(6, 2);
              } else if (value.length == 5 && value[0] != "-") {
                value = value.substr(0, 2) + value.substr(3, 2);
              } else if (value.length == 6) {
                value = value.substr(0, 3) + value.substr(4, 2);
              }
              if (zone.length == 6 && (zone[0] == "-" || zone[0] == "+")) {
                zone = zone.substr(0, 3) + zone.substr(4);
              }
              return value + zone;
            },
            _splitZone: function(aValue, isFromIcal) {
              var lastChar = aValue.length - 1;
              var signChar = aValue.length - (isFromIcal ? 5 : 6);
              var sign = aValue[signChar];
              var zone, value;
              if (aValue[lastChar] == "Z") {
                zone = aValue[lastChar];
                value = aValue.substr(0, lastChar);
              } else if (aValue.length > 6 && (sign == "-" || sign == "+")) {
                zone = aValue.substr(signChar);
                value = aValue.substr(0, signChar);
              } else {
                zone = "";
                value = aValue;
              }
              return [zone, value];
            }
          },
          "date-time": {
            decorate: function(aValue) {
              return ICAL.VCardTime.fromDateAndOrTimeString(aValue, "date-time");
            },
            undecorate: function(aValue) {
              return aValue.toString();
            },
            fromICAL: function(aValue) {
              return vcardValues["date-and-or-time"].fromICAL(aValue);
            },
            toICAL: function(aValue) {
              return vcardValues["date-and-or-time"].toICAL(aValue);
            }
          },
          "date-and-or-time": {
            decorate: function(aValue) {
              return ICAL.VCardTime.fromDateAndOrTimeString(aValue, "date-and-or-time");
            },
            undecorate: function(aValue) {
              return aValue.toString();
            },
            fromICAL: function(aValue) {
              var parts = aValue.split("T");
              return (parts[0] ? vcardValues.date.fromICAL(parts[0]) : "") + (parts[1] ? "T" + vcardValues.time.fromICAL(parts[1]) : "");
            },
            toICAL: function(aValue) {
              var parts = aValue.split("T");
              return vcardValues.date.toICAL(parts[0]) + (parts[1] ? "T" + vcardValues.time.toICAL(parts[1]) : "");
            }
          },
          timestamp: icalValues["date-time"],
          "language-tag": {
            matches: /^[a-zA-Z0-9-]+$/
          }
        });
        var vcardParams = {
          "type": {
            valueType: "text",
            multiValue: ","
          },
          "value": {
            values: [
              "text",
              "uri",
              "date",
              "time",
              "date-time",
              "date-and-or-time",
              "timestamp",
              "boolean",
              "integer",
              "float",
              "utc-offset",
              "language-tag"
            ],
            allowXName: true,
            allowIanaToken: true
          }
        };
        var vcardProperties = ICAL.helpers.extend(commonProperties, {
          "adr": { defaultType: "text", structuredValue: ";", multiValue: "," },
          "anniversary": DEFAULT_TYPE_DATE_ANDOR_TIME,
          "bday": DEFAULT_TYPE_DATE_ANDOR_TIME,
          "caladruri": DEFAULT_TYPE_URI,
          "caluri": DEFAULT_TYPE_URI,
          "clientpidmap": DEFAULT_TYPE_TEXT_STRUCTURED,
          "email": DEFAULT_TYPE_TEXT,
          "fburl": DEFAULT_TYPE_URI,
          "fn": DEFAULT_TYPE_TEXT,
          "gender": DEFAULT_TYPE_TEXT_STRUCTURED,
          "geo": DEFAULT_TYPE_URI,
          "impp": DEFAULT_TYPE_URI,
          "key": DEFAULT_TYPE_URI,
          "kind": DEFAULT_TYPE_TEXT,
          "lang": { defaultType: "language-tag" },
          "logo": DEFAULT_TYPE_URI,
          "member": DEFAULT_TYPE_URI,
          "n": { defaultType: "text", structuredValue: ";", multiValue: "," },
          "nickname": DEFAULT_TYPE_TEXT_MULTI,
          "note": DEFAULT_TYPE_TEXT,
          "org": { defaultType: "text", structuredValue: ";" },
          "photo": DEFAULT_TYPE_URI,
          "related": DEFAULT_TYPE_URI,
          "rev": { defaultType: "timestamp" },
          "role": DEFAULT_TYPE_TEXT,
          "sound": DEFAULT_TYPE_URI,
          "source": DEFAULT_TYPE_URI,
          "tel": { defaultType: "uri", allowedTypes: ["uri", "text"] },
          "title": DEFAULT_TYPE_TEXT,
          "tz": { defaultType: "text", allowedTypes: ["text", "utc-offset", "uri"] },
          "xml": DEFAULT_TYPE_TEXT
        });
        var vcard3Values = ICAL.helpers.extend(commonValues, {
          binary: icalValues.binary,
          date: vcardValues.date,
          "date-time": vcardValues["date-time"],
          "phone-number": {},
          uri: icalValues.uri,
          text: icalValues.text,
          time: icalValues.time,
          vcard: icalValues.text,
          "utc-offset": {
            toICAL: function(aValue) {
              return aValue.substr(0, 7);
            },
            fromICAL: function(aValue) {
              return aValue.substr(0, 7);
            },
            decorate: function(aValue) {
              return ICAL.UtcOffset.fromString(aValue);
            },
            undecorate: function(aValue) {
              return aValue.toString();
            }
          }
        });
        var vcard3Params = {
          "type": {
            valueType: "text",
            multiValue: ","
          },
          "value": {
            values: [
              "text",
              "uri",
              "date",
              "date-time",
              "phone-number",
              "time",
              "boolean",
              "integer",
              "float",
              "utc-offset",
              "vcard",
              "binary"
            ],
            allowXName: true,
            allowIanaToken: true
          }
        };
        var vcard3Properties = ICAL.helpers.extend(commonProperties, {
          fn: DEFAULT_TYPE_TEXT,
          n: { defaultType: "text", structuredValue: ";", multiValue: "," },
          nickname: DEFAULT_TYPE_TEXT_MULTI,
          photo: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
          bday: {
            defaultType: "date-time",
            allowedTypes: ["date-time", "date"],
            detectType: function(string) {
              return string.indexOf("T") === -1 ? "date" : "date-time";
            }
          },
          adr: { defaultType: "text", structuredValue: ";", multiValue: "," },
          label: DEFAULT_TYPE_TEXT,
          tel: { defaultType: "phone-number" },
          email: DEFAULT_TYPE_TEXT,
          mailer: DEFAULT_TYPE_TEXT,
          tz: { defaultType: "utc-offset", allowedTypes: ["utc-offset", "text"] },
          geo: { defaultType: "float", structuredValue: ";" },
          title: DEFAULT_TYPE_TEXT,
          role: DEFAULT_TYPE_TEXT,
          logo: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
          agent: { defaultType: "vcard", allowedTypes: ["vcard", "text", "uri"] },
          org: DEFAULT_TYPE_TEXT_STRUCTURED,
          note: DEFAULT_TYPE_TEXT_MULTI,
          prodid: DEFAULT_TYPE_TEXT,
          rev: {
            defaultType: "date-time",
            allowedTypes: ["date-time", "date"],
            detectType: function(string) {
              return string.indexOf("T") === -1 ? "date" : "date-time";
            }
          },
          "sort-string": DEFAULT_TYPE_TEXT,
          sound: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
          class: DEFAULT_TYPE_TEXT,
          key: { defaultType: "binary", allowedTypes: ["binary", "text"] }
        });
        var icalSet = {
          value: icalValues,
          param: icalParams,
          property: icalProperties
        };
        var vcardSet = {
          value: vcardValues,
          param: vcardParams,
          property: vcardProperties
        };
        var vcard3Set = {
          value: vcard3Values,
          param: vcard3Params,
          property: vcard3Properties
        };
        var design = {
          strict: true,
          defaultSet: icalSet,
          defaultType: "unknown",
          components: {
            vcard: vcardSet,
            vcard3: vcard3Set,
            vevent: icalSet,
            vtodo: icalSet,
            vjournal: icalSet,
            valarm: icalSet,
            vtimezone: icalSet,
            daylight: icalSet,
            standard: icalSet
          },
          icalendar: icalSet,
          vcard: vcardSet,
          vcard3: vcard3Set,
          getDesignSet: function(componentName) {
            var isInDesign = componentName && componentName in design.components;
            return isInDesign ? design.components[componentName] : design.defaultSet;
          }
        };
        return design;
      }();
      ICAL.stringify = function() {
        "use strict";
        var LINE_ENDING = "\r\n";
        var DEFAULT_VALUE_TYPE = "unknown";
        var design = ICAL.design;
        var helpers = ICAL.helpers;
        function stringify(jCal) {
          if (typeof jCal[0] == "string") {
            jCal = [jCal];
          }
          var i = 0;
          var len = jCal.length;
          var result = "";
          for (; i < len; i++) {
            result += stringify.component(jCal[i]) + LINE_ENDING;
          }
          return result;
        }
        stringify.component = function(component, designSet) {
          var name = component[0].toUpperCase();
          var result = "BEGIN:" + name + LINE_ENDING;
          var props = component[1];
          var propIdx = 0;
          var propLen = props.length;
          var designSetName = component[0];
          if (designSetName === "vcard" && component[1].length > 0 && !(component[1][0][0] === "version" && component[1][0][3] === "4.0")) {
            designSetName = "vcard3";
          }
          designSet = designSet || design.getDesignSet(designSetName);
          for (; propIdx < propLen; propIdx++) {
            result += stringify.property(props[propIdx], designSet) + LINE_ENDING;
          }
          var comps = component[2] || [];
          var compIdx = 0;
          var compLen = comps.length;
          for (; compIdx < compLen; compIdx++) {
            result += stringify.component(comps[compIdx], designSet) + LINE_ENDING;
          }
          result += "END:" + name;
          return result;
        };
        stringify.property = function(property, designSet, noFold) {
          var name = property[0].toUpperCase();
          var jsName = property[0];
          var params = property[1];
          var line = name;
          var paramName;
          for (paramName in params) {
            var value = params[paramName];
            if (params.hasOwnProperty(paramName)) {
              var multiValue = paramName in designSet.param && designSet.param[paramName].multiValue;
              if (multiValue && Array.isArray(value)) {
                if (designSet.param[paramName].multiValueSeparateDQuote) {
                  multiValue = '"' + multiValue + '"';
                }
                value = value.map(stringify._rfc6868Unescape);
                value = stringify.multiValue(value, multiValue, "unknown", null, designSet);
              } else {
                value = stringify._rfc6868Unescape(value);
              }
              line += ";" + paramName.toUpperCase();
              line += "=" + stringify.propertyValue(value);
            }
          }
          if (property.length === 3) {
            return line + ":";
          }
          var valueType = property[2];
          if (!designSet) {
            designSet = design.defaultSet;
          }
          var propDetails;
          var multiValue = false;
          var structuredValue = false;
          var isDefault = false;
          if (jsName in designSet.property) {
            propDetails = designSet.property[jsName];
            if ("multiValue" in propDetails) {
              multiValue = propDetails.multiValue;
            }
            if ("structuredValue" in propDetails && Array.isArray(property[3])) {
              structuredValue = propDetails.structuredValue;
            }
            if ("defaultType" in propDetails) {
              if (valueType === propDetails.defaultType) {
                isDefault = true;
              }
            } else {
              if (valueType === DEFAULT_VALUE_TYPE) {
                isDefault = true;
              }
            }
          } else {
            if (valueType === DEFAULT_VALUE_TYPE) {
              isDefault = true;
            }
          }
          if (!isDefault) {
            line += ";VALUE=" + valueType.toUpperCase();
          }
          line += ":";
          if (multiValue && structuredValue) {
            line += stringify.multiValue(property[3], structuredValue, valueType, multiValue, designSet, structuredValue);
          } else if (multiValue) {
            line += stringify.multiValue(property.slice(3), multiValue, valueType, null, designSet, false);
          } else if (structuredValue) {
            line += stringify.multiValue(property[3], structuredValue, valueType, null, designSet, structuredValue);
          } else {
            line += stringify.value(property[3], valueType, designSet, false);
          }
          return noFold ? line : ICAL.helpers.foldline(line);
        };
        stringify.propertyValue = function(value) {
          if (helpers.unescapedIndexOf(value, ",") === -1 && helpers.unescapedIndexOf(value, ":") === -1 && helpers.unescapedIndexOf(value, ";") === -1) {
            return value;
          }
          return '"' + value + '"';
        };
        stringify.multiValue = function(values, delim, type, innerMulti, designSet, structuredValue) {
          var result = "";
          var len = values.length;
          var i = 0;
          for (; i < len; i++) {
            if (innerMulti && Array.isArray(values[i])) {
              result += stringify.multiValue(values[i], innerMulti, type, null, designSet, structuredValue);
            } else {
              result += stringify.value(values[i], type, designSet, structuredValue);
            }
            if (i !== len - 1) {
              result += delim;
            }
          }
          return result;
        };
        stringify.value = function(value, type, designSet, structuredValue) {
          if (type in designSet.value && "toICAL" in designSet.value[type]) {
            return designSet.value[type].toICAL(value, structuredValue);
          }
          return value;
        };
        stringify._rfc6868Unescape = function(val) {
          return val.replace(/[\n^"]/g, function(x) {
            return RFC6868_REPLACE_MAP[x];
          });
        };
        var RFC6868_REPLACE_MAP = { '"': "^'", "\n": "^n", "^": "^^" };
        return stringify;
      }();
      ICAL.parse = function() {
        "use strict";
        var CHAR = /[^ \t]/;
        var MULTIVALUE_DELIMITER = ",";
        var VALUE_DELIMITER = ":";
        var PARAM_DELIMITER = ";";
        var PARAM_NAME_DELIMITER = "=";
        var DEFAULT_VALUE_TYPE = "unknown";
        var DEFAULT_PARAM_TYPE = "text";
        var design = ICAL.design;
        var helpers = ICAL.helpers;
        function ParserError(message) {
          this.message = message;
          this.name = "ParserError";
          try {
            throw new Error();
          } catch (e) {
            if (e.stack) {
              var split = e.stack.split("\n");
              split.shift();
              this.stack = split.join("\n");
            }
          }
        }
        ParserError.prototype = Error.prototype;
        function parser(input) {
          var state = {};
          var root = state.component = [];
          state.stack = [root];
          parser._eachLine(input, function(err, line) {
            parser._handleContentLine(line, state);
          });
          if (state.stack.length > 1) {
            throw new ParserError("invalid ical body. component began but did not end");
          }
          state = null;
          return root.length == 1 ? root[0] : root;
        }
        parser.property = function(str, designSet) {
          var state = {
            component: [[], []],
            designSet: designSet || design.defaultSet
          };
          parser._handleContentLine(str, state);
          return state.component[1][0];
        };
        parser.component = function(str) {
          return parser(str);
        };
        parser.ParserError = ParserError;
        parser._handleContentLine = function(line, state) {
          var valuePos = line.indexOf(VALUE_DELIMITER);
          var paramPos = line.indexOf(PARAM_DELIMITER);
          var lastParamIndex;
          var lastValuePos;
          var name;
          var value;
          var params = {};
          if (paramPos !== -1 && valuePos !== -1) {
            if (paramPos > valuePos) {
              paramPos = -1;
            }
          }
          var parsedParams;
          if (paramPos !== -1) {
            name = line.substring(0, paramPos).toLowerCase();
            parsedParams = parser._parseParameters(line.substring(paramPos), 0, state.designSet);
            if (parsedParams[2] == -1) {
              throw new ParserError("Invalid parameters in '" + line + "'");
            }
            params = parsedParams[0];
            lastParamIndex = parsedParams[1].length + parsedParams[2] + paramPos;
            if ((lastValuePos = line.substring(lastParamIndex).indexOf(VALUE_DELIMITER)) !== -1) {
              value = line.substring(lastParamIndex + lastValuePos + 1);
            } else {
              throw new ParserError("Missing parameter value in '" + line + "'");
            }
          } else if (valuePos !== -1) {
            name = line.substring(0, valuePos).toLowerCase();
            value = line.substring(valuePos + 1);
            if (name === "begin") {
              var newComponent = [value.toLowerCase(), [], []];
              if (state.stack.length === 1) {
                state.component.push(newComponent);
              } else {
                state.component[2].push(newComponent);
              }
              state.stack.push(state.component);
              state.component = newComponent;
              if (!state.designSet) {
                state.designSet = design.getDesignSet(state.component[0]);
              }
              return;
            } else if (name === "end") {
              state.component = state.stack.pop();
              return;
            }
          } else {
            throw new ParserError('invalid line (no token ";" or ":") "' + line + '"');
          }
          var valueType;
          var multiValue = false;
          var structuredValue = false;
          var propertyDetails;
          if (name in state.designSet.property) {
            propertyDetails = state.designSet.property[name];
            if ("multiValue" in propertyDetails) {
              multiValue = propertyDetails.multiValue;
            }
            if ("structuredValue" in propertyDetails) {
              structuredValue = propertyDetails.structuredValue;
            }
            if (value && "detectType" in propertyDetails) {
              valueType = propertyDetails.detectType(value);
            }
          }
          if (!valueType) {
            if (!("value" in params)) {
              if (propertyDetails) {
                valueType = propertyDetails.defaultType;
              } else {
                valueType = DEFAULT_VALUE_TYPE;
              }
            } else {
              valueType = params.value.toLowerCase();
            }
          }
          delete params.value;
          var result;
          if (multiValue && structuredValue) {
            value = parser._parseMultiValue(value, structuredValue, valueType, [], multiValue, state.designSet, structuredValue);
            result = [name, params, valueType, value];
          } else if (multiValue) {
            result = [name, params, valueType];
            parser._parseMultiValue(value, multiValue, valueType, result, null, state.designSet, false);
          } else if (structuredValue) {
            value = parser._parseMultiValue(value, structuredValue, valueType, [], null, state.designSet, structuredValue);
            result = [name, params, valueType, value];
          } else {
            value = parser._parseValue(value, valueType, state.designSet, false);
            result = [name, params, valueType, value];
          }
          if (state.component[0] === "vcard" && state.component[1].length === 0 && !(name === "version" && value === "4.0")) {
            state.designSet = design.getDesignSet("vcard3");
          }
          state.component[1].push(result);
        };
        parser._parseValue = function(value, type, designSet, structuredValue) {
          if (type in designSet.value && "fromICAL" in designSet.value[type]) {
            return designSet.value[type].fromICAL(value, structuredValue);
          }
          return value;
        };
        parser._parseParameters = function(line, start, designSet) {
          var lastParam = start;
          var pos = 0;
          var delim = PARAM_NAME_DELIMITER;
          var result = {};
          var name, lcname;
          var value, valuePos = -1;
          var type, multiValue, mvdelim;
          while (pos !== false && (pos = helpers.unescapedIndexOf(line, delim, pos + 1)) !== -1) {
            name = line.substr(lastParam + 1, pos - lastParam - 1);
            if (name.length == 0) {
              throw new ParserError("Empty parameter name in '" + line + "'");
            }
            lcname = name.toLowerCase();
            mvdelim = false;
            multiValue = false;
            if (lcname in designSet.param && designSet.param[lcname].valueType) {
              type = designSet.param[lcname].valueType;
            } else {
              type = DEFAULT_PARAM_TYPE;
            }
            if (lcname in designSet.param) {
              multiValue = designSet.param[lcname].multiValue;
              if (designSet.param[lcname].multiValueSeparateDQuote) {
                mvdelim = parser._rfc6868Escape('"' + multiValue + '"');
              }
            }
            var nextChar = line[pos + 1];
            if (nextChar === '"') {
              valuePos = pos + 2;
              pos = helpers.unescapedIndexOf(line, '"', valuePos);
              if (multiValue && pos != -1) {
                var extendedValue = true;
                while (extendedValue) {
                  if (line[pos + 1] == multiValue && line[pos + 2] == '"') {
                    pos = helpers.unescapedIndexOf(line, '"', pos + 3);
                  } else {
                    extendedValue = false;
                  }
                }
              }
              if (pos === -1) {
                throw new ParserError('invalid line (no matching double quote) "' + line + '"');
              }
              value = line.substr(valuePos, pos - valuePos);
              lastParam = helpers.unescapedIndexOf(line, PARAM_DELIMITER, pos);
              if (lastParam === -1) {
                pos = false;
              }
            } else {
              valuePos = pos + 1;
              var nextPos = helpers.unescapedIndexOf(line, PARAM_DELIMITER, valuePos);
              var propValuePos = helpers.unescapedIndexOf(line, VALUE_DELIMITER, valuePos);
              if (propValuePos !== -1 && nextPos > propValuePos) {
                nextPos = propValuePos;
                pos = false;
              } else if (nextPos === -1) {
                if (propValuePos === -1) {
                  nextPos = line.length;
                } else {
                  nextPos = propValuePos;
                }
                pos = false;
              } else {
                lastParam = nextPos;
                pos = nextPos;
              }
              value = line.substr(valuePos, nextPos - valuePos);
            }
            value = parser._rfc6868Escape(value);
            if (multiValue) {
              var delimiter = mvdelim || multiValue;
              value = parser._parseMultiValue(value, delimiter, type, [], null, designSet);
            } else {
              value = parser._parseValue(value, type, designSet);
            }
            if (multiValue && lcname in result) {
              if (Array.isArray(result[lcname])) {
                result[lcname].push(value);
              } else {
                result[lcname] = [
                  result[lcname],
                  value
                ];
              }
            } else {
              result[lcname] = value;
            }
          }
          return [result, value, valuePos];
        };
        parser._rfc6868Escape = function(val) {
          return val.replace(/\^['n^]/g, function(x) {
            return RFC6868_REPLACE_MAP[x];
          });
        };
        var RFC6868_REPLACE_MAP = { "^'": '"', "^n": "\n", "^^": "^" };
        parser._parseMultiValue = function(buffer, delim, type, result, innerMulti, designSet, structuredValue) {
          var pos = 0;
          var lastPos = 0;
          var value;
          if (delim.length === 0) {
            return buffer;
          }
          while ((pos = helpers.unescapedIndexOf(buffer, delim, lastPos)) !== -1) {
            value = buffer.substr(lastPos, pos - lastPos);
            if (innerMulti) {
              value = parser._parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
            } else {
              value = parser._parseValue(value, type, designSet, structuredValue);
            }
            result.push(value);
            lastPos = pos + delim.length;
          }
          value = buffer.substr(lastPos);
          if (innerMulti) {
            value = parser._parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
          } else {
            value = parser._parseValue(value, type, designSet, structuredValue);
          }
          result.push(value);
          return result.length == 1 ? result[0] : result;
        };
        parser._eachLine = function(buffer, callback) {
          var len = buffer.length;
          var lastPos = buffer.search(CHAR);
          var pos = lastPos;
          var line;
          var firstChar;
          var newlineOffset;
          do {
            pos = buffer.indexOf("\n", lastPos) + 1;
            if (pos > 1 && buffer[pos - 2] === "\r") {
              newlineOffset = 2;
            } else {
              newlineOffset = 1;
            }
            if (pos === 0) {
              pos = len;
              newlineOffset = 0;
            }
            firstChar = buffer[lastPos];
            if (firstChar === " " || firstChar === "	") {
              line += buffer.substr(lastPos + 1, pos - lastPos - (newlineOffset + 1));
            } else {
              if (line)
                callback(null, line);
              line = buffer.substr(lastPos, pos - lastPos - newlineOffset);
            }
            lastPos = pos;
          } while (pos !== len);
          line = line.trim();
          if (line.length)
            callback(null, line);
        };
        return parser;
      }();
      ICAL.Component = function() {
        "use strict";
        var PROPERTY_INDEX = 1;
        var COMPONENT_INDEX = 2;
        var NAME_INDEX = 0;
        function Component(jCal, parent) {
          if (typeof jCal === "string") {
            jCal = [jCal, [], []];
          }
          this.jCal = jCal;
          this.parent = parent || null;
        }
        Component.prototype = {
          _hydratedPropertyCount: 0,
          _hydratedComponentCount: 0,
          get name() {
            return this.jCal[NAME_INDEX];
          },
          get _designSet() {
            var parentDesign = this.parent && this.parent._designSet;
            return parentDesign || ICAL.design.getDesignSet(this.name);
          },
          _hydrateComponent: function(index) {
            if (!this._components) {
              this._components = [];
              this._hydratedComponentCount = 0;
            }
            if (this._components[index]) {
              return this._components[index];
            }
            var comp = new Component(this.jCal[COMPONENT_INDEX][index], this);
            this._hydratedComponentCount++;
            return this._components[index] = comp;
          },
          _hydrateProperty: function(index) {
            if (!this._properties) {
              this._properties = [];
              this._hydratedPropertyCount = 0;
            }
            if (this._properties[index]) {
              return this._properties[index];
            }
            var prop = new ICAL.Property(this.jCal[PROPERTY_INDEX][index], this);
            this._hydratedPropertyCount++;
            return this._properties[index] = prop;
          },
          getFirstSubcomponent: function(name) {
            if (name) {
              var i = 0;
              var comps = this.jCal[COMPONENT_INDEX];
              var len = comps.length;
              for (; i < len; i++) {
                if (comps[i][NAME_INDEX] === name) {
                  var result = this._hydrateComponent(i);
                  return result;
                }
              }
            } else {
              if (this.jCal[COMPONENT_INDEX].length) {
                return this._hydrateComponent(0);
              }
            }
            return null;
          },
          getAllSubcomponents: function(name) {
            var jCalLen = this.jCal[COMPONENT_INDEX].length;
            var i = 0;
            if (name) {
              var comps = this.jCal[COMPONENT_INDEX];
              var result = [];
              for (; i < jCalLen; i++) {
                if (name === comps[i][NAME_INDEX]) {
                  result.push(this._hydrateComponent(i));
                }
              }
              return result;
            } else {
              if (!this._components || this._hydratedComponentCount !== jCalLen) {
                for (; i < jCalLen; i++) {
                  this._hydrateComponent(i);
                }
              }
              return this._components || [];
            }
          },
          hasProperty: function(name) {
            var props = this.jCal[PROPERTY_INDEX];
            var len = props.length;
            var i = 0;
            for (; i < len; i++) {
              if (props[i][NAME_INDEX] === name) {
                return true;
              }
            }
            return false;
          },
          getFirstProperty: function(name) {
            if (name) {
              var i = 0;
              var props = this.jCal[PROPERTY_INDEX];
              var len = props.length;
              for (; i < len; i++) {
                if (props[i][NAME_INDEX] === name) {
                  var result = this._hydrateProperty(i);
                  return result;
                }
              }
            } else {
              if (this.jCal[PROPERTY_INDEX].length) {
                return this._hydrateProperty(0);
              }
            }
            return null;
          },
          getFirstPropertyValue: function(name) {
            var prop = this.getFirstProperty(name);
            if (prop) {
              return prop.getFirstValue();
            }
            return null;
          },
          getAllProperties: function(name) {
            var jCalLen = this.jCal[PROPERTY_INDEX].length;
            var i = 0;
            if (name) {
              var props = this.jCal[PROPERTY_INDEX];
              var result = [];
              for (; i < jCalLen; i++) {
                if (name === props[i][NAME_INDEX]) {
                  result.push(this._hydrateProperty(i));
                }
              }
              return result;
            } else {
              if (!this._properties || this._hydratedPropertyCount !== jCalLen) {
                for (; i < jCalLen; i++) {
                  this._hydrateProperty(i);
                }
              }
              return this._properties || [];
            }
          },
          _removeObjectByIndex: function(jCalIndex, cache, index) {
            cache = cache || [];
            if (cache[index]) {
              var obj = cache[index];
              if ("parent" in obj) {
                obj.parent = null;
              }
            }
            cache.splice(index, 1);
            this.jCal[jCalIndex].splice(index, 1);
          },
          _removeObject: function(jCalIndex, cache, nameOrObject) {
            var i = 0;
            var objects = this.jCal[jCalIndex];
            var len = objects.length;
            var cached = this[cache];
            if (typeof nameOrObject === "string") {
              for (; i < len; i++) {
                if (objects[i][NAME_INDEX] === nameOrObject) {
                  this._removeObjectByIndex(jCalIndex, cached, i);
                  return true;
                }
              }
            } else if (cached) {
              for (; i < len; i++) {
                if (cached[i] && cached[i] === nameOrObject) {
                  this._removeObjectByIndex(jCalIndex, cached, i);
                  return true;
                }
              }
            }
            return false;
          },
          _removeAllObjects: function(jCalIndex, cache, name) {
            var cached = this[cache];
            var objects = this.jCal[jCalIndex];
            var i = objects.length - 1;
            for (; i >= 0; i--) {
              if (!name || objects[i][NAME_INDEX] === name) {
                this._removeObjectByIndex(jCalIndex, cached, i);
              }
            }
          },
          addSubcomponent: function(component) {
            if (!this._components) {
              this._components = [];
              this._hydratedComponentCount = 0;
            }
            if (component.parent) {
              component.parent.removeSubcomponent(component);
            }
            var idx = this.jCal[COMPONENT_INDEX].push(component.jCal);
            this._components[idx - 1] = component;
            this._hydratedComponentCount++;
            component.parent = this;
            return component;
          },
          removeSubcomponent: function(nameOrComp) {
            var removed = this._removeObject(COMPONENT_INDEX, "_components", nameOrComp);
            if (removed) {
              this._hydratedComponentCount--;
            }
            return removed;
          },
          removeAllSubcomponents: function(name) {
            var removed = this._removeAllObjects(COMPONENT_INDEX, "_components", name);
            this._hydratedComponentCount = 0;
            return removed;
          },
          addProperty: function(property) {
            if (!(property instanceof ICAL.Property)) {
              throw new TypeError("must instance of ICAL.Property");
            }
            if (!this._properties) {
              this._properties = [];
              this._hydratedPropertyCount = 0;
            }
            if (property.parent) {
              property.parent.removeProperty(property);
            }
            var idx = this.jCal[PROPERTY_INDEX].push(property.jCal);
            this._properties[idx - 1] = property;
            this._hydratedPropertyCount++;
            property.parent = this;
            return property;
          },
          addPropertyWithValue: function(name, value) {
            var prop = new ICAL.Property(name);
            prop.setValue(value);
            this.addProperty(prop);
            return prop;
          },
          updatePropertyWithValue: function(name, value) {
            var prop = this.getFirstProperty(name);
            if (prop) {
              prop.setValue(value);
            } else {
              prop = this.addPropertyWithValue(name, value);
            }
            return prop;
          },
          removeProperty: function(nameOrProp) {
            var removed = this._removeObject(PROPERTY_INDEX, "_properties", nameOrProp);
            if (removed) {
              this._hydratedPropertyCount--;
            }
            return removed;
          },
          removeAllProperties: function(name) {
            var removed = this._removeAllObjects(PROPERTY_INDEX, "_properties", name);
            this._hydratedPropertyCount = 0;
            return removed;
          },
          toJSON: function() {
            return this.jCal;
          },
          toString: function() {
            return ICAL.stringify.component(this.jCal, this._designSet);
          }
        };
        Component.fromString = function(str) {
          return new Component(ICAL.parse.component(str));
        };
        return Component;
      }();
      ICAL.Property = function() {
        "use strict";
        var NAME_INDEX = 0;
        var PROP_INDEX = 1;
        var TYPE_INDEX = 2;
        var VALUE_INDEX = 3;
        var design = ICAL.design;
        function Property(jCal, parent) {
          this._parent = parent || null;
          if (typeof jCal === "string") {
            this.jCal = [jCal, {}, design.defaultType];
            this.jCal[TYPE_INDEX] = this.getDefaultType();
          } else {
            this.jCal = jCal;
          }
          this._updateType();
        }
        Property.prototype = {
          get type() {
            return this.jCal[TYPE_INDEX];
          },
          get name() {
            return this.jCal[NAME_INDEX];
          },
          get parent() {
            return this._parent;
          },
          set parent(p) {
            var designSetChanged = !this._parent || p && p._designSet != this._parent._designSet;
            this._parent = p;
            if (this.type == design.defaultType && designSetChanged) {
              this.jCal[TYPE_INDEX] = this.getDefaultType();
              this._updateType();
            }
            return p;
          },
          get _designSet() {
            return this.parent ? this.parent._designSet : design.defaultSet;
          },
          _updateType: function() {
            var designSet = this._designSet;
            if (this.type in designSet.value) {
              var designType = designSet.value[this.type];
              if ("decorate" in designSet.value[this.type]) {
                this.isDecorated = true;
              } else {
                this.isDecorated = false;
              }
              if (this.name in designSet.property) {
                this.isMultiValue = "multiValue" in designSet.property[this.name];
                this.isStructuredValue = "structuredValue" in designSet.property[this.name];
              }
            }
          },
          _hydrateValue: function(index) {
            if (this._values && this._values[index]) {
              return this._values[index];
            }
            if (this.jCal.length <= VALUE_INDEX + index) {
              return null;
            }
            if (this.isDecorated) {
              if (!this._values) {
                this._values = [];
              }
              return this._values[index] = this._decorate(this.jCal[VALUE_INDEX + index]);
            } else {
              return this.jCal[VALUE_INDEX + index];
            }
          },
          _decorate: function(value) {
            return this._designSet.value[this.type].decorate(value, this);
          },
          _undecorate: function(value) {
            return this._designSet.value[this.type].undecorate(value, this);
          },
          _setDecoratedValue: function(value, index) {
            if (!this._values) {
              this._values = [];
            }
            if (typeof value === "object" && "icaltype" in value) {
              this.jCal[VALUE_INDEX + index] = this._undecorate(value);
              this._values[index] = value;
            } else {
              this.jCal[VALUE_INDEX + index] = value;
              this._values[index] = this._decorate(value);
            }
          },
          getParameter: function(name) {
            if (name in this.jCal[PROP_INDEX]) {
              return this.jCal[PROP_INDEX][name];
            } else {
              return void 0;
            }
          },
          getFirstParameter: function(name) {
            var parameters = this.getParameter(name);
            if (Array.isArray(parameters)) {
              return parameters[0];
            }
            return parameters;
          },
          setParameter: function(name, value) {
            var lcname = name.toLowerCase();
            if (typeof value === "string" && lcname in this._designSet.param && "multiValue" in this._designSet.param[lcname]) {
              value = [value];
            }
            this.jCal[PROP_INDEX][name] = value;
          },
          removeParameter: function(name) {
            delete this.jCal[PROP_INDEX][name];
          },
          getDefaultType: function() {
            var name = this.jCal[NAME_INDEX];
            var designSet = this._designSet;
            if (name in designSet.property) {
              var details = designSet.property[name];
              if ("defaultType" in details) {
                return details.defaultType;
              }
            }
            return design.defaultType;
          },
          resetType: function(type) {
            this.removeAllValues();
            this.jCal[TYPE_INDEX] = type;
            this._updateType();
          },
          getFirstValue: function() {
            return this._hydrateValue(0);
          },
          getValues: function() {
            var len = this.jCal.length - VALUE_INDEX;
            if (len < 1) {
              return [];
            }
            var i = 0;
            var result = [];
            for (; i < len; i++) {
              result[i] = this._hydrateValue(i);
            }
            return result;
          },
          removeAllValues: function() {
            if (this._values) {
              this._values.length = 0;
            }
            this.jCal.length = 3;
          },
          setValues: function(values) {
            if (!this.isMultiValue) {
              throw new Error(this.name + ": does not not support mulitValue.\noverride isMultiValue");
            }
            var len = values.length;
            var i = 0;
            this.removeAllValues();
            if (len > 0 && typeof values[0] === "object" && "icaltype" in values[0]) {
              this.resetType(values[0].icaltype);
            }
            if (this.isDecorated) {
              for (; i < len; i++) {
                this._setDecoratedValue(values[i], i);
              }
            } else {
              for (; i < len; i++) {
                this.jCal[VALUE_INDEX + i] = values[i];
              }
            }
          },
          setValue: function(value) {
            this.removeAllValues();
            if (typeof value === "object" && "icaltype" in value) {
              this.resetType(value.icaltype);
            }
            if (this.isDecorated) {
              this._setDecoratedValue(value, 0);
            } else {
              this.jCal[VALUE_INDEX] = value;
            }
          },
          toJSON: function() {
            return this.jCal;
          },
          toICALString: function() {
            return ICAL.stringify.property(this.jCal, this._designSet, true);
          }
        };
        Property.fromString = function(str, designSet) {
          return new Property(ICAL.parse.property(str, designSet));
        };
        return Property;
      }();
      ICAL.UtcOffset = function() {
        function UtcOffset(aData) {
          this.fromData(aData);
        }
        UtcOffset.prototype = {
          hours: 0,
          minutes: 0,
          factor: 1,
          icaltype: "utc-offset",
          clone: function() {
            return ICAL.UtcOffset.fromSeconds(this.toSeconds());
          },
          fromData: function(aData) {
            if (aData) {
              for (var key in aData) {
                if (aData.hasOwnProperty(key)) {
                  this[key] = aData[key];
                }
              }
            }
            this._normalize();
          },
          fromSeconds: function(aSeconds) {
            var secs = Math.abs(aSeconds);
            this.factor = aSeconds < 0 ? -1 : 1;
            this.hours = ICAL.helpers.trunc(secs / 3600);
            secs -= this.hours * 3600;
            this.minutes = ICAL.helpers.trunc(secs / 60);
            return this;
          },
          toSeconds: function() {
            return this.factor * (60 * this.minutes + 3600 * this.hours);
          },
          compare: function icaltime_compare(other) {
            var a = this.toSeconds();
            var b = other.toSeconds();
            return (a > b) - (b > a);
          },
          _normalize: function() {
            var secs = this.toSeconds();
            var factor = this.factor;
            while (secs < -43200) {
              secs += 97200;
            }
            while (secs > 50400) {
              secs -= 97200;
            }
            this.fromSeconds(secs);
            if (secs == 0) {
              this.factor = factor;
            }
          },
          toICALString: function() {
            return ICAL.design.icalendar.value["utc-offset"].toICAL(this.toString());
          },
          toString: function toString() {
            return (this.factor == 1 ? "+" : "-") + ICAL.helpers.pad2(this.hours) + ":" + ICAL.helpers.pad2(this.minutes);
          }
        };
        UtcOffset.fromString = function(aString) {
          var options = {};
          options.factor = aString[0] === "+" ? 1 : -1;
          options.hours = ICAL.helpers.strictParseInt(aString.substr(1, 2));
          options.minutes = ICAL.helpers.strictParseInt(aString.substr(4, 2));
          return new ICAL.UtcOffset(options);
        };
        UtcOffset.fromSeconds = function(aSeconds) {
          var instance = new UtcOffset();
          instance.fromSeconds(aSeconds);
          return instance;
        };
        return UtcOffset;
      }();
      ICAL.Binary = function() {
        function Binary(aValue) {
          this.value = aValue;
        }
        Binary.prototype = {
          icaltype: "binary",
          decodeValue: function decodeValue() {
            return this._b64_decode(this.value);
          },
          setEncodedValue: function setEncodedValue(aValue) {
            this.value = this._b64_encode(aValue);
          },
          _b64_encode: function base64_encode(data) {
            var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = "", tmp_arr = [];
            if (!data) {
              return data;
            }
            do {
              o1 = data.charCodeAt(i++);
              o2 = data.charCodeAt(i++);
              o3 = data.charCodeAt(i++);
              bits = o1 << 16 | o2 << 8 | o3;
              h1 = bits >> 18 & 63;
              h2 = bits >> 12 & 63;
              h3 = bits >> 6 & 63;
              h4 = bits & 63;
              tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
            } while (i < data.length);
            enc = tmp_arr.join("");
            var r = data.length % 3;
            return (r ? enc.slice(0, r - 3) : enc) + "===".slice(r || 3);
          },
          _b64_decode: function base64_decode(data) {
            var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, dec = "", tmp_arr = [];
            if (!data) {
              return data;
            }
            data += "";
            do {
              h1 = b64.indexOf(data.charAt(i++));
              h2 = b64.indexOf(data.charAt(i++));
              h3 = b64.indexOf(data.charAt(i++));
              h4 = b64.indexOf(data.charAt(i++));
              bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
              o1 = bits >> 16 & 255;
              o2 = bits >> 8 & 255;
              o3 = bits & 255;
              if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
              } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
              } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
              }
            } while (i < data.length);
            dec = tmp_arr.join("");
            return dec;
          },
          toString: function() {
            return this.value;
          }
        };
        Binary.fromString = function(aString) {
          return new Binary(aString);
        };
        return Binary;
      }();
      (function() {
        ICAL.Period = function icalperiod(aData) {
          this.wrappedJSObject = this;
          if (aData && "start" in aData) {
            if (aData.start && !(aData.start instanceof ICAL.Time)) {
              throw new TypeError(".start must be an instance of ICAL.Time");
            }
            this.start = aData.start;
          }
          if (aData && aData.end && aData.duration) {
            throw new Error("cannot accept both end and duration");
          }
          if (aData && "end" in aData) {
            if (aData.end && !(aData.end instanceof ICAL.Time)) {
              throw new TypeError(".end must be an instance of ICAL.Time");
            }
            this.end = aData.end;
          }
          if (aData && "duration" in aData) {
            if (aData.duration && !(aData.duration instanceof ICAL.Duration)) {
              throw new TypeError(".duration must be an instance of ICAL.Duration");
            }
            this.duration = aData.duration;
          }
        };
        ICAL.Period.prototype = {
          start: null,
          end: null,
          duration: null,
          icalclass: "icalperiod",
          icaltype: "period",
          clone: function() {
            return ICAL.Period.fromData({
              start: this.start ? this.start.clone() : null,
              end: this.end ? this.end.clone() : null,
              duration: this.duration ? this.duration.clone() : null
            });
          },
          getDuration: function duration() {
            if (this.duration) {
              return this.duration;
            } else {
              return this.end.subtractDate(this.start);
            }
          },
          getEnd: function() {
            if (this.end) {
              return this.end;
            } else {
              var end = this.start.clone();
              end.addDuration(this.duration);
              return end;
            }
          },
          toString: function toString() {
            return this.start + "/" + (this.end || this.duration);
          },
          toJSON: function() {
            return [this.start.toString(), (this.end || this.duration).toString()];
          },
          toICALString: function() {
            return this.start.toICALString() + "/" + (this.end || this.duration).toICALString();
          }
        };
        ICAL.Period.fromString = function fromString(str, prop) {
          var parts = str.split("/");
          if (parts.length !== 2) {
            throw new Error('Invalid string value: "' + str + '" must contain a "/" char.');
          }
          var options = {
            start: ICAL.Time.fromDateTimeString(parts[0], prop)
          };
          var end = parts[1];
          if (ICAL.Duration.isValueString(end)) {
            options.duration = ICAL.Duration.fromString(end);
          } else {
            options.end = ICAL.Time.fromDateTimeString(end, prop);
          }
          return new ICAL.Period(options);
        };
        ICAL.Period.fromData = function fromData(aData) {
          return new ICAL.Period(aData);
        };
        ICAL.Period.fromJSON = function(aData, aProp, aLenient) {
          function fromDateOrDateTimeString(aValue, aProp2) {
            if (aLenient) {
              return ICAL.Time.fromString(aValue, aProp2);
            } else {
              return ICAL.Time.fromDateTimeString(aValue, aProp2);
            }
          }
          if (ICAL.Duration.isValueString(aData[1])) {
            return ICAL.Period.fromData({
              start: fromDateOrDateTimeString(aData[0], aProp),
              duration: ICAL.Duration.fromString(aData[1])
            });
          } else {
            return ICAL.Period.fromData({
              start: fromDateOrDateTimeString(aData[0], aProp),
              end: fromDateOrDateTimeString(aData[1], aProp)
            });
          }
        };
      })();
      (function() {
        var DURATION_LETTERS = /([PDWHMTS]{1,1})/;
        ICAL.Duration = function icalduration(data) {
          this.wrappedJSObject = this;
          this.fromData(data);
        };
        ICAL.Duration.prototype = {
          weeks: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isNegative: false,
          icalclass: "icalduration",
          icaltype: "duration",
          clone: function clone() {
            return ICAL.Duration.fromData(this);
          },
          toSeconds: function toSeconds() {
            var seconds = this.seconds + 60 * this.minutes + 3600 * this.hours + 86400 * this.days + 7 * 86400 * this.weeks;
            return this.isNegative ? -seconds : seconds;
          },
          fromSeconds: function fromSeconds(aSeconds) {
            var secs = Math.abs(aSeconds);
            this.isNegative = aSeconds < 0;
            this.days = ICAL.helpers.trunc(secs / 86400);
            if (this.days % 7 == 0) {
              this.weeks = this.days / 7;
              this.days = 0;
            } else {
              this.weeks = 0;
            }
            secs -= (this.days + 7 * this.weeks) * 86400;
            this.hours = ICAL.helpers.trunc(secs / 3600);
            secs -= this.hours * 3600;
            this.minutes = ICAL.helpers.trunc(secs / 60);
            secs -= this.minutes * 60;
            this.seconds = secs;
            return this;
          },
          fromData: function fromData(aData) {
            var propsToCopy = [
              "weeks",
              "days",
              "hours",
              "minutes",
              "seconds",
              "isNegative"
            ];
            for (var key in propsToCopy) {
              if (!propsToCopy.hasOwnProperty(key)) {
                continue;
              }
              var prop = propsToCopy[key];
              if (aData && prop in aData) {
                this[prop] = aData[prop];
              } else {
                this[prop] = 0;
              }
            }
          },
          reset: function reset() {
            this.isNegative = false;
            this.weeks = 0;
            this.days = 0;
            this.hours = 0;
            this.minutes = 0;
            this.seconds = 0;
          },
          compare: function compare(aOther) {
            var thisSeconds = this.toSeconds();
            var otherSeconds = aOther.toSeconds();
            return (thisSeconds > otherSeconds) - (thisSeconds < otherSeconds);
          },
          normalize: function normalize() {
            this.fromSeconds(this.toSeconds());
          },
          toString: function toString() {
            if (this.toSeconds() == 0) {
              return "PT0S";
            } else {
              var str = "";
              if (this.isNegative)
                str += "-";
              str += "P";
              if (this.weeks)
                str += this.weeks + "W";
              if (this.days)
                str += this.days + "D";
              if (this.hours || this.minutes || this.seconds) {
                str += "T";
                if (this.hours)
                  str += this.hours + "H";
                if (this.minutes)
                  str += this.minutes + "M";
                if (this.seconds)
                  str += this.seconds + "S";
              }
              return str;
            }
          },
          toICALString: function() {
            return this.toString();
          }
        };
        ICAL.Duration.fromSeconds = function icalduration_from_seconds(aSeconds) {
          return new ICAL.Duration().fromSeconds(aSeconds);
        };
        function parseDurationChunk(letter, number, object) {
          var type;
          switch (letter) {
            case "P":
              if (number && number === "-") {
                object.isNegative = true;
              } else {
                object.isNegative = false;
              }
              break;
            case "D":
              type = "days";
              break;
            case "W":
              type = "weeks";
              break;
            case "H":
              type = "hours";
              break;
            case "M":
              type = "minutes";
              break;
            case "S":
              type = "seconds";
              break;
            default:
              return 0;
          }
          if (type) {
            if (!number && number !== 0) {
              throw new Error('invalid duration value: Missing number before "' + letter + '"');
            }
            var num = parseInt(number, 10);
            if (ICAL.helpers.isStrictlyNaN(num)) {
              throw new Error('invalid duration value: Invalid number "' + number + '" before "' + letter + '"');
            }
            object[type] = num;
          }
          return 1;
        }
        ICAL.Duration.isValueString = function(string) {
          return string[0] === "P" || string[1] === "P";
        };
        ICAL.Duration.fromString = function icalduration_from_string(aStr) {
          var pos = 0;
          var dict = Object.create(null);
          var chunks = 0;
          while ((pos = aStr.search(DURATION_LETTERS)) !== -1) {
            var type = aStr[pos];
            var numeric = aStr.substr(0, pos);
            aStr = aStr.substr(pos + 1);
            chunks += parseDurationChunk(type, numeric, dict);
          }
          if (chunks < 2) {
            throw new Error('invalid duration value: Not enough duration components in "' + aStr + '"');
          }
          return new ICAL.Duration(dict);
        };
        ICAL.Duration.fromData = function icalduration_from_data(aData) {
          return new ICAL.Duration(aData);
        };
      })();
      (function() {
        var OPTIONS = [
          "tzid",
          "location",
          "tznames",
          "latitude",
          "longitude"
        ];
        ICAL.Timezone = function icaltimezone(data) {
          this.wrappedJSObject = this;
          this.fromData(data);
        };
        ICAL.Timezone.prototype = {
          tzid: "",
          location: "",
          tznames: "",
          latitude: 0,
          longitude: 0,
          component: null,
          expandedUntilYear: 0,
          icalclass: "icaltimezone",
          fromData: function fromData(aData) {
            this.expandedUntilYear = 0;
            this.changes = [];
            if (aData instanceof ICAL.Component) {
              this.component = aData;
            } else {
              if (aData && "component" in aData) {
                if (typeof aData.component == "string") {
                  var jCal = ICAL.parse(aData.component);
                  this.component = new ICAL.Component(jCal);
                } else if (aData.component instanceof ICAL.Component) {
                  this.component = aData.component;
                } else {
                  this.component = null;
                }
              }
              for (var key in OPTIONS) {
                if (OPTIONS.hasOwnProperty(key)) {
                  var prop = OPTIONS[key];
                  if (aData && prop in aData) {
                    this[prop] = aData[prop];
                  }
                }
              }
            }
            if (this.component instanceof ICAL.Component && !this.tzid) {
              this.tzid = this.component.getFirstPropertyValue("tzid");
            }
            return this;
          },
          utcOffset: function utcOffset(tt) {
            if (this == ICAL.Timezone.utcTimezone || this == ICAL.Timezone.localTimezone) {
              return 0;
            }
            this._ensureCoverage(tt.year);
            if (!this.changes.length) {
              return 0;
            }
            var tt_change = {
              year: tt.year,
              month: tt.month,
              day: tt.day,
              hour: tt.hour,
              minute: tt.minute,
              second: tt.second
            };
            var change_num = this._findNearbyChange(tt_change);
            var change_num_to_use = -1;
            var step = 1;
            for (; ; ) {
              var change = ICAL.helpers.clone(this.changes[change_num], true);
              if (change.utcOffset < change.prevUtcOffset) {
                ICAL.Timezone.adjust_change(change, 0, 0, 0, change.utcOffset);
              } else {
                ICAL.Timezone.adjust_change(change, 0, 0, 0, change.prevUtcOffset);
              }
              var cmp = ICAL.Timezone._compare_change_fn(tt_change, change);
              if (cmp >= 0) {
                change_num_to_use = change_num;
              } else {
                step = -1;
              }
              if (step == -1 && change_num_to_use != -1) {
                break;
              }
              change_num += step;
              if (change_num < 0) {
                return 0;
              }
              if (change_num >= this.changes.length) {
                break;
              }
            }
            var zone_change = this.changes[change_num_to_use];
            var utcOffset_change = zone_change.utcOffset - zone_change.prevUtcOffset;
            if (utcOffset_change < 0 && change_num_to_use > 0) {
              var tmp_change = ICAL.helpers.clone(zone_change, true);
              ICAL.Timezone.adjust_change(tmp_change, 0, 0, 0, tmp_change.prevUtcOffset);
              if (ICAL.Timezone._compare_change_fn(tt_change, tmp_change) < 0) {
                var prev_zone_change = this.changes[change_num_to_use - 1];
                var want_daylight = false;
                if (zone_change.is_daylight != want_daylight && prev_zone_change.is_daylight == want_daylight) {
                  zone_change = prev_zone_change;
                }
              }
            }
            return zone_change.utcOffset;
          },
          _findNearbyChange: function icaltimezone_find_nearby_change(change) {
            var idx = ICAL.helpers.binsearchInsert(this.changes, change, ICAL.Timezone._compare_change_fn);
            if (idx >= this.changes.length) {
              return this.changes.length - 1;
            }
            return idx;
          },
          _ensureCoverage: function(aYear) {
            if (ICAL.Timezone._minimumExpansionYear == -1) {
              var today = ICAL.Time.now();
              ICAL.Timezone._minimumExpansionYear = today.year;
            }
            var changesEndYear = aYear;
            if (changesEndYear < ICAL.Timezone._minimumExpansionYear) {
              changesEndYear = ICAL.Timezone._minimumExpansionYear;
            }
            changesEndYear += ICAL.Timezone.EXTRA_COVERAGE;
            if (changesEndYear > ICAL.Timezone.MAX_YEAR) {
              changesEndYear = ICAL.Timezone.MAX_YEAR;
            }
            if (!this.changes.length || this.expandedUntilYear < aYear) {
              var subcomps = this.component.getAllSubcomponents();
              var compLen = subcomps.length;
              var compIdx = 0;
              for (; compIdx < compLen; compIdx++) {
                this._expandComponent(subcomps[compIdx], changesEndYear, this.changes);
              }
              this.changes.sort(ICAL.Timezone._compare_change_fn);
              this.expandedUntilYear = changesEndYear;
            }
          },
          _expandComponent: function(aComponent, aYear, changes) {
            if (!aComponent.hasProperty("dtstart") || !aComponent.hasProperty("tzoffsetto") || !aComponent.hasProperty("tzoffsetfrom")) {
              return null;
            }
            var dtstart = aComponent.getFirstProperty("dtstart").getFirstValue();
            var change;
            function convert_tzoffset(offset) {
              return offset.factor * (offset.hours * 3600 + offset.minutes * 60);
            }
            function init_changes() {
              var changebase = {};
              changebase.is_daylight = aComponent.name == "daylight";
              changebase.utcOffset = convert_tzoffset(aComponent.getFirstProperty("tzoffsetto").getFirstValue());
              changebase.prevUtcOffset = convert_tzoffset(aComponent.getFirstProperty("tzoffsetfrom").getFirstValue());
              return changebase;
            }
            if (!aComponent.hasProperty("rrule") && !aComponent.hasProperty("rdate")) {
              change = init_changes();
              change.year = dtstart.year;
              change.month = dtstart.month;
              change.day = dtstart.day;
              change.hour = dtstart.hour;
              change.minute = dtstart.minute;
              change.second = dtstart.second;
              ICAL.Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
              changes.push(change);
            } else {
              var props = aComponent.getAllProperties("rdate");
              for (var rdatekey in props) {
                if (!props.hasOwnProperty(rdatekey)) {
                  continue;
                }
                var rdate = props[rdatekey];
                var time = rdate.getFirstValue();
                change = init_changes();
                change.year = time.year;
                change.month = time.month;
                change.day = time.day;
                if (time.isDate) {
                  change.hour = dtstart.hour;
                  change.minute = dtstart.minute;
                  change.second = dtstart.second;
                  if (dtstart.zone != ICAL.Timezone.utcTimezone) {
                    ICAL.Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
                  }
                } else {
                  change.hour = time.hour;
                  change.minute = time.minute;
                  change.second = time.second;
                  if (time.zone != ICAL.Timezone.utcTimezone) {
                    ICAL.Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
                  }
                }
                changes.push(change);
              }
              var rrule = aComponent.getFirstProperty("rrule");
              if (rrule) {
                rrule = rrule.getFirstValue();
                change = init_changes();
                if (rrule.until && rrule.until.zone == ICAL.Timezone.utcTimezone) {
                  rrule.until.adjust(0, 0, 0, change.prevUtcOffset);
                  rrule.until.zone = ICAL.Timezone.localTimezone;
                }
                var iterator = rrule.iterator(dtstart);
                var occ;
                while (occ = iterator.next()) {
                  change = init_changes();
                  if (occ.year > aYear || !occ) {
                    break;
                  }
                  change.year = occ.year;
                  change.month = occ.month;
                  change.day = occ.day;
                  change.hour = occ.hour;
                  change.minute = occ.minute;
                  change.second = occ.second;
                  change.isDate = occ.isDate;
                  ICAL.Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
                  changes.push(change);
                }
              }
            }
            return changes;
          },
          toString: function toString() {
            return this.tznames ? this.tznames : this.tzid;
          }
        };
        ICAL.Timezone._compare_change_fn = function icaltimezone_compare_change_fn(a, b) {
          if (a.year < b.year)
            return -1;
          else if (a.year > b.year)
            return 1;
          if (a.month < b.month)
            return -1;
          else if (a.month > b.month)
            return 1;
          if (a.day < b.day)
            return -1;
          else if (a.day > b.day)
            return 1;
          if (a.hour < b.hour)
            return -1;
          else if (a.hour > b.hour)
            return 1;
          if (a.minute < b.minute)
            return -1;
          else if (a.minute > b.minute)
            return 1;
          if (a.second < b.second)
            return -1;
          else if (a.second > b.second)
            return 1;
          return 0;
        };
        ICAL.Timezone.convert_time = function icaltimezone_convert_time(tt, from_zone, to_zone) {
          if (tt.isDate || from_zone.tzid == to_zone.tzid || from_zone == ICAL.Timezone.localTimezone || to_zone == ICAL.Timezone.localTimezone) {
            tt.zone = to_zone;
            return tt;
          }
          var utcOffset = from_zone.utcOffset(tt);
          tt.adjust(0, 0, 0, -utcOffset);
          utcOffset = to_zone.utcOffset(tt);
          tt.adjust(0, 0, 0, utcOffset);
          return null;
        };
        ICAL.Timezone.fromData = function icaltimezone_fromData(aData) {
          var tt = new ICAL.Timezone();
          return tt.fromData(aData);
        };
        ICAL.Timezone.utcTimezone = ICAL.Timezone.fromData({
          tzid: "UTC"
        });
        ICAL.Timezone.localTimezone = ICAL.Timezone.fromData({
          tzid: "floating"
        });
        ICAL.Timezone.adjust_change = function icaltimezone_adjust_change(change, days, hours, minutes, seconds) {
          return ICAL.Time.prototype.adjust.call(change, days, hours, minutes, seconds, change);
        };
        ICAL.Timezone._minimumExpansionYear = -1;
        ICAL.Timezone.MAX_YEAR = 2035;
        ICAL.Timezone.EXTRA_COVERAGE = 5;
      })();
      ICAL.TimezoneService = function() {
        var zones;
        var TimezoneService = {
          get count() {
            return Object.keys(zones).length;
          },
          reset: function() {
            zones = Object.create(null);
            var utc = ICAL.Timezone.utcTimezone;
            zones.Z = utc;
            zones.UTC = utc;
            zones.GMT = utc;
          },
          has: function(tzid) {
            return !!zones[tzid];
          },
          get: function(tzid) {
            return zones[tzid];
          },
          register: function(name, timezone) {
            if (name instanceof ICAL.Component) {
              if (name.name === "vtimezone") {
                timezone = new ICAL.Timezone(name);
                name = timezone.tzid;
              }
            }
            if (timezone instanceof ICAL.Timezone) {
              zones[name] = timezone;
            } else {
              throw new TypeError("timezone must be ICAL.Timezone or ICAL.Component");
            }
          },
          remove: function(tzid) {
            return delete zones[tzid];
          }
        };
        TimezoneService.reset();
        return TimezoneService;
      }();
      (function() {
        ICAL.Time = function icaltime(data, zone) {
          this.wrappedJSObject = this;
          var time = this._time = Object.create(null);
          time.year = 0;
          time.month = 1;
          time.day = 1;
          time.hour = 0;
          time.minute = 0;
          time.second = 0;
          time.isDate = false;
          this.fromData(data, zone);
        };
        ICAL.Time._dowCache = {};
        ICAL.Time._wnCache = {};
        ICAL.Time.prototype = {
          icalclass: "icaltime",
          _cachedUnixTime: null,
          get icaltype() {
            return this.isDate ? "date" : "date-time";
          },
          zone: null,
          _pendingNormalization: false,
          clone: function() {
            return new ICAL.Time(this._time, this.zone);
          },
          reset: function icaltime_reset() {
            this.fromData(ICAL.Time.epochTime);
            this.zone = ICAL.Timezone.utcTimezone;
          },
          resetTo: function icaltime_resetTo(year, month, day, hour, minute, second, timezone) {
            this.fromData({
              year,
              month,
              day,
              hour,
              minute,
              second,
              zone: timezone
            });
          },
          fromJSDate: function icaltime_fromJSDate(aDate, useUTC) {
            if (!aDate) {
              this.reset();
            } else {
              if (useUTC) {
                this.zone = ICAL.Timezone.utcTimezone;
                this.year = aDate.getUTCFullYear();
                this.month = aDate.getUTCMonth() + 1;
                this.day = aDate.getUTCDate();
                this.hour = aDate.getUTCHours();
                this.minute = aDate.getUTCMinutes();
                this.second = aDate.getUTCSeconds();
              } else {
                this.zone = ICAL.Timezone.localTimezone;
                this.year = aDate.getFullYear();
                this.month = aDate.getMonth() + 1;
                this.day = aDate.getDate();
                this.hour = aDate.getHours();
                this.minute = aDate.getMinutes();
                this.second = aDate.getSeconds();
              }
            }
            this._cachedUnixTime = null;
            return this;
          },
          fromData: function fromData(aData, aZone) {
            if (aData) {
              for (var key in aData) {
                if (Object.prototype.hasOwnProperty.call(aData, key)) {
                  if (key === "icaltype")
                    continue;
                  this[key] = aData[key];
                }
              }
            }
            if (aZone) {
              this.zone = aZone;
            }
            if (aData && !("isDate" in aData)) {
              this.isDate = !("hour" in aData);
            } else if (aData && "isDate" in aData) {
              this.isDate = aData.isDate;
            }
            if (aData && "timezone" in aData) {
              var zone = ICAL.TimezoneService.get(aData.timezone);
              this.zone = zone || ICAL.Timezone.localTimezone;
            }
            if (aData && "zone" in aData) {
              this.zone = aData.zone;
            }
            if (!this.zone) {
              this.zone = ICAL.Timezone.localTimezone;
            }
            this._cachedUnixTime = null;
            return this;
          },
          dayOfWeek: function icaltime_dayOfWeek(aWeekStart) {
            var firstDow = aWeekStart || ICAL.Time.SUNDAY;
            var dowCacheKey = (this.year << 12) + (this.month << 8) + (this.day << 3) + firstDow;
            if (dowCacheKey in ICAL.Time._dowCache) {
              return ICAL.Time._dowCache[dowCacheKey];
            }
            var q = this.day;
            var m = this.month + (this.month < 3 ? 12 : 0);
            var Y = this.year - (this.month < 3 ? 1 : 0);
            var h = q + Y + ICAL.helpers.trunc((m + 1) * 26 / 10) + ICAL.helpers.trunc(Y / 4);
            if (true) {
              h += ICAL.helpers.trunc(Y / 100) * 6 + ICAL.helpers.trunc(Y / 400);
            } else {
              h += 5;
            }
            h = (h + 7 - firstDow) % 7 + 1;
            ICAL.Time._dowCache[dowCacheKey] = h;
            return h;
          },
          dayOfYear: function dayOfYear() {
            var is_leap = ICAL.Time.isLeapYear(this.year) ? 1 : 0;
            var diypm = ICAL.Time.daysInYearPassedMonth;
            return diypm[is_leap][this.month - 1] + this.day;
          },
          startOfWeek: function startOfWeek(aWeekStart) {
            var firstDow = aWeekStart || ICAL.Time.SUNDAY;
            var result = this.clone();
            result.day -= (this.dayOfWeek() + 7 - firstDow) % 7;
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          endOfWeek: function endOfWeek(aWeekStart) {
            var firstDow = aWeekStart || ICAL.Time.SUNDAY;
            var result = this.clone();
            result.day += (7 - this.dayOfWeek() + firstDow - ICAL.Time.SUNDAY) % 7;
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          startOfMonth: function startOfMonth() {
            var result = this.clone();
            result.day = 1;
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          endOfMonth: function endOfMonth() {
            var result = this.clone();
            result.day = ICAL.Time.daysInMonth(result.month, result.year);
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          startOfYear: function startOfYear() {
            var result = this.clone();
            result.day = 1;
            result.month = 1;
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          endOfYear: function endOfYear() {
            var result = this.clone();
            result.day = 31;
            result.month = 12;
            result.isDate = true;
            result.hour = 0;
            result.minute = 0;
            result.second = 0;
            return result;
          },
          startDoyWeek: function startDoyWeek(aFirstDayOfWeek) {
            var firstDow = aFirstDayOfWeek || ICAL.Time.SUNDAY;
            var delta = this.dayOfWeek() - firstDow;
            if (delta < 0)
              delta += 7;
            return this.dayOfYear() - delta;
          },
          getDominicalLetter: function() {
            return ICAL.Time.getDominicalLetter(this.year);
          },
          nthWeekDay: function icaltime_nthWeekDay(aDayOfWeek, aPos) {
            var daysInMonth = ICAL.Time.daysInMonth(this.month, this.year);
            var weekday;
            var pos = aPos;
            var start = 0;
            var otherDay = this.clone();
            if (pos >= 0) {
              otherDay.day = 1;
              if (pos != 0) {
                pos--;
              }
              start = otherDay.day;
              var startDow = otherDay.dayOfWeek();
              var offset = aDayOfWeek - startDow;
              if (offset < 0)
                offset += 7;
              start += offset;
              start -= aDayOfWeek;
              weekday = aDayOfWeek;
            } else {
              otherDay.day = daysInMonth;
              var endDow = otherDay.dayOfWeek();
              pos++;
              weekday = endDow - aDayOfWeek;
              if (weekday < 0) {
                weekday += 7;
              }
              weekday = daysInMonth - weekday;
            }
            weekday += pos * 7;
            return start + weekday;
          },
          isNthWeekDay: function(aDayOfWeek, aPos) {
            var dow = this.dayOfWeek();
            if (aPos === 0 && dow === aDayOfWeek) {
              return true;
            }
            var day = this.nthWeekDay(aDayOfWeek, aPos);
            if (day === this.day) {
              return true;
            }
            return false;
          },
          weekNumber: function weekNumber(aWeekStart) {
            var wnCacheKey = (this.year << 12) + (this.month << 8) + (this.day << 3) + aWeekStart;
            if (wnCacheKey in ICAL.Time._wnCache) {
              return ICAL.Time._wnCache[wnCacheKey];
            }
            var week1;
            var dt = this.clone();
            dt.isDate = true;
            var isoyear = this.year;
            if (dt.month == 12 && dt.day > 25) {
              week1 = ICAL.Time.weekOneStarts(isoyear + 1, aWeekStart);
              if (dt.compare(week1) < 0) {
                week1 = ICAL.Time.weekOneStarts(isoyear, aWeekStart);
              } else {
                isoyear++;
              }
            } else {
              week1 = ICAL.Time.weekOneStarts(isoyear, aWeekStart);
              if (dt.compare(week1) < 0) {
                week1 = ICAL.Time.weekOneStarts(--isoyear, aWeekStart);
              }
            }
            var daysBetween = dt.subtractDate(week1).toSeconds() / 86400;
            var answer = ICAL.helpers.trunc(daysBetween / 7) + 1;
            ICAL.Time._wnCache[wnCacheKey] = answer;
            return answer;
          },
          addDuration: function icaltime_add(aDuration) {
            var mult = aDuration.isNegative ? -1 : 1;
            var second = this.second;
            var minute = this.minute;
            var hour = this.hour;
            var day = this.day;
            second += mult * aDuration.seconds;
            minute += mult * aDuration.minutes;
            hour += mult * aDuration.hours;
            day += mult * aDuration.days;
            day += mult * 7 * aDuration.weeks;
            this.second = second;
            this.minute = minute;
            this.hour = hour;
            this.day = day;
            this._cachedUnixTime = null;
          },
          subtractDate: function icaltime_subtract(aDate) {
            var unixTime = this.toUnixTime() + this.utcOffset();
            var other = aDate.toUnixTime() + aDate.utcOffset();
            return ICAL.Duration.fromSeconds(unixTime - other);
          },
          subtractDateTz: function icaltime_subtract_abs(aDate) {
            var unixTime = this.toUnixTime();
            var other = aDate.toUnixTime();
            return ICAL.Duration.fromSeconds(unixTime - other);
          },
          compare: function icaltime_compare(other) {
            var a = this.toUnixTime();
            var b = other.toUnixTime();
            if (a > b)
              return 1;
            if (b > a)
              return -1;
            return 0;
          },
          compareDateOnlyTz: function icaltime_compareDateOnlyTz(other, tz) {
            function cmp(attr) {
              return ICAL.Time._cmp_attr(a, b, attr);
            }
            var a = this.convertToZone(tz);
            var b = other.convertToZone(tz);
            var rc = 0;
            if ((rc = cmp("year")) != 0)
              return rc;
            if ((rc = cmp("month")) != 0)
              return rc;
            if ((rc = cmp("day")) != 0)
              return rc;
            return rc;
          },
          convertToZone: function convertToZone(zone) {
            var copy = this.clone();
            var zone_equals = this.zone.tzid == zone.tzid;
            if (!this.isDate && !zone_equals) {
              ICAL.Timezone.convert_time(copy, this.zone, zone);
            }
            copy.zone = zone;
            return copy;
          },
          utcOffset: function utc_offset() {
            if (this.zone == ICAL.Timezone.localTimezone || this.zone == ICAL.Timezone.utcTimezone) {
              return 0;
            } else {
              return this.zone.utcOffset(this);
            }
          },
          toICALString: function() {
            var string = this.toString();
            if (string.length > 10) {
              return ICAL.design.icalendar.value["date-time"].toICAL(string);
            } else {
              return ICAL.design.icalendar.value.date.toICAL(string);
            }
          },
          toString: function toString() {
            var result = this.year + "-" + ICAL.helpers.pad2(this.month) + "-" + ICAL.helpers.pad2(this.day);
            if (!this.isDate) {
              result += "T" + ICAL.helpers.pad2(this.hour) + ":" + ICAL.helpers.pad2(this.minute) + ":" + ICAL.helpers.pad2(this.second);
              if (this.zone === ICAL.Timezone.utcTimezone) {
                result += "Z";
              }
            }
            return result;
          },
          toJSDate: function toJSDate() {
            if (this.zone == ICAL.Timezone.localTimezone) {
              if (this.isDate) {
                return new Date(this.year, this.month - 1, this.day);
              } else {
                return new Date(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, 0);
              }
            } else {
              return new Date(this.toUnixTime() * 1e3);
            }
          },
          _normalize: function icaltime_normalize() {
            var isDate = this._time.isDate;
            if (this._time.isDate) {
              this._time.hour = 0;
              this._time.minute = 0;
              this._time.second = 0;
            }
            this.adjust(0, 0, 0, 0);
            return this;
          },
          adjust: function icaltime_adjust(aExtraDays, aExtraHours, aExtraMinutes, aExtraSeconds, aTime) {
            var minutesOverflow, hoursOverflow, daysOverflow = 0, yearsOverflow = 0;
            var second, minute, hour, day;
            var daysInMonth;
            var time = aTime || this._time;
            if (!time.isDate) {
              second = time.second + aExtraSeconds;
              time.second = second % 60;
              minutesOverflow = ICAL.helpers.trunc(second / 60);
              if (time.second < 0) {
                time.second += 60;
                minutesOverflow--;
              }
              minute = time.minute + aExtraMinutes + minutesOverflow;
              time.minute = minute % 60;
              hoursOverflow = ICAL.helpers.trunc(minute / 60);
              if (time.minute < 0) {
                time.minute += 60;
                hoursOverflow--;
              }
              hour = time.hour + aExtraHours + hoursOverflow;
              time.hour = hour % 24;
              daysOverflow = ICAL.helpers.trunc(hour / 24);
              if (time.hour < 0) {
                time.hour += 24;
                daysOverflow--;
              }
            }
            if (time.month > 12) {
              yearsOverflow = ICAL.helpers.trunc((time.month - 1) / 12);
            } else if (time.month < 1) {
              yearsOverflow = ICAL.helpers.trunc(time.month / 12) - 1;
            }
            time.year += yearsOverflow;
            time.month -= 12 * yearsOverflow;
            day = time.day + aExtraDays + daysOverflow;
            if (day > 0) {
              for (; ; ) {
                daysInMonth = ICAL.Time.daysInMonth(time.month, time.year);
                if (day <= daysInMonth) {
                  break;
                }
                time.month++;
                if (time.month > 12) {
                  time.year++;
                  time.month = 1;
                }
                day -= daysInMonth;
              }
            } else {
              while (day <= 0) {
                if (time.month == 1) {
                  time.year--;
                  time.month = 12;
                } else {
                  time.month--;
                }
                day += ICAL.Time.daysInMonth(time.month, time.year);
              }
            }
            time.day = day;
            this._cachedUnixTime = null;
            return this;
          },
          fromUnixTime: function fromUnixTime(seconds) {
            this.zone = ICAL.Timezone.utcTimezone;
            var epoch = ICAL.Time.epochTime.clone();
            epoch.adjust(0, 0, 0, seconds);
            this.year = epoch.year;
            this.month = epoch.month;
            this.day = epoch.day;
            this.hour = epoch.hour;
            this.minute = epoch.minute;
            this.second = Math.floor(epoch.second);
            this._cachedUnixTime = null;
          },
          toUnixTime: function toUnixTime() {
            if (this._cachedUnixTime !== null) {
              return this._cachedUnixTime;
            }
            var offset = this.utcOffset();
            var ms = Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second - offset);
            this._cachedUnixTime = ms / 1e3;
            return this._cachedUnixTime;
          },
          toJSON: function() {
            var copy = [
              "year",
              "month",
              "day",
              "hour",
              "minute",
              "second",
              "isDate"
            ];
            var result = Object.create(null);
            var i = 0;
            var len = copy.length;
            var prop;
            for (; i < len; i++) {
              prop = copy[i];
              result[prop] = this[prop];
            }
            if (this.zone) {
              result.timezone = this.zone.tzid;
            }
            return result;
          }
        };
        (function setupNormalizeAttributes() {
          function defineAttr(attr) {
            Object.defineProperty(ICAL.Time.prototype, attr, {
              get: function getTimeAttr() {
                if (this._pendingNormalization) {
                  this._normalize();
                  this._pendingNormalization = false;
                }
                return this._time[attr];
              },
              set: function setTimeAttr(val) {
                if (attr === "isDate" && val && !this._time.isDate) {
                  this.adjust(0, 0, 0, 0);
                }
                this._cachedUnixTime = null;
                this._pendingNormalization = true;
                this._time[attr] = val;
                return val;
              }
            });
          }
          if ("defineProperty" in Object) {
            defineAttr("year");
            defineAttr("month");
            defineAttr("day");
            defineAttr("hour");
            defineAttr("minute");
            defineAttr("second");
            defineAttr("isDate");
          }
        })();
        ICAL.Time.daysInMonth = function icaltime_daysInMonth(month, year) {
          var _daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          var days = 30;
          if (month < 1 || month > 12)
            return days;
          days = _daysInMonth[month];
          if (month == 2) {
            days += ICAL.Time.isLeapYear(year);
          }
          return days;
        };
        ICAL.Time.isLeapYear = function isLeapYear(year) {
          if (year <= 1752) {
            return year % 4 == 0;
          } else {
            return year % 4 == 0 && year % 100 != 0 || year % 400 == 0;
          }
        };
        ICAL.Time.fromDayOfYear = function icaltime_fromDayOfYear(aDayOfYear, aYear) {
          var year = aYear;
          var doy = aDayOfYear;
          var tt = new ICAL.Time();
          tt.auto_normalize = false;
          var is_leap = ICAL.Time.isLeapYear(year) ? 1 : 0;
          if (doy < 1) {
            year--;
            is_leap = ICAL.Time.isLeapYear(year) ? 1 : 0;
            doy += ICAL.Time.daysInYearPassedMonth[is_leap][12];
            return ICAL.Time.fromDayOfYear(doy, year);
          } else if (doy > ICAL.Time.daysInYearPassedMonth[is_leap][12]) {
            is_leap = ICAL.Time.isLeapYear(year) ? 1 : 0;
            doy -= ICAL.Time.daysInYearPassedMonth[is_leap][12];
            year++;
            return ICAL.Time.fromDayOfYear(doy, year);
          }
          tt.year = year;
          tt.isDate = true;
          for (var month = 11; month >= 0; month--) {
            if (doy > ICAL.Time.daysInYearPassedMonth[is_leap][month]) {
              tt.month = month + 1;
              tt.day = doy - ICAL.Time.daysInYearPassedMonth[is_leap][month];
              break;
            }
          }
          tt.auto_normalize = true;
          return tt;
        };
        ICAL.Time.fromStringv2 = function fromString(str) {
          return new ICAL.Time({
            year: parseInt(str.substr(0, 4), 10),
            month: parseInt(str.substr(5, 2), 10),
            day: parseInt(str.substr(8, 2), 10),
            isDate: true
          });
        };
        ICAL.Time.fromDateString = function(aValue) {
          return new ICAL.Time({
            year: ICAL.helpers.strictParseInt(aValue.substr(0, 4)),
            month: ICAL.helpers.strictParseInt(aValue.substr(5, 2)),
            day: ICAL.helpers.strictParseInt(aValue.substr(8, 2)),
            isDate: true
          });
        };
        ICAL.Time.fromDateTimeString = function(aValue, prop) {
          if (aValue.length < 19) {
            throw new Error('invalid date-time value: "' + aValue + '"');
          }
          var zone;
          if (aValue[19] && aValue[19] === "Z") {
            zone = "Z";
          } else if (prop) {
            zone = prop.getParameter("tzid");
          }
          var time = new ICAL.Time({
            year: ICAL.helpers.strictParseInt(aValue.substr(0, 4)),
            month: ICAL.helpers.strictParseInt(aValue.substr(5, 2)),
            day: ICAL.helpers.strictParseInt(aValue.substr(8, 2)),
            hour: ICAL.helpers.strictParseInt(aValue.substr(11, 2)),
            minute: ICAL.helpers.strictParseInt(aValue.substr(14, 2)),
            second: ICAL.helpers.strictParseInt(aValue.substr(17, 2)),
            timezone: zone
          });
          return time;
        };
        ICAL.Time.fromString = function fromString(aValue, aProperty) {
          if (aValue.length > 10) {
            return ICAL.Time.fromDateTimeString(aValue, aProperty);
          } else {
            return ICAL.Time.fromDateString(aValue);
          }
        };
        ICAL.Time.fromJSDate = function fromJSDate(aDate, useUTC) {
          var tt = new ICAL.Time();
          return tt.fromJSDate(aDate, useUTC);
        };
        ICAL.Time.fromData = function fromData(aData, aZone) {
          var t = new ICAL.Time();
          return t.fromData(aData, aZone);
        };
        ICAL.Time.now = function icaltime_now() {
          return ICAL.Time.fromJSDate(new Date(), false);
        };
        ICAL.Time.weekOneStarts = function weekOneStarts(aYear, aWeekStart) {
          var t = ICAL.Time.fromData({
            year: aYear,
            month: 1,
            day: 1,
            isDate: true
          });
          var dow = t.dayOfWeek();
          var wkst = aWeekStart || ICAL.Time.DEFAULT_WEEK_START;
          if (dow > ICAL.Time.THURSDAY) {
            t.day += 7;
          }
          if (wkst > ICAL.Time.THURSDAY) {
            t.day -= 7;
          }
          t.day -= dow - wkst;
          return t;
        };
        ICAL.Time.getDominicalLetter = function(yr) {
          var LTRS = "GFEDCBA";
          var dom = (yr + (yr / 4 | 0) + (yr / 400 | 0) - (yr / 100 | 0) - 1) % 7;
          var isLeap = ICAL.Time.isLeapYear(yr);
          if (isLeap) {
            return LTRS[(dom + 6) % 7] + LTRS[dom];
          } else {
            return LTRS[dom];
          }
        };
        ICAL.Time.epochTime = ICAL.Time.fromData({
          year: 1970,
          month: 1,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          isDate: false,
          timezone: "Z"
        });
        ICAL.Time._cmp_attr = function _cmp_attr(a, b, attr) {
          if (a[attr] > b[attr])
            return 1;
          if (a[attr] < b[attr])
            return -1;
          return 0;
        };
        ICAL.Time.daysInYearPassedMonth = [
          [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365],
          [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
        ];
        ICAL.Time.SUNDAY = 1;
        ICAL.Time.MONDAY = 2;
        ICAL.Time.TUESDAY = 3;
        ICAL.Time.WEDNESDAY = 4;
        ICAL.Time.THURSDAY = 5;
        ICAL.Time.FRIDAY = 6;
        ICAL.Time.SATURDAY = 7;
        ICAL.Time.DEFAULT_WEEK_START = ICAL.Time.MONDAY;
      })();
      (function() {
        ICAL.VCardTime = function(data, zone, icaltype) {
          this.wrappedJSObject = this;
          var time = this._time = Object.create(null);
          time.year = null;
          time.month = null;
          time.day = null;
          time.hour = null;
          time.minute = null;
          time.second = null;
          this.icaltype = icaltype || "date-and-or-time";
          this.fromData(data, zone);
        };
        ICAL.helpers.inherits(ICAL.Time, ICAL.VCardTime, {
          icalclass: "vcardtime",
          icaltype: "date-and-or-time",
          zone: null,
          clone: function() {
            return new ICAL.VCardTime(this._time, this.zone, this.icaltype);
          },
          _normalize: function() {
            return this;
          },
          utcOffset: function() {
            if (this.zone instanceof ICAL.UtcOffset) {
              return this.zone.toSeconds();
            } else {
              return ICAL.Time.prototype.utcOffset.apply(this, arguments);
            }
          },
          toICALString: function() {
            return ICAL.design.vcard.value[this.icaltype].toICAL(this.toString());
          },
          toString: function toString() {
            var p2 = ICAL.helpers.pad2;
            var y = this.year, m = this.month, d = this.day;
            var h = this.hour, mm = this.minute, s = this.second;
            var hasYear = y !== null, hasMonth = m !== null, hasDay = d !== null;
            var hasHour = h !== null, hasMinute = mm !== null, hasSecond = s !== null;
            var datepart = (hasYear ? p2(y) + (hasMonth || hasDay ? "-" : "") : hasMonth || hasDay ? "--" : "") + (hasMonth ? p2(m) : "") + (hasDay ? "-" + p2(d) : "");
            var timepart = (hasHour ? p2(h) : "-") + (hasHour && hasMinute ? ":" : "") + (hasMinute ? p2(mm) : "") + (!hasHour && !hasMinute ? "-" : "") + (hasMinute && hasSecond ? ":" : "") + (hasSecond ? p2(s) : "");
            var zone;
            if (this.zone === ICAL.Timezone.utcTimezone) {
              zone = "Z";
            } else if (this.zone instanceof ICAL.UtcOffset) {
              zone = this.zone.toString();
            } else if (this.zone === ICAL.Timezone.localTimezone) {
              zone = "";
            } else if (this.zone instanceof ICAL.Timezone) {
              var offset = ICAL.UtcOffset.fromSeconds(this.zone.utcOffset(this));
              zone = offset.toString();
            } else {
              zone = "";
            }
            switch (this.icaltype) {
              case "time":
                return timepart + zone;
              case "date-and-or-time":
              case "date-time":
                return datepart + (timepart == "--" ? "" : "T" + timepart + zone);
              case "date":
                return datepart;
            }
            return null;
          }
        });
        ICAL.VCardTime.fromDateAndOrTimeString = function(aValue, aIcalType) {
          function part(v, s, e) {
            return v ? ICAL.helpers.strictParseInt(v.substr(s, e)) : null;
          }
          var parts = aValue.split("T");
          var dt = parts[0], tmz = parts[1];
          var splitzone = tmz ? ICAL.design.vcard.value.time._splitZone(tmz) : [];
          var zone = splitzone[0], tm = splitzone[1];
          var stoi = ICAL.helpers.strictParseInt;
          var dtlen = dt ? dt.length : 0;
          var tmlen = tm ? tm.length : 0;
          var hasDashDate = dt && dt[0] == "-" && dt[1] == "-";
          var hasDashTime = tm && tm[0] == "-";
          var o = {
            year: hasDashDate ? null : part(dt, 0, 4),
            month: hasDashDate && (dtlen == 4 || dtlen == 7) ? part(dt, 2, 2) : dtlen == 7 ? part(dt, 5, 2) : dtlen == 10 ? part(dt, 5, 2) : null,
            day: dtlen == 5 ? part(dt, 3, 2) : dtlen == 7 && hasDashDate ? part(dt, 5, 2) : dtlen == 10 ? part(dt, 8, 2) : null,
            hour: hasDashTime ? null : part(tm, 0, 2),
            minute: hasDashTime && tmlen == 3 ? part(tm, 1, 2) : tmlen > 4 ? hasDashTime ? part(tm, 1, 2) : part(tm, 3, 2) : null,
            second: tmlen == 4 ? part(tm, 2, 2) : tmlen == 6 ? part(tm, 4, 2) : tmlen == 8 ? part(tm, 6, 2) : null
          };
          if (zone == "Z") {
            zone = ICAL.Timezone.utcTimezone;
          } else if (zone && zone[3] == ":") {
            zone = ICAL.UtcOffset.fromString(zone);
          } else {
            zone = null;
          }
          return new ICAL.VCardTime(o, zone, aIcalType);
        };
      })();
      (function() {
        var DOW_MAP = {
          SU: ICAL.Time.SUNDAY,
          MO: ICAL.Time.MONDAY,
          TU: ICAL.Time.TUESDAY,
          WE: ICAL.Time.WEDNESDAY,
          TH: ICAL.Time.THURSDAY,
          FR: ICAL.Time.FRIDAY,
          SA: ICAL.Time.SATURDAY
        };
        var REVERSE_DOW_MAP = {};
        for (var key in DOW_MAP) {
          if (DOW_MAP.hasOwnProperty(key)) {
            REVERSE_DOW_MAP[DOW_MAP[key]] = key;
          }
        }
        var COPY_PARTS = [
          "BYSECOND",
          "BYMINUTE",
          "BYHOUR",
          "BYDAY",
          "BYMONTHDAY",
          "BYYEARDAY",
          "BYWEEKNO",
          "BYMONTH",
          "BYSETPOS"
        ];
        ICAL.Recur = function icalrecur(data) {
          this.wrappedJSObject = this;
          this.parts = {};
          if (data && typeof data === "object") {
            this.fromData(data);
          }
        };
        ICAL.Recur.prototype = {
          parts: null,
          interval: 1,
          wkst: ICAL.Time.MONDAY,
          until: null,
          count: null,
          freq: null,
          icalclass: "icalrecur",
          icaltype: "recur",
          iterator: function(aStart) {
            return new ICAL.RecurIterator({
              rule: this,
              dtstart: aStart
            });
          },
          clone: function clone() {
            return new ICAL.Recur(this.toJSON());
          },
          isFinite: function isfinite() {
            return !!(this.count || this.until);
          },
          isByCount: function isbycount() {
            return !!(this.count && !this.until);
          },
          addComponent: function addPart(aType, aValue) {
            var ucname = aType.toUpperCase();
            if (ucname in this.parts) {
              this.parts[ucname].push(aValue);
            } else {
              this.parts[ucname] = [aValue];
            }
          },
          setComponent: function setComponent(aType, aValues) {
            this.parts[aType.toUpperCase()] = aValues.slice();
          },
          getComponent: function getComponent(aType) {
            var ucname = aType.toUpperCase();
            return ucname in this.parts ? this.parts[ucname].slice() : [];
          },
          getNextOccurrence: function getNextOccurrence(aStartTime, aRecurrenceId) {
            var iter = this.iterator(aStartTime);
            var next, cdt;
            do {
              next = iter.next();
            } while (next && next.compare(aRecurrenceId) <= 0);
            if (next && aRecurrenceId.zone) {
              next.zone = aRecurrenceId.zone;
            }
            return next;
          },
          fromData: function(data) {
            for (var key2 in data) {
              var uckey = key2.toUpperCase();
              if (uckey in partDesign) {
                if (Array.isArray(data[key2])) {
                  this.parts[uckey] = data[key2];
                } else {
                  this.parts[uckey] = [data[key2]];
                }
              } else {
                this[key2] = data[key2];
              }
            }
            if (this.interval && typeof this.interval != "number") {
              optionDesign.INTERVAL(this.interval, this);
            }
            if (this.wkst && typeof this.wkst != "number") {
              this.wkst = ICAL.Recur.icalDayToNumericDay(this.wkst);
            }
            if (this.until && !(this.until instanceof ICAL.Time)) {
              this.until = ICAL.Time.fromString(this.until);
            }
          },
          toJSON: function() {
            var res = Object.create(null);
            res.freq = this.freq;
            if (this.count) {
              res.count = this.count;
            }
            if (this.interval > 1) {
              res.interval = this.interval;
            }
            for (var k in this.parts) {
              if (!this.parts.hasOwnProperty(k)) {
                continue;
              }
              var kparts = this.parts[k];
              if (Array.isArray(kparts) && kparts.length == 1) {
                res[k.toLowerCase()] = kparts[0];
              } else {
                res[k.toLowerCase()] = ICAL.helpers.clone(this.parts[k]);
              }
            }
            if (this.until) {
              res.until = this.until.toString();
            }
            if ("wkst" in this && this.wkst !== ICAL.Time.DEFAULT_WEEK_START) {
              res.wkst = ICAL.Recur.numericDayToIcalDay(this.wkst);
            }
            return res;
          },
          toString: function icalrecur_toString() {
            var str = "FREQ=" + this.freq;
            if (this.count) {
              str += ";COUNT=" + this.count;
            }
            if (this.interval > 1) {
              str += ";INTERVAL=" + this.interval;
            }
            for (var k in this.parts) {
              if (this.parts.hasOwnProperty(k)) {
                str += ";" + k + "=" + this.parts[k];
              }
            }
            if (this.until) {
              str += ";UNTIL=" + this.until.toICALString();
            }
            if ("wkst" in this && this.wkst !== ICAL.Time.DEFAULT_WEEK_START) {
              str += ";WKST=" + ICAL.Recur.numericDayToIcalDay(this.wkst);
            }
            return str;
          }
        };
        function parseNumericValue(type, min, max, value) {
          var result = value;
          if (value[0] === "+") {
            result = value.substr(1);
          }
          result = ICAL.helpers.strictParseInt(result);
          if (min !== void 0 && value < min) {
            throw new Error(type + ': invalid value "' + value + '" must be > ' + min);
          }
          if (max !== void 0 && value > max) {
            throw new Error(type + ': invalid value "' + value + '" must be < ' + min);
          }
          return result;
        }
        ICAL.Recur.icalDayToNumericDay = function toNumericDay(string, aWeekStart) {
          var firstDow = aWeekStart || ICAL.Time.SUNDAY;
          return (DOW_MAP[string] - firstDow + 7) % 7 + 1;
        };
        ICAL.Recur.numericDayToIcalDay = function toIcalDay(num, aWeekStart) {
          var firstDow = aWeekStart || ICAL.Time.SUNDAY;
          var dow = num + firstDow - ICAL.Time.SUNDAY;
          if (dow > 7) {
            dow -= 7;
          }
          return REVERSE_DOW_MAP[dow];
        };
        var VALID_DAY_NAMES = /^(SU|MO|TU|WE|TH|FR|SA)$/;
        var VALID_BYDAY_PART = /^([+-])?(5[0-3]|[1-4][0-9]|[1-9])?(SU|MO|TU|WE|TH|FR|SA)$/;
        var ALLOWED_FREQ = [
          "SECONDLY",
          "MINUTELY",
          "HOURLY",
          "DAILY",
          "WEEKLY",
          "MONTHLY",
          "YEARLY"
        ];
        var optionDesign = {
          FREQ: function(value, dict, fmtIcal) {
            if (ALLOWED_FREQ.indexOf(value) !== -1) {
              dict.freq = value;
            } else {
              throw new Error('invalid frequency "' + value + '" expected: "' + ALLOWED_FREQ.join(", ") + '"');
            }
          },
          COUNT: function(value, dict, fmtIcal) {
            dict.count = ICAL.helpers.strictParseInt(value);
          },
          INTERVAL: function(value, dict, fmtIcal) {
            dict.interval = ICAL.helpers.strictParseInt(value);
            if (dict.interval < 1) {
              dict.interval = 1;
            }
          },
          UNTIL: function(value, dict, fmtIcal) {
            if (value.length > 10) {
              dict.until = ICAL.design.icalendar.value["date-time"].fromICAL(value);
            } else {
              dict.until = ICAL.design.icalendar.value.date.fromICAL(value);
            }
            if (!fmtIcal) {
              dict.until = ICAL.Time.fromString(dict.until);
            }
          },
          WKST: function(value, dict, fmtIcal) {
            if (VALID_DAY_NAMES.test(value)) {
              dict.wkst = ICAL.Recur.icalDayToNumericDay(value);
            } else {
              throw new Error('invalid WKST value "' + value + '"');
            }
          }
        };
        var partDesign = {
          BYSECOND: parseNumericValue.bind(this, "BYSECOND", 0, 60),
          BYMINUTE: parseNumericValue.bind(this, "BYMINUTE", 0, 59),
          BYHOUR: parseNumericValue.bind(this, "BYHOUR", 0, 23),
          BYDAY: function(value) {
            if (VALID_BYDAY_PART.test(value)) {
              return value;
            } else {
              throw new Error('invalid BYDAY value "' + value + '"');
            }
          },
          BYMONTHDAY: parseNumericValue.bind(this, "BYMONTHDAY", -31, 31),
          BYYEARDAY: parseNumericValue.bind(this, "BYYEARDAY", -366, 366),
          BYWEEKNO: parseNumericValue.bind(this, "BYWEEKNO", -53, 53),
          BYMONTH: parseNumericValue.bind(this, "BYMONTH", 0, 12),
          BYSETPOS: parseNumericValue.bind(this, "BYSETPOS", -366, 366)
        };
        ICAL.Recur.fromString = function(string) {
          var data = ICAL.Recur._stringToData(string, false);
          return new ICAL.Recur(data);
        };
        ICAL.Recur.fromData = function(aData) {
          return new ICAL.Recur(aData);
        };
        ICAL.Recur._stringToData = function(string, fmtIcal) {
          var dict = Object.create(null);
          var values = string.split(";");
          var len = values.length;
          for (var i = 0; i < len; i++) {
            var parts = values[i].split("=");
            var ucname = parts[0].toUpperCase();
            var lcname = parts[0].toLowerCase();
            var name = fmtIcal ? lcname : ucname;
            var value = parts[1];
            if (ucname in partDesign) {
              var partArr = value.split(",");
              var partArrIdx = 0;
              var partArrLen = partArr.length;
              for (; partArrIdx < partArrLen; partArrIdx++) {
                partArr[partArrIdx] = partDesign[ucname](partArr[partArrIdx]);
              }
              dict[name] = partArr.length == 1 ? partArr[0] : partArr;
            } else if (ucname in optionDesign) {
              optionDesign[ucname](value, dict, fmtIcal);
            } else {
              dict[lcname] = value;
            }
          }
          return dict;
        };
      })();
      ICAL.RecurIterator = function() {
        function icalrecur_iterator(options) {
          this.fromData(options);
        }
        icalrecur_iterator.prototype = {
          completed: false,
          rule: null,
          dtstart: null,
          last: null,
          occurrence_number: 0,
          by_indices: null,
          initialized: false,
          by_data: null,
          days: null,
          days_index: 0,
          fromData: function(options) {
            this.rule = ICAL.helpers.formatClassType(options.rule, ICAL.Recur);
            if (!this.rule) {
              throw new Error("iterator requires a (ICAL.Recur) rule");
            }
            this.dtstart = ICAL.helpers.formatClassType(options.dtstart, ICAL.Time);
            if (!this.dtstart) {
              throw new Error("iterator requires a (ICAL.Time) dtstart");
            }
            if (options.by_data) {
              this.by_data = options.by_data;
            } else {
              this.by_data = ICAL.helpers.clone(this.rule.parts, true);
            }
            if (options.occurrence_number)
              this.occurrence_number = options.occurrence_number;
            this.days = options.days || [];
            if (options.last) {
              this.last = ICAL.helpers.formatClassType(options.last, ICAL.Time);
            }
            this.by_indices = options.by_indices;
            if (!this.by_indices) {
              this.by_indices = {
                "BYSECOND": 0,
                "BYMINUTE": 0,
                "BYHOUR": 0,
                "BYDAY": 0,
                "BYMONTH": 0,
                "BYWEEKNO": 0,
                "BYMONTHDAY": 0
              };
            }
            this.initialized = options.initialized || false;
            if (!this.initialized) {
              this.init();
            }
          },
          init: function icalrecur_iterator_init() {
            this.initialized = true;
            this.last = this.dtstart.clone();
            var parts = this.by_data;
            if ("BYDAY" in parts) {
              this.sort_byday_rules(parts.BYDAY);
            }
            if ("BYYEARDAY" in parts) {
              if ("BYMONTH" in parts || "BYWEEKNO" in parts || "BYMONTHDAY" in parts || "BYDAY" in parts) {
                throw new Error("Invalid BYYEARDAY rule");
              }
            }
            if ("BYWEEKNO" in parts && "BYMONTHDAY" in parts) {
              throw new Error("BYWEEKNO does not fit to BYMONTHDAY");
            }
            if (this.rule.freq == "MONTHLY" && ("BYYEARDAY" in parts || "BYWEEKNO" in parts)) {
              throw new Error("For MONTHLY recurrences neither BYYEARDAY nor BYWEEKNO may appear");
            }
            if (this.rule.freq == "WEEKLY" && ("BYYEARDAY" in parts || "BYMONTHDAY" in parts)) {
              throw new Error("For WEEKLY recurrences neither BYMONTHDAY nor BYYEARDAY may appear");
            }
            if (this.rule.freq != "YEARLY" && "BYYEARDAY" in parts) {
              throw new Error("BYYEARDAY may only appear in YEARLY rules");
            }
            this.last.second = this.setup_defaults("BYSECOND", "SECONDLY", this.dtstart.second);
            this.last.minute = this.setup_defaults("BYMINUTE", "MINUTELY", this.dtstart.minute);
            this.last.hour = this.setup_defaults("BYHOUR", "HOURLY", this.dtstart.hour);
            this.last.day = this.setup_defaults("BYMONTHDAY", "DAILY", this.dtstart.day);
            this.last.month = this.setup_defaults("BYMONTH", "MONTHLY", this.dtstart.month);
            if (this.rule.freq == "WEEKLY") {
              if ("BYDAY" in parts) {
                var bydayParts = this.ruleDayOfWeek(parts.BYDAY[0], this.rule.wkst);
                var pos = bydayParts[0];
                var dow = bydayParts[1];
                var wkdy = dow - this.last.dayOfWeek(this.rule.wkst);
                if (this.last.dayOfWeek(this.rule.wkst) < dow && wkdy >= 0 || wkdy < 0) {
                  this.last.day += wkdy;
                }
              } else {
                var dayName = ICAL.Recur.numericDayToIcalDay(this.dtstart.dayOfWeek());
                parts.BYDAY = [dayName];
              }
            }
            if (this.rule.freq == "YEARLY") {
              for (; ; ) {
                this.expand_year_days(this.last.year);
                if (this.days.length > 0) {
                  break;
                }
                this.increment_year(this.rule.interval);
              }
              this._nextByYearDay();
            }
            if (this.rule.freq == "MONTHLY" && this.has_by_data("BYDAY")) {
              var tempLast = null;
              var initLast = this.last.clone();
              var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
              for (var i in this.by_data.BYDAY) {
                if (!this.by_data.BYDAY.hasOwnProperty(i)) {
                  continue;
                }
                this.last = initLast.clone();
                var bydayParts = this.ruleDayOfWeek(this.by_data.BYDAY[i]);
                var pos = bydayParts[0];
                var dow = bydayParts[1];
                var dayOfMonth = this.last.nthWeekDay(dow, pos);
                if (pos >= 6 || pos <= -6) {
                  throw new Error("Malformed values in BYDAY part");
                }
                if (dayOfMonth > daysInMonth || dayOfMonth <= 0) {
                  if (tempLast && tempLast.month == initLast.month) {
                    continue;
                  }
                  while (dayOfMonth > daysInMonth || dayOfMonth <= 0) {
                    this.increment_month();
                    daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
                    dayOfMonth = this.last.nthWeekDay(dow, pos);
                  }
                }
                this.last.day = dayOfMonth;
                if (!tempLast || this.last.compare(tempLast) < 0) {
                  tempLast = this.last.clone();
                }
              }
              this.last = tempLast.clone();
              if (this.has_by_data("BYMONTHDAY")) {
                this._byDayAndMonthDay(true);
              }
              if (this.last.day > daysInMonth || this.last.day == 0) {
                throw new Error("Malformed values in BYDAY part");
              }
            } else if (this.has_by_data("BYMONTHDAY")) {
              if (this.last.day < 0) {
                var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
                this.last.day = daysInMonth + this.last.day + 1;
              }
            }
          },
          next: function icalrecur_iterator_next() {
            var before = this.last ? this.last.clone() : null;
            if (this.rule.count && this.occurrence_number >= this.rule.count || this.rule.until && this.last.compare(this.rule.until) > 0) {
              this.completed = true;
              return null;
            }
            if (this.occurrence_number == 0 && this.last.compare(this.dtstart) >= 0) {
              this.occurrence_number++;
              return this.last;
            }
            var valid;
            do {
              valid = 1;
              switch (this.rule.freq) {
                case "SECONDLY":
                  this.next_second();
                  break;
                case "MINUTELY":
                  this.next_minute();
                  break;
                case "HOURLY":
                  this.next_hour();
                  break;
                case "DAILY":
                  this.next_day();
                  break;
                case "WEEKLY":
                  this.next_week();
                  break;
                case "MONTHLY":
                  valid = this.next_month();
                  break;
                case "YEARLY":
                  this.next_year();
                  break;
                default:
                  return null;
              }
            } while (!this.check_contracting_rules() || this.last.compare(this.dtstart) < 0 || !valid);
            if (this.last.compare(before) == 0) {
              throw new Error("Same occurrence found twice, protecting you from death by recursion");
            }
            if (this.rule.until && this.last.compare(this.rule.until) > 0) {
              this.completed = true;
              return null;
            } else {
              this.occurrence_number++;
              return this.last;
            }
          },
          next_second: function next_second() {
            return this.next_generic("BYSECOND", "SECONDLY", "second", "minute");
          },
          increment_second: function increment_second(inc) {
            return this.increment_generic(inc, "second", 60, "minute");
          },
          next_minute: function next_minute() {
            return this.next_generic("BYMINUTE", "MINUTELY", "minute", "hour", "next_second");
          },
          increment_minute: function increment_minute(inc) {
            return this.increment_generic(inc, "minute", 60, "hour");
          },
          next_hour: function next_hour() {
            return this.next_generic("BYHOUR", "HOURLY", "hour", "monthday", "next_minute");
          },
          increment_hour: function increment_hour(inc) {
            this.increment_generic(inc, "hour", 24, "monthday");
          },
          next_day: function next_day() {
            var has_by_day = "BYDAY" in this.by_data;
            var this_freq = this.rule.freq == "DAILY";
            if (this.next_hour() == 0) {
              return 0;
            }
            if (this_freq) {
              this.increment_monthday(this.rule.interval);
            } else {
              this.increment_monthday(1);
            }
            return 0;
          },
          next_week: function next_week() {
            var end_of_data = 0;
            if (this.next_weekday_by_week() == 0) {
              return end_of_data;
            }
            if (this.has_by_data("BYWEEKNO")) {
              var idx = ++this.by_indices.BYWEEKNO;
              if (this.by_indices.BYWEEKNO == this.by_data.BYWEEKNO.length) {
                this.by_indices.BYWEEKNO = 0;
                end_of_data = 1;
              }
              this.last.month = 1;
              this.last.day = 1;
              var week_no = this.by_data.BYWEEKNO[this.by_indices.BYWEEKNO];
              this.last.day += 7 * week_no;
              if (end_of_data) {
                this.increment_year(1);
              }
            } else {
              this.increment_monthday(7 * this.rule.interval);
            }
            return end_of_data;
          },
          normalizeByMonthDayRules: function(year, month, rules) {
            var daysInMonth = ICAL.Time.daysInMonth(month, year);
            var newRules = [];
            var ruleIdx = 0;
            var len = rules.length;
            var rule;
            for (; ruleIdx < len; ruleIdx++) {
              rule = rules[ruleIdx];
              if (Math.abs(rule) > daysInMonth) {
                continue;
              }
              if (rule < 0) {
                rule = daysInMonth + (rule + 1);
              } else if (rule === 0) {
                continue;
              }
              if (newRules.indexOf(rule) === -1) {
                newRules.push(rule);
              }
            }
            return newRules.sort(function(a, b) {
              return a - b;
            });
          },
          _byDayAndMonthDay: function(isInit) {
            var byMonthDay;
            var byDay = this.by_data.BYDAY;
            var date;
            var dateIdx = 0;
            var dateLen;
            var dayLen = byDay.length;
            var dataIsValid = 0;
            var daysInMonth;
            var self2 = this;
            var lastDay = this.last.day;
            function initMonth() {
              daysInMonth = ICAL.Time.daysInMonth(self2.last.month, self2.last.year);
              byMonthDay = self2.normalizeByMonthDayRules(self2.last.year, self2.last.month, self2.by_data.BYMONTHDAY);
              dateLen = byMonthDay.length;
              while (byMonthDay[dateIdx] <= lastDay && !(isInit && byMonthDay[dateIdx] == lastDay) && dateIdx < dateLen - 1) {
                dateIdx++;
              }
            }
            function nextMonth() {
              lastDay = 0;
              self2.increment_month();
              dateIdx = 0;
              initMonth();
            }
            initMonth();
            if (isInit) {
              lastDay -= 1;
            }
            var monthsCounter = 48;
            while (!dataIsValid && monthsCounter) {
              monthsCounter--;
              date = lastDay + 1;
              if (date > daysInMonth) {
                nextMonth();
                continue;
              }
              var next = byMonthDay[dateIdx++];
              if (next >= date) {
                lastDay = next;
              } else {
                nextMonth();
                continue;
              }
              for (var dayIdx = 0; dayIdx < dayLen; dayIdx++) {
                var parts = this.ruleDayOfWeek(byDay[dayIdx]);
                var pos = parts[0];
                var dow = parts[1];
                this.last.day = lastDay;
                if (this.last.isNthWeekDay(dow, pos)) {
                  dataIsValid = 1;
                  break;
                }
              }
              if (!dataIsValid && dateIdx === dateLen) {
                nextMonth();
                continue;
              }
            }
            if (monthsCounter <= 0) {
              throw new Error("Malformed values in BYDAY combined with BYMONTHDAY parts");
            }
            return dataIsValid;
          },
          next_month: function next_month() {
            var this_freq = this.rule.freq == "MONTHLY";
            var data_valid = 1;
            if (this.next_hour() == 0) {
              return data_valid;
            }
            if (this.has_by_data("BYDAY") && this.has_by_data("BYMONTHDAY")) {
              data_valid = this._byDayAndMonthDay();
            } else if (this.has_by_data("BYDAY")) {
              var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
              var setpos = 0;
              var setpos_total = 0;
              if (this.has_by_data("BYSETPOS")) {
                var last_day = this.last.day;
                for (var day = 1; day <= daysInMonth; day++) {
                  this.last.day = day;
                  if (this.is_day_in_byday(this.last)) {
                    setpos_total++;
                    if (day <= last_day) {
                      setpos++;
                    }
                  }
                }
                this.last.day = last_day;
              }
              data_valid = 0;
              for (var day = this.last.day + 1; day <= daysInMonth; day++) {
                this.last.day = day;
                if (this.is_day_in_byday(this.last)) {
                  if (!this.has_by_data("BYSETPOS") || this.check_set_position(++setpos) || this.check_set_position(setpos - setpos_total - 1)) {
                    data_valid = 1;
                    break;
                  }
                }
              }
              if (day > daysInMonth) {
                this.last.day = 1;
                this.increment_month();
                if (this.is_day_in_byday(this.last)) {
                  if (!this.has_by_data("BYSETPOS") || this.check_set_position(1)) {
                    data_valid = 1;
                  }
                } else {
                  data_valid = 0;
                }
              }
            } else if (this.has_by_data("BYMONTHDAY")) {
              this.by_indices.BYMONTHDAY++;
              if (this.by_indices.BYMONTHDAY >= this.by_data.BYMONTHDAY.length) {
                this.by_indices.BYMONTHDAY = 0;
                this.increment_month();
              }
              var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
              var day = this.by_data.BYMONTHDAY[this.by_indices.BYMONTHDAY];
              if (day < 0) {
                day = daysInMonth + day + 1;
              }
              if (day > daysInMonth) {
                this.last.day = 1;
                data_valid = this.is_day_in_byday(this.last);
              } else {
                this.last.day = day;
              }
            } else {
              this.increment_month();
              var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
              if (this.by_data.BYMONTHDAY[0] > daysInMonth) {
                data_valid = 0;
              } else {
                this.last.day = this.by_data.BYMONTHDAY[0];
              }
            }
            return data_valid;
          },
          next_weekday_by_week: function next_weekday_by_week() {
            var end_of_data = 0;
            if (this.next_hour() == 0) {
              return end_of_data;
            }
            if (!this.has_by_data("BYDAY")) {
              return 1;
            }
            for (; ; ) {
              var tt = new ICAL.Time();
              this.by_indices.BYDAY++;
              if (this.by_indices.BYDAY == Object.keys(this.by_data.BYDAY).length) {
                this.by_indices.BYDAY = 0;
                end_of_data = 1;
              }
              var coded_day = this.by_data.BYDAY[this.by_indices.BYDAY];
              var parts = this.ruleDayOfWeek(coded_day);
              var dow = parts[1];
              dow -= this.rule.wkst;
              if (dow < 0) {
                dow += 7;
              }
              tt.year = this.last.year;
              tt.month = this.last.month;
              tt.day = this.last.day;
              var startOfWeek = tt.startDoyWeek(this.rule.wkst);
              if (dow + startOfWeek < 1) {
                if (!end_of_data) {
                  continue;
                }
              }
              var next = ICAL.Time.fromDayOfYear(startOfWeek + dow, this.last.year);
              this.last.year = next.year;
              this.last.month = next.month;
              this.last.day = next.day;
              return end_of_data;
            }
          },
          next_year: function next_year() {
            if (this.next_hour() == 0) {
              return 0;
            }
            if (++this.days_index == this.days.length) {
              this.days_index = 0;
              do {
                this.increment_year(this.rule.interval);
                this.expand_year_days(this.last.year);
              } while (this.days.length == 0);
            }
            this._nextByYearDay();
            return 1;
          },
          _nextByYearDay: function _nextByYearDay() {
            var doy = this.days[this.days_index];
            var year = this.last.year;
            if (doy < 1) {
              doy += 1;
              year += 1;
            }
            var next = ICAL.Time.fromDayOfYear(doy, year);
            this.last.day = next.day;
            this.last.month = next.month;
          },
          ruleDayOfWeek: function ruleDayOfWeek(dow, aWeekStart) {
            var matches = dow.match(/([+-]?[0-9])?(MO|TU|WE|TH|FR|SA|SU)/);
            if (matches) {
              var pos = parseInt(matches[1] || 0, 10);
              dow = ICAL.Recur.icalDayToNumericDay(matches[2], aWeekStart);
              return [pos, dow];
            } else {
              return [0, 0];
            }
          },
          next_generic: function next_generic(aRuleType, aInterval, aDateAttr, aFollowingAttr, aPreviousIncr) {
            var has_by_rule = aRuleType in this.by_data;
            var this_freq = this.rule.freq == aInterval;
            var end_of_data = 0;
            if (aPreviousIncr && this[aPreviousIncr]() == 0) {
              return end_of_data;
            }
            if (has_by_rule) {
              this.by_indices[aRuleType]++;
              var idx = this.by_indices[aRuleType];
              var dta = this.by_data[aRuleType];
              if (this.by_indices[aRuleType] == dta.length) {
                this.by_indices[aRuleType] = 0;
                end_of_data = 1;
              }
              this.last[aDateAttr] = dta[this.by_indices[aRuleType]];
            } else if (this_freq) {
              this["increment_" + aDateAttr](this.rule.interval);
            }
            if (has_by_rule && end_of_data && this_freq) {
              this["increment_" + aFollowingAttr](1);
            }
            return end_of_data;
          },
          increment_monthday: function increment_monthday(inc) {
            for (var i = 0; i < inc; i++) {
              var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
              this.last.day++;
              if (this.last.day > daysInMonth) {
                this.last.day -= daysInMonth;
                this.increment_month();
              }
            }
          },
          increment_month: function increment_month() {
            this.last.day = 1;
            if (this.has_by_data("BYMONTH")) {
              this.by_indices.BYMONTH++;
              if (this.by_indices.BYMONTH == this.by_data.BYMONTH.length) {
                this.by_indices.BYMONTH = 0;
                this.increment_year(1);
              }
              this.last.month = this.by_data.BYMONTH[this.by_indices.BYMONTH];
            } else {
              if (this.rule.freq == "MONTHLY") {
                this.last.month += this.rule.interval;
              } else {
                this.last.month++;
              }
              this.last.month--;
              var years = ICAL.helpers.trunc(this.last.month / 12);
              this.last.month %= 12;
              this.last.month++;
              if (years != 0) {
                this.increment_year(years);
              }
            }
          },
          increment_year: function increment_year(inc) {
            this.last.year += inc;
          },
          increment_generic: function increment_generic(inc, aDateAttr, aFactor, aNextIncrement) {
            this.last[aDateAttr] += inc;
            var nextunit = ICAL.helpers.trunc(this.last[aDateAttr] / aFactor);
            this.last[aDateAttr] %= aFactor;
            if (nextunit != 0) {
              this["increment_" + aNextIncrement](nextunit);
            }
          },
          has_by_data: function has_by_data(aRuleType) {
            return aRuleType in this.rule.parts;
          },
          expand_year_days: function expand_year_days(aYear) {
            var t = new ICAL.Time();
            this.days = [];
            var parts = {};
            var rules = ["BYDAY", "BYWEEKNO", "BYMONTHDAY", "BYMONTH", "BYYEARDAY"];
            for (var p in rules) {
              if (rules.hasOwnProperty(p)) {
                var part = rules[p];
                if (part in this.rule.parts) {
                  parts[part] = this.rule.parts[part];
                }
              }
            }
            if ("BYMONTH" in parts && "BYWEEKNO" in parts) {
              var valid = 1;
              var validWeeks = {};
              t.year = aYear;
              t.isDate = true;
              for (var monthIdx = 0; monthIdx < this.by_data.BYMONTH.length; monthIdx++) {
                var month = this.by_data.BYMONTH[monthIdx];
                t.month = month;
                t.day = 1;
                var first_week = t.weekNumber(this.rule.wkst);
                t.day = ICAL.Time.daysInMonth(month, aYear);
                var last_week = t.weekNumber(this.rule.wkst);
                for (monthIdx = first_week; monthIdx < last_week; monthIdx++) {
                  validWeeks[monthIdx] = 1;
                }
              }
              for (var weekIdx = 0; weekIdx < this.by_data.BYWEEKNO.length && valid; weekIdx++) {
                var weekno = this.by_data.BYWEEKNO[weekIdx];
                if (weekno < 52) {
                  valid &= validWeeks[weekIdx];
                } else {
                  valid = 0;
                }
              }
              if (valid) {
                delete parts.BYMONTH;
              } else {
                delete parts.BYWEEKNO;
              }
            }
            var partCount = Object.keys(parts).length;
            if (partCount == 0) {
              var t1 = this.dtstart.clone();
              t1.year = this.last.year;
              this.days.push(t1.dayOfYear());
            } else if (partCount == 1 && "BYMONTH" in parts) {
              for (var monthkey in this.by_data.BYMONTH) {
                if (!this.by_data.BYMONTH.hasOwnProperty(monthkey)) {
                  continue;
                }
                var t2 = this.dtstart.clone();
                t2.year = aYear;
                t2.month = this.by_data.BYMONTH[monthkey];
                t2.isDate = true;
                this.days.push(t2.dayOfYear());
              }
            } else if (partCount == 1 && "BYMONTHDAY" in parts) {
              for (var monthdaykey in this.by_data.BYMONTHDAY) {
                if (!this.by_data.BYMONTHDAY.hasOwnProperty(monthdaykey)) {
                  continue;
                }
                var t3 = this.dtstart.clone();
                var day_ = this.by_data.BYMONTHDAY[monthdaykey];
                if (day_ < 0) {
                  var daysInMonth = ICAL.Time.daysInMonth(t3.month, aYear);
                  day_ = day_ + daysInMonth + 1;
                }
                t3.day = day_;
                t3.year = aYear;
                t3.isDate = true;
                this.days.push(t3.dayOfYear());
              }
            } else if (partCount == 2 && "BYMONTHDAY" in parts && "BYMONTH" in parts) {
              for (var monthkey in this.by_data.BYMONTH) {
                if (!this.by_data.BYMONTH.hasOwnProperty(monthkey)) {
                  continue;
                }
                var month_ = this.by_data.BYMONTH[monthkey];
                var daysInMonth = ICAL.Time.daysInMonth(month_, aYear);
                for (var monthdaykey in this.by_data.BYMONTHDAY) {
                  if (!this.by_data.BYMONTHDAY.hasOwnProperty(monthdaykey)) {
                    continue;
                  }
                  var day_ = this.by_data.BYMONTHDAY[monthdaykey];
                  if (day_ < 0) {
                    day_ = day_ + daysInMonth + 1;
                  }
                  t.day = day_;
                  t.month = month_;
                  t.year = aYear;
                  t.isDate = true;
                  this.days.push(t.dayOfYear());
                }
              }
            } else if (partCount == 1 && "BYWEEKNO" in parts) {
            } else if (partCount == 2 && "BYWEEKNO" in parts && "BYMONTHDAY" in parts) {
            } else if (partCount == 1 && "BYDAY" in parts) {
              this.days = this.days.concat(this.expand_by_day(aYear));
            } else if (partCount == 2 && "BYDAY" in parts && "BYMONTH" in parts) {
              for (var monthkey in this.by_data.BYMONTH) {
                if (!this.by_data.BYMONTH.hasOwnProperty(monthkey)) {
                  continue;
                }
                var month = this.by_data.BYMONTH[monthkey];
                var daysInMonth = ICAL.Time.daysInMonth(month, aYear);
                t.year = aYear;
                t.month = this.by_data.BYMONTH[monthkey];
                t.day = 1;
                t.isDate = true;
                var first_dow = t.dayOfWeek();
                var doy_offset = t.dayOfYear() - 1;
                t.day = daysInMonth;
                var last_dow = t.dayOfWeek();
                if (this.has_by_data("BYSETPOS")) {
                  var set_pos_counter = 0;
                  var by_month_day = [];
                  for (var day = 1; day <= daysInMonth; day++) {
                    t.day = day;
                    if (this.is_day_in_byday(t)) {
                      by_month_day.push(day);
                    }
                  }
                  for (var spIndex = 0; spIndex < by_month_day.length; spIndex++) {
                    if (this.check_set_position(spIndex + 1) || this.check_set_position(spIndex - by_month_day.length)) {
                      this.days.push(doy_offset + by_month_day[spIndex]);
                    }
                  }
                } else {
                  for (var daycodedkey in this.by_data.BYDAY) {
                    if (!this.by_data.BYDAY.hasOwnProperty(daycodedkey)) {
                      continue;
                    }
                    var coded_day = this.by_data.BYDAY[daycodedkey];
                    var bydayParts = this.ruleDayOfWeek(coded_day);
                    var pos = bydayParts[0];
                    var dow = bydayParts[1];
                    var month_day;
                    var first_matching_day = (dow + 7 - first_dow) % 7 + 1;
                    var last_matching_day = daysInMonth - (last_dow + 7 - dow) % 7;
                    if (pos == 0) {
                      for (var day = first_matching_day; day <= daysInMonth; day += 7) {
                        this.days.push(doy_offset + day);
                      }
                    } else if (pos > 0) {
                      month_day = first_matching_day + (pos - 1) * 7;
                      if (month_day <= daysInMonth) {
                        this.days.push(doy_offset + month_day);
                      }
                    } else {
                      month_day = last_matching_day + (pos + 1) * 7;
                      if (month_day > 0) {
                        this.days.push(doy_offset + month_day);
                      }
                    }
                  }
                }
              }
              this.days.sort(function(a, b) {
                return a - b;
              });
            } else if (partCount == 2 && "BYDAY" in parts && "BYMONTHDAY" in parts) {
              var expandedDays = this.expand_by_day(aYear);
              for (var daykey in expandedDays) {
                if (!expandedDays.hasOwnProperty(daykey)) {
                  continue;
                }
                var day = expandedDays[daykey];
                var tt = ICAL.Time.fromDayOfYear(day, aYear);
                if (this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
                  this.days.push(day);
                }
              }
            } else if (partCount == 3 && "BYDAY" in parts && "BYMONTHDAY" in parts && "BYMONTH" in parts) {
              var expandedDays = this.expand_by_day(aYear);
              for (var daykey in expandedDays) {
                if (!expandedDays.hasOwnProperty(daykey)) {
                  continue;
                }
                var day = expandedDays[daykey];
                var tt = ICAL.Time.fromDayOfYear(day, aYear);
                if (this.by_data.BYMONTH.indexOf(tt.month) >= 0 && this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
                  this.days.push(day);
                }
              }
            } else if (partCount == 2 && "BYDAY" in parts && "BYWEEKNO" in parts) {
              var expandedDays = this.expand_by_day(aYear);
              for (var daykey in expandedDays) {
                if (!expandedDays.hasOwnProperty(daykey)) {
                  continue;
                }
                var day = expandedDays[daykey];
                var tt = ICAL.Time.fromDayOfYear(day, aYear);
                var weekno = tt.weekNumber(this.rule.wkst);
                if (this.by_data.BYWEEKNO.indexOf(weekno)) {
                  this.days.push(day);
                }
              }
            } else if (partCount == 3 && "BYDAY" in parts && "BYWEEKNO" in parts && "BYMONTHDAY" in parts) {
            } else if (partCount == 1 && "BYYEARDAY" in parts) {
              this.days = this.days.concat(this.by_data.BYYEARDAY);
            } else {
              this.days = [];
            }
            return 0;
          },
          expand_by_day: function expand_by_day(aYear) {
            var days_list = [];
            var tmp = this.last.clone();
            tmp.year = aYear;
            tmp.month = 1;
            tmp.day = 1;
            tmp.isDate = true;
            var start_dow = tmp.dayOfWeek();
            tmp.month = 12;
            tmp.day = 31;
            tmp.isDate = true;
            var end_dow = tmp.dayOfWeek();
            var end_year_day = tmp.dayOfYear();
            for (var daykey in this.by_data.BYDAY) {
              if (!this.by_data.BYDAY.hasOwnProperty(daykey)) {
                continue;
              }
              var day = this.by_data.BYDAY[daykey];
              var parts = this.ruleDayOfWeek(day);
              var pos = parts[0];
              var dow = parts[1];
              if (pos == 0) {
                var tmp_start_doy = (dow + 7 - start_dow) % 7 + 1;
                for (var doy = tmp_start_doy; doy <= end_year_day; doy += 7) {
                  days_list.push(doy);
                }
              } else if (pos > 0) {
                var first;
                if (dow >= start_dow) {
                  first = dow - start_dow + 1;
                } else {
                  first = dow - start_dow + 8;
                }
                days_list.push(first + (pos - 1) * 7);
              } else {
                var last;
                pos = -pos;
                if (dow <= end_dow) {
                  last = end_year_day - end_dow + dow;
                } else {
                  last = end_year_day - end_dow + dow - 7;
                }
                days_list.push(last - (pos - 1) * 7);
              }
            }
            return days_list;
          },
          is_day_in_byday: function is_day_in_byday(tt) {
            for (var daykey in this.by_data.BYDAY) {
              if (!this.by_data.BYDAY.hasOwnProperty(daykey)) {
                continue;
              }
              var day = this.by_data.BYDAY[daykey];
              var parts = this.ruleDayOfWeek(day);
              var pos = parts[0];
              var dow = parts[1];
              var this_dow = tt.dayOfWeek();
              if (pos == 0 && dow == this_dow || tt.nthWeekDay(dow, pos) == tt.day) {
                return 1;
              }
            }
            return 0;
          },
          check_set_position: function check_set_position(aPos) {
            if (this.has_by_data("BYSETPOS")) {
              var idx = this.by_data.BYSETPOS.indexOf(aPos);
              return idx !== -1;
            }
            return false;
          },
          sort_byday_rules: function icalrecur_sort_byday_rules(aRules) {
            for (var i = 0; i < aRules.length; i++) {
              for (var j = 0; j < i; j++) {
                var one = this.ruleDayOfWeek(aRules[j], this.rule.wkst)[1];
                var two = this.ruleDayOfWeek(aRules[i], this.rule.wkst)[1];
                if (one > two) {
                  var tmp = aRules[i];
                  aRules[i] = aRules[j];
                  aRules[j] = tmp;
                }
              }
            }
          },
          check_contract_restriction: function check_contract_restriction(aRuleType, v) {
            var indexMapValue = icalrecur_iterator._indexMap[aRuleType];
            var ruleMapValue = icalrecur_iterator._expandMap[this.rule.freq][indexMapValue];
            var pass = false;
            if (aRuleType in this.by_data && ruleMapValue == icalrecur_iterator.CONTRACT) {
              var ruleType = this.by_data[aRuleType];
              for (var bydatakey in ruleType) {
                if (ruleType.hasOwnProperty(bydatakey)) {
                  if (ruleType[bydatakey] == v) {
                    pass = true;
                    break;
                  }
                }
              }
            } else {
              pass = true;
            }
            return pass;
          },
          check_contracting_rules: function check_contracting_rules() {
            var dow = this.last.dayOfWeek();
            var weekNo = this.last.weekNumber(this.rule.wkst);
            var doy = this.last.dayOfYear();
            return this.check_contract_restriction("BYSECOND", this.last.second) && this.check_contract_restriction("BYMINUTE", this.last.minute) && this.check_contract_restriction("BYHOUR", this.last.hour) && this.check_contract_restriction("BYDAY", ICAL.Recur.numericDayToIcalDay(dow)) && this.check_contract_restriction("BYWEEKNO", weekNo) && this.check_contract_restriction("BYMONTHDAY", this.last.day) && this.check_contract_restriction("BYMONTH", this.last.month) && this.check_contract_restriction("BYYEARDAY", doy);
          },
          setup_defaults: function setup_defaults(aRuleType, req, deftime) {
            var indexMapValue = icalrecur_iterator._indexMap[aRuleType];
            var ruleMapValue = icalrecur_iterator._expandMap[this.rule.freq][indexMapValue];
            if (ruleMapValue != icalrecur_iterator.CONTRACT) {
              if (!(aRuleType in this.by_data)) {
                this.by_data[aRuleType] = [deftime];
              }
              if (this.rule.freq != req) {
                return this.by_data[aRuleType][0];
              }
            }
            return deftime;
          },
          toJSON: function() {
            var result = Object.create(null);
            result.initialized = this.initialized;
            result.rule = this.rule.toJSON();
            result.dtstart = this.dtstart.toJSON();
            result.by_data = this.by_data;
            result.days = this.days;
            result.last = this.last.toJSON();
            result.by_indices = this.by_indices;
            result.occurrence_number = this.occurrence_number;
            return result;
          }
        };
        icalrecur_iterator._indexMap = {
          "BYSECOND": 0,
          "BYMINUTE": 1,
          "BYHOUR": 2,
          "BYDAY": 3,
          "BYMONTHDAY": 4,
          "BYYEARDAY": 5,
          "BYWEEKNO": 6,
          "BYMONTH": 7,
          "BYSETPOS": 8
        };
        icalrecur_iterator._expandMap = {
          "SECONDLY": [1, 1, 1, 1, 1, 1, 1, 1],
          "MINUTELY": [2, 1, 1, 1, 1, 1, 1, 1],
          "HOURLY": [2, 2, 1, 1, 1, 1, 1, 1],
          "DAILY": [2, 2, 2, 1, 1, 1, 1, 1],
          "WEEKLY": [2, 2, 2, 2, 3, 3, 1, 1],
          "MONTHLY": [2, 2, 2, 2, 2, 3, 3, 1],
          "YEARLY": [2, 2, 2, 2, 2, 2, 2, 2]
        };
        icalrecur_iterator.UNKNOWN = 0;
        icalrecur_iterator.CONTRACT = 1;
        icalrecur_iterator.EXPAND = 2;
        icalrecur_iterator.ILLEGAL = 3;
        return icalrecur_iterator;
      }();
      ICAL.RecurExpansion = function() {
        function formatTime(item) {
          return ICAL.helpers.formatClassType(item, ICAL.Time);
        }
        function compareTime(a, b) {
          return a.compare(b);
        }
        function isRecurringComponent(comp) {
          return comp.hasProperty("rdate") || comp.hasProperty("rrule") || comp.hasProperty("recurrence-id");
        }
        function RecurExpansion(options) {
          this.ruleDates = [];
          this.exDates = [];
          this.fromData(options);
        }
        RecurExpansion.prototype = {
          complete: false,
          ruleIterators: null,
          ruleDates: null,
          exDates: null,
          ruleDateInc: 0,
          exDateInc: 0,
          exDate: null,
          ruleDate: null,
          dtstart: null,
          last: null,
          fromData: function(options) {
            var start = ICAL.helpers.formatClassType(options.dtstart, ICAL.Time);
            if (!start) {
              throw new Error(".dtstart (ICAL.Time) must be given");
            } else {
              this.dtstart = start;
            }
            if (options.component) {
              this._init(options.component);
            } else {
              this.last = formatTime(options.last) || start.clone();
              if (!options.ruleIterators) {
                throw new Error(".ruleIterators or .component must be given");
              }
              this.ruleIterators = options.ruleIterators.map(function(item) {
                return ICAL.helpers.formatClassType(item, ICAL.RecurIterator);
              });
              this.ruleDateInc = options.ruleDateInc;
              this.exDateInc = options.exDateInc;
              if (options.ruleDates) {
                this.ruleDates = options.ruleDates.map(formatTime);
                this.ruleDate = this.ruleDates[this.ruleDateInc];
              }
              if (options.exDates) {
                this.exDates = options.exDates.map(formatTime);
                this.exDate = this.exDates[this.exDateInc];
              }
              if (typeof options.complete !== "undefined") {
                this.complete = options.complete;
              }
            }
          },
          next: function() {
            var iter;
            var ruleOfDay;
            var next;
            var compare;
            var maxTries = 500;
            var currentTry = 0;
            while (true) {
              if (currentTry++ > maxTries) {
                throw new Error("max tries have occured, rule may be impossible to forfill.");
              }
              next = this.ruleDate;
              iter = this._nextRecurrenceIter(this.last);
              if (!next && !iter) {
                this.complete = true;
                break;
              }
              if (!next || iter && next.compare(iter.last) > 0) {
                next = iter.last.clone();
                iter.next();
              }
              if (this.ruleDate === next) {
                this._nextRuleDay();
              }
              this.last = next;
              if (this.exDate) {
                compare = this.exDate.compare(this.last);
                if (compare < 0) {
                  this._nextExDay();
                }
                if (compare === 0) {
                  this._nextExDay();
                  continue;
                }
              }
              return this.last;
            }
          },
          toJSON: function() {
            function toJSON(item) {
              return item.toJSON();
            }
            var result = Object.create(null);
            result.ruleIterators = this.ruleIterators.map(toJSON);
            if (this.ruleDates) {
              result.ruleDates = this.ruleDates.map(toJSON);
            }
            if (this.exDates) {
              result.exDates = this.exDates.map(toJSON);
            }
            result.ruleDateInc = this.ruleDateInc;
            result.exDateInc = this.exDateInc;
            result.last = this.last.toJSON();
            result.dtstart = this.dtstart.toJSON();
            result.complete = this.complete;
            return result;
          },
          _extractDates: function(component, propertyName) {
            function handleProp(prop2) {
              idx = ICAL.helpers.binsearchInsert(result, prop2, compareTime);
              result.splice(idx, 0, prop2);
            }
            var result = [];
            var props = component.getAllProperties(propertyName);
            var len = props.length;
            var i = 0;
            var prop;
            var idx;
            for (; i < len; i++) {
              props[i].getValues().forEach(handleProp);
            }
            return result;
          },
          _init: function(component) {
            this.ruleIterators = [];
            this.last = this.dtstart.clone();
            if (!isRecurringComponent(component)) {
              this.ruleDate = this.last.clone();
              this.complete = true;
              return;
            }
            if (component.hasProperty("rdate")) {
              this.ruleDates = this._extractDates(component, "rdate");
              if (this.ruleDates[0] && this.ruleDates[0].compare(this.dtstart) < 0) {
                this.ruleDateInc = 0;
                this.last = this.ruleDates[0].clone();
              } else {
                this.ruleDateInc = ICAL.helpers.binsearchInsert(this.ruleDates, this.last, compareTime);
              }
              this.ruleDate = this.ruleDates[this.ruleDateInc];
            }
            if (component.hasProperty("rrule")) {
              var rules = component.getAllProperties("rrule");
              var i = 0;
              var len = rules.length;
              var rule;
              var iter;
              for (; i < len; i++) {
                rule = rules[i].getFirstValue();
                iter = rule.iterator(this.dtstart);
                this.ruleIterators.push(iter);
                iter.next();
              }
            }
            if (component.hasProperty("exdate")) {
              this.exDates = this._extractDates(component, "exdate");
              this.exDateInc = ICAL.helpers.binsearchInsert(this.exDates, this.last, compareTime);
              this.exDate = this.exDates[this.exDateInc];
            }
          },
          _nextExDay: function() {
            this.exDate = this.exDates[++this.exDateInc];
          },
          _nextRuleDay: function() {
            this.ruleDate = this.ruleDates[++this.ruleDateInc];
          },
          _nextRecurrenceIter: function() {
            var iters = this.ruleIterators;
            if (iters.length === 0) {
              return null;
            }
            var len = iters.length;
            var iter;
            var iterTime;
            var iterIdx = 0;
            var chosenIter;
            for (; iterIdx < len; iterIdx++) {
              iter = iters[iterIdx];
              iterTime = iter.last;
              if (iter.completed) {
                len--;
                if (iterIdx !== 0) {
                  iterIdx--;
                }
                iters.splice(iterIdx, 1);
                continue;
              }
              if (!chosenIter || chosenIter.last.compare(iterTime) > 0) {
                chosenIter = iter;
              }
            }
            return chosenIter;
          }
        };
        return RecurExpansion;
      }();
      ICAL.Event = function() {
        function Event(component, options) {
          if (!(component instanceof ICAL.Component)) {
            options = component;
            component = null;
          }
          if (component) {
            this.component = component;
          } else {
            this.component = new ICAL.Component("vevent");
          }
          this._rangeExceptionCache = Object.create(null);
          this.exceptions = Object.create(null);
          this.rangeExceptions = [];
          if (options && options.strictExceptions) {
            this.strictExceptions = options.strictExceptions;
          }
          if (options && options.exceptions) {
            options.exceptions.forEach(this.relateException, this);
          } else if (this.component.parent && !this.isRecurrenceException()) {
            this.component.parent.getAllSubcomponents("vevent").forEach(function(event) {
              if (event.hasProperty("recurrence-id")) {
                this.relateException(event);
              }
            }, this);
          }
        }
        Event.prototype = {
          THISANDFUTURE: "THISANDFUTURE",
          exceptions: null,
          strictExceptions: false,
          relateException: function(obj) {
            if (this.isRecurrenceException()) {
              throw new Error("cannot relate exception to exceptions");
            }
            if (obj instanceof ICAL.Component) {
              obj = new ICAL.Event(obj);
            }
            if (this.strictExceptions && obj.uid !== this.uid) {
              throw new Error("attempted to relate unrelated exception");
            }
            var id = obj.recurrenceId.toString();
            this.exceptions[id] = obj;
            if (obj.modifiesFuture()) {
              var item = [
                obj.recurrenceId.toUnixTime(),
                id
              ];
              var idx = ICAL.helpers.binsearchInsert(this.rangeExceptions, item, compareRangeException);
              this.rangeExceptions.splice(idx, 0, item);
            }
          },
          modifiesFuture: function() {
            if (!this.component.hasProperty("recurrence-id")) {
              return false;
            }
            var range = this.component.getFirstProperty("recurrence-id").getParameter("range");
            return range === this.THISANDFUTURE;
          },
          findRangeException: function(time) {
            if (!this.rangeExceptions.length) {
              return null;
            }
            var utc = time.toUnixTime();
            var idx = ICAL.helpers.binsearchInsert(this.rangeExceptions, [utc], compareRangeException);
            idx -= 1;
            if (idx < 0) {
              return null;
            }
            var rangeItem = this.rangeExceptions[idx];
            if (utc < rangeItem[0]) {
              return null;
            }
            return rangeItem[1];
          },
          getOccurrenceDetails: function(occurrence) {
            var id = occurrence.toString();
            var utcId = occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString();
            var item;
            var result = {
              recurrenceId: occurrence
            };
            if (id in this.exceptions) {
              item = result.item = this.exceptions[id];
              result.startDate = item.startDate;
              result.endDate = item.endDate;
              result.item = item;
            } else if (utcId in this.exceptions) {
              item = this.exceptions[utcId];
              result.startDate = item.startDate;
              result.endDate = item.endDate;
              result.item = item;
            } else {
              var rangeExceptionId = this.findRangeException(occurrence);
              var end;
              if (rangeExceptionId) {
                var exception = this.exceptions[rangeExceptionId];
                result.item = exception;
                var startDiff = this._rangeExceptionCache[rangeExceptionId];
                if (!startDiff) {
                  var original = exception.recurrenceId.clone();
                  var newStart = exception.startDate.clone();
                  original.zone = newStart.zone;
                  startDiff = newStart.subtractDate(original);
                  this._rangeExceptionCache[rangeExceptionId] = startDiff;
                }
                var start = occurrence.clone();
                start.zone = exception.startDate.zone;
                start.addDuration(startDiff);
                end = start.clone();
                end.addDuration(exception.duration);
                result.startDate = start;
                result.endDate = end;
              } else {
                end = occurrence.clone();
                end.addDuration(this.duration);
                result.endDate = end;
                result.startDate = occurrence;
                result.item = this;
              }
            }
            return result;
          },
          iterator: function(startTime) {
            return new ICAL.RecurExpansion({
              component: this.component,
              dtstart: startTime || this.startDate
            });
          },
          isRecurring: function() {
            var comp = this.component;
            return comp.hasProperty("rrule") || comp.hasProperty("rdate");
          },
          isRecurrenceException: function() {
            return this.component.hasProperty("recurrence-id");
          },
          getRecurrenceTypes: function() {
            var rules = this.component.getAllProperties("rrule");
            var i = 0;
            var len = rules.length;
            var result = Object.create(null);
            for (; i < len; i++) {
              var value = rules[i].getFirstValue();
              result[value.freq] = true;
            }
            return result;
          },
          get uid() {
            return this._firstProp("uid");
          },
          set uid(value) {
            this._setProp("uid", value);
          },
          get startDate() {
            return this._firstProp("dtstart");
          },
          set startDate(value) {
            this._setTime("dtstart", value);
          },
          get endDate() {
            var endDate = this._firstProp("dtend");
            if (!endDate) {
              var duration = this._firstProp("duration");
              endDate = this.startDate.clone();
              if (duration) {
                endDate.addDuration(duration);
              } else if (endDate.isDate) {
                endDate.day += 1;
              }
            }
            return endDate;
          },
          set endDate(value) {
            if (this.component.hasProperty("duration")) {
              this.component.removeProperty("duration");
            }
            this._setTime("dtend", value);
          },
          get duration() {
            var duration = this._firstProp("duration");
            if (!duration) {
              return this.endDate.subtractDateTz(this.startDate);
            }
            return duration;
          },
          set duration(value) {
            if (this.component.hasProperty("dtend")) {
              this.component.removeProperty("dtend");
            }
            this._setProp("duration", value);
          },
          get location() {
            return this._firstProp("location");
          },
          set location(value) {
            return this._setProp("location", value);
          },
          get attendees() {
            return this.component.getAllProperties("attendee");
          },
          get summary() {
            return this._firstProp("summary");
          },
          set summary(value) {
            this._setProp("summary", value);
          },
          get description() {
            return this._firstProp("description");
          },
          set description(value) {
            this._setProp("description", value);
          },
          get organizer() {
            return this._firstProp("organizer");
          },
          set organizer(value) {
            this._setProp("organizer", value);
          },
          get sequence() {
            return this._firstProp("sequence");
          },
          set sequence(value) {
            this._setProp("sequence", value);
          },
          get recurrenceId() {
            return this._firstProp("recurrence-id");
          },
          set recurrenceId(value) {
            this._setTime("recurrence-id", value);
          },
          _setTime: function(propName, time) {
            var prop = this.component.getFirstProperty(propName);
            if (!prop) {
              prop = new ICAL.Property(propName);
              this.component.addProperty(prop);
            }
            if (time.zone === ICAL.Timezone.localTimezone || time.zone === ICAL.Timezone.utcTimezone) {
              prop.removeParameter("tzid");
            } else {
              prop.setParameter("tzid", time.zone.tzid);
            }
            prop.setValue(time);
          },
          _setProp: function(name, value) {
            this.component.updatePropertyWithValue(name, value);
          },
          _firstProp: function(name) {
            return this.component.getFirstPropertyValue(name);
          },
          toString: function() {
            return this.component.toString();
          }
        };
        function compareRangeException(a, b) {
          if (a[0] > b[0])
            return 1;
          if (b[0] > a[0])
            return -1;
          return 0;
        }
        return Event;
      }();
      ICAL.ComponentParser = function() {
        function ComponentParser(options) {
          if (typeof options === "undefined") {
            options = {};
          }
          var key;
          for (key in options) {
            if (options.hasOwnProperty(key)) {
              this[key] = options[key];
            }
          }
        }
        ComponentParser.prototype = {
          parseEvent: true,
          parseTimezone: true,
          oncomplete: function() {
          },
          onerror: function(err) {
          },
          ontimezone: function(component) {
          },
          onevent: function(component) {
          },
          process: function(ical) {
            if (typeof ical === "string") {
              ical = ICAL.parse(ical);
            }
            if (!(ical instanceof ICAL.Component)) {
              ical = new ICAL.Component(ical);
            }
            var components = ical.getAllSubcomponents();
            var i = 0;
            var len = components.length;
            var component;
            for (; i < len; i++) {
              component = components[i];
              switch (component.name) {
                case "vtimezone":
                  if (this.parseTimezone) {
                    var tzid = component.getFirstPropertyValue("tzid");
                    if (tzid) {
                      this.ontimezone(new ICAL.Timezone({
                        tzid,
                        component
                      }));
                    }
                  }
                  break;
                case "vevent":
                  if (this.parseEvent) {
                    this.onevent(new ICAL.Event(component));
                  }
                  break;
                default:
                  continue;
              }
            }
            this.oncomplete();
          }
        };
        return ComponentParser;
      }();
    }
  });

  // src/backend/accounts/ical/validator.js
  var validator_exports4 = {};
  __export(validator_exports4, {
    default: () => validateICal
  });
  async function validateICal({
    userDetails,
    credentials,
    connInfoFields
  }) {
    const calendarUrl = connInfoFields.calendarUrl;
    try {
      const icalReq = new Request(calendarUrl, {});
      const icalResp = await fetch(icalReq);
      if (icalResp.status >= 400) {
        return {
          error: "unknown",
          errorDetails: {
            status: icalResp.status,
            calendarUrl
          }
        };
      }
      const icalText = await icalResp.text();
      const parsed = import_ical.default.parse(icalText);
      const root = new import_ical.default.Component(parsed);
      const calName = root.getFirstPropertyValue("x-wr-calname") || "Unnamed Calendar";
      userDetails.displayName = calName;
      userDetails.emailAddress = calName;
    } catch (ex) {
      return {
        error: "unknown",
        errorDetails: {
          message: ex.toString()
        }
      };
    }
    return {
      engineFields: {
        engine: "ical",
        engineData: {},
        receiveProtoConn: null
      }
    };
  }
  var import_ical;
  var init_validator4 = __esm({
    "src/backend/accounts/ical/validator.js"() {
      import_ical = __toModule(require_ical());
    }
  });

  // src/backend/accounts/feed/account.js
  var account_exports = {};
  __export(account_exports, {
    default: () => FeedAccount
  });
  var FeedAccount;
  var init_account = __esm({
    "src/backend/accounts/feed/account.js"() {
      FeedAccount = class {
        constructor(universe2, accountDef, foldersTOC, dbConn) {
          this.universe = universe2;
          this.id = accountDef.id;
          this.accountDef = accountDef;
          this._db = dbConn;
          this.enabled = true;
          this.problems = [];
          this.identities = accountDef.identities;
          this.foldersTOC = foldersTOC;
          this.folders = this.foldersTOC.items;
          this.feedUrl = accountDef.feedUrl;
          this.feedType = accountDef.feedType;
        }
        toString() {
          return `[FeedAccount: ${this.id}]`;
        }
        __acquire() {
          return Promise.resolve(this);
        }
        __release() {
        }
        async checkAccount() {
          return null;
        }
        shutdown() {
        }
      };
      FeedAccount.type = "Feed";
      FeedAccount.supportsServerFolders = false;
    }
  });

  // src/backend/accounts/gapi/account.js
  var account_exports2 = {};
  __export(account_exports2, {
    default: () => GapiAccount
  });
  var GapiAccount;
  var init_account2 = __esm({
    "src/backend/accounts/gapi/account.js"() {
      init_api_client();
      GapiAccount = class {
        constructor(universe2, accountDef, foldersTOC, dbConn) {
          this.universe = universe2;
          this.id = accountDef.id;
          this.accountDef = accountDef;
          this._db = dbConn;
          this.enabled = true;
          this.problems = [];
          this.identities = accountDef.identities;
          this.foldersTOC = foldersTOC;
          this.folders = this.foldersTOC.items;
          this.client = new ApiClient(accountDef.credentials, this.id);
        }
        toString() {
          return `[GapiAccount: ${this.id}]`;
        }
        __acquire() {
          return Promise.resolve(this);
        }
        __release() {
        }
        async checkAccount() {
          return null;
        }
        shutdown() {
        }
      };
      GapiAccount.type = "gapi";
      GapiAccount.supportsServerFolders = false;
    }
  });

  // src/backend/accounts/mapi/account.js
  var account_exports3 = {};
  __export(account_exports3, {
    default: () => MapiAccount
  });
  var MapiAccount;
  var init_account3 = __esm({
    "src/backend/accounts/mapi/account.js"() {
      init_api_client();
      MapiAccount = class {
        constructor(universe2, accountDef, foldersTOC, dbConn) {
          this.universe = universe2;
          this.id = accountDef.id;
          this.accountDef = accountDef;
          this._db = dbConn;
          this.enabled = true;
          this.problems = [];
          this.identities = accountDef.identities;
          this.foldersTOC = foldersTOC;
          this.folders = this.foldersTOC.items;
          this.client = new ApiClient(accountDef.credentials, this.id);
        }
        toString() {
          return `[MapiAccount: ${this.id}]`;
        }
        __acquire() {
          return Promise.resolve(this);
        }
        __release() {
        }
        async checkAccount() {
          return null;
        }
        shutdown() {
        }
      };
      MapiAccount.type = "mapi";
      MapiAccount.supportsServerFolders = false;
    }
  });

  // src/backend/accounts/ical/account.js
  var account_exports4 = {};
  __export(account_exports4, {
    default: () => ICalAccount
  });
  var ICalAccount;
  var init_account4 = __esm({
    "src/backend/accounts/ical/account.js"() {
      ICalAccount = class {
        constructor(universe2, accountDef, foldersTOC, dbConn) {
          this.universe = universe2;
          this.id = accountDef.id;
          this.accountDef = accountDef;
          this._db = dbConn;
          this.enabled = true;
          this.problems = [];
          this.identities = accountDef.identities;
          this.foldersTOC = foldersTOC;
          this.folders = this.foldersTOC.items;
          this.calendarUrl = accountDef.calendarUrl;
        }
        toString() {
          return `[ICalAccount: ${this.id}]`;
        }
        __acquire() {
          return Promise.resolve(this);
        }
        __release() {
        }
        async checkAccount() {
          return null;
        }
        shutdown() {
        }
      };
      ICalAccount.type = "ical";
      ICalAccount.supportsServerFolders = false;
    }
  });

  // src/shared/util.js
  function bsearchForInsert(list, seekVal, cmpfunc) {
    if (!list.length) {
      return 0;
    }
    var low = 0, high = list.length - 1, mid, cmpval;
    while (low <= high) {
      mid = low + Math.floor((high - low) / 2);
      cmpval = cmpfunc(seekVal, list[mid]);
      if (cmpval < 0) {
        high = mid - 1;
      } else if (cmpval > 0) {
        low = mid + 1;
      } else {
        break;
      }
    }
    if (cmpval < 0) {
      return mid;
    } else if (cmpval > 0) {
      return mid + 1;
    }
    return mid;
  }
  function bsearchMaybeExists(list, seekVal, cmpfunc, aLow, aHigh) {
    var low = aLow === void 0 ? 0 : aLow, high = aHigh === void 0 ? list.length - 1 : aHigh, mid, cmpval;
    while (low <= high) {
      mid = low + Math.floor((high - low) / 2);
      cmpval = cmpfunc(seekVal, list[mid]);
      if (cmpval < 0) {
        high = mid - 1;
      } else if (cmpval > 0) {
        low = mid + 1;
      } else {
        return mid;
      }
    }
    return null;
  }
  function formatAddresses(nameAddrPairs) {
    var addrstrings = [];
    for (var i = 0; i < nameAddrPairs.length; i++) {
      var pair = nameAddrPairs[i];
      if (typeof pair === "string") {
        addrstrings.push(pair);
      } else if (!pair.name) {
        addrstrings.push(pair.address);
      } else {
        addrstrings.push('"' + pair.name.replace(/["']/g, "") + '" <' + pair.address + ">");
      }
    }
    return addrstrings.join(", ");
  }
  function shallowClone2(sourceObj) {
    var destObj = {};
    for (var key in sourceObj) {
      destObj[key] = sourceObj[key];
    }
    return destObj;
  }
  var import_evt4;
  var init_util = __esm({
    "src/shared/util.js"() {
      import_evt4 = __toModule(require_evt());
    }
  });

  // src/backend/task_infra/task_bases/at_most_once.js
  var makeWrappedOverlayFunc, makeWrappedPrefixOverlayFunc, at_most_once_default;
  var init_at_most_once = __esm({
    "src/backend/task_infra/task_bases/at_most_once.js"() {
      init_logic();
      makeWrappedOverlayFunc = function(helpedOverlayFunc) {
        return function(persistentState, memoryState, blockedTaskChecker, id) {
          return helpedOverlayFunc.call(this, id, persistentState.binToMarker.get(id), memoryState.inProgressBins.has(id) || memoryState.remainInProgressBins.has(id), blockedTaskChecker(this.name + ":" + id));
        };
      };
      makeWrappedPrefixOverlayFunc = function([extractor, helpedOverlayFunc]) {
        return function(persistentState, memoryState, blockedTaskChecker, fullId) {
          let binId = extractor(fullId);
          return helpedOverlayFunc.call(this, fullId, binId, persistentState.binToMarker.get(binId), memoryState.inProgressBins.has(binId) || memoryState.remainInProgressBins.has(binId), blockedTaskChecker(this.name + ":" + binId));
        };
      };
      at_most_once_default = {
        isSimple: false,
        isComplex: true,
        __preMix(mixedSource) {
          for (let key of Object.keys(mixedSource)) {
            let overlayMatch = /^helped_overlay_(.+)$/.exec(key);
            if (overlayMatch) {
              let overlayType = overlayMatch[1];
              this["overlay_" + overlayType] = makeWrappedOverlayFunc(mixedSource[key]);
            }
            let prefixedOverlayMatch = /^helped_prefix_overlay_(.+)$/.exec(key);
            if (prefixedOverlayMatch) {
              let overlayType = prefixedOverlayMatch[1];
              this["overlay_" + overlayType] = makeWrappedPrefixOverlayFunc(mixedSource[key]);
            }
          }
        },
        initPersistentState() {
          return {
            binToMarker: new Map()
          };
        },
        deriveMemoryStateFromPersistentState(persistentState, accountId) {
          return {
            memoryState: {
              accountId,
              inProgressBins: new Set(),
              remainInProgressBins: new Set()
            },
            markers: persistentState.binToMarker.values()
          };
        },
        async plan(ctx, persistentState, memoryState, req) {
          let binId = this.binByArg ? req[this.binByArg] : "only";
          if (persistentState.binToMarker.has(binId)) {
            let rval2;
            if (this.helped_already_planned) {
              logic(ctx, "alreadyPlanned");
              rval2 = await this.helped_already_planned(ctx, req);
            } else {
              rval2 = {};
            }
            await ctx.finishTask(rval2);
            return ctx.returnValue(rval2.result);
          }
          let rval = await this.helped_plan(ctx, req);
          if (rval.taskState) {
            let marker = Object.assign({}, rval.taskState, {
              type: this.name,
              id: this.name + ":" + binId,
              accountId: memoryState.accountId
            });
            rval.taskMarkers = new Map([[marker.id, marker]]);
            persistentState.binToMarker.set(binId, marker);
            rval.complexTaskState = persistentState;
            rval.taskState = null;
          }
          if (rval.remainInProgressUntil && this.helped_invalidate_overlays) {
            memoryState.remainInProgressBins.add(binId);
            let dataOverlayManager = ctx.universe.dataOverlayManager;
            rval.remainInProgressUntil.then(() => {
              memoryState.remainInProgressBins.delete(binId);
              this.helped_invalidate_overlays(binId, dataOverlayManager);
            });
          }
          if (this.helped_invalidate_overlays) {
            this.helped_invalidate_overlays(binId, ctx.universe.dataOverlayManager);
          }
          if (rval.announceUpdatedOverlayData) {
            for (let [namespace, id] of rval.announceUpdatedOverlayData) {
              ctx.announceUpdatedOverlayData(namespace, id);
            }
          }
          await ctx.finishTask(rval);
          return ctx.returnValue(rval.result);
        },
        async execute(ctx, persistentState, memoryState, marker) {
          let binId = this.binByArg ? marker[this.binByArg] : "only";
          memoryState.inProgressBins.add(binId);
          if (this.helped_invalidate_overlays) {
            this.helped_invalidate_overlays(binId, ctx.universe.dataOverlayManager);
          }
          let rval = await this.helped_execute(ctx, marker);
          memoryState.inProgressBins.delete(binId);
          persistentState.binToMarker.delete(binId);
          rval.complexTaskState = persistentState;
          if (this.helped_invalidate_overlays) {
            this.helped_invalidate_overlays(binId, ctx.universe.dataOverlayManager);
          }
          if (rval.announceUpdatedOverlayData) {
            for (let [namespace, id] of rval.announceUpdatedOverlayData) {
              ctx.announceUpdatedOverlayData(namespace, id);
            }
          }
          await ctx.finishTask(rval);
          return ctx.returnValue(rval.result);
        }
      };
    }
  });

  // src/backend/task_infra/task_definer.js
  function mixInvokingBaseHooks(baseImpl, mixparts) {
    if (!baseImpl.__preMix && !baseImpl.__postMix) {
      return Object.assign({}, baseImpl, ...mixparts);
    }
    let target = Object.assign({}, baseImpl);
    let coalescedParts = Object.assign({}, ...mixparts);
    if (target.__preMix) {
      target.__preMix(coalescedParts);
    }
    Object.assign(target, coalescedParts);
    if (target.__postMix) {
      target.__postMix();
    }
    return target;
  }
  function TaskDefiner() {
  }
  var SimpleTaskBase, ComplexTaskBase, task_definer_default;
  var init_task_definer = __esm({
    "src/backend/task_infra/task_definer.js"() {
      init_util();
      init_at_most_once();
      SimpleTaskBase = {
        isSimple: true,
        isComplex: false,
        async plan(ctx, rawTask) {
          let decoratedTask = shallowClone2(rawTask);
          if (this.exclusiveResources) {
            decoratedTask.exclusiveResources = this.exclusiveResources(rawTask);
          }
          if (this.priorityTags) {
            decoratedTask.priorityTags = this.priorityTags(rawTask);
          }
          await ctx.finishTask({
            taskState: decoratedTask
          });
        },
        execute: null
      };
      ComplexTaskBase = {
        isSimple: false,
        isComplex: true
      };
      TaskDefiner.prototype = {
        defineSimpleTask(mixparts) {
          return mixInvokingBaseHooks(SimpleTaskBase, mixparts);
        },
        defineAtMostOnceTask(mixparts) {
          return mixInvokingBaseHooks(at_most_once_default, mixparts);
        },
        defineComplexTask(mixparts) {
          return mixInvokingBaseHooks(ComplexTaskBase, mixparts);
        }
      };
      task_definer_default = new TaskDefiner();
    }
  });

  // src/backend/db/folder_info_rep.js
  function makeFolderMeta(raw) {
    return {
      id: raw.id || null,
      serverId: raw.serverId || null,
      name: raw.name || null,
      description: raw.description || null,
      type: raw.type || null,
      path: raw.path || null,
      serverPath: raw.serverPath || null,
      parentId: raw.parentId || null,
      delim: raw.delim || null,
      depth: raw.depth || 0,
      syncGranularity: raw.syncGranularity || null,
      calendarInfo: raw.calendarInfo || null,
      localMessageCount: 0,
      estimatedUnsyncedMessages: null,
      syncedThrough: null,
      lastSuccessfulSyncAt: raw.lastSuccessfulSyncAt || 0,
      lastAttemptedSyncAt: raw.lastAttemptedSyncAt || 0,
      lastFailedSyncAt: raw.lastFailedSyncAt || 0,
      failedSyncsSinceLastSuccessfulSync: raw.failedSyncsSinceLastSuccessfulSync || 0,
      localUnreadConversations: raw.localUnreadConversations || 0
    };
  }
  var init_folder_info_rep = __esm({
    "src/backend/db/folder_info_rep.js"() {
    }
  });

  // src/backend/task_mixins/mix_sync_folder_list.js
  var MixinSyncFolderList, mix_sync_folder_list_default;
  var init_mix_sync_folder_list = __esm({
    "src/backend/task_mixins/mix_sync_folder_list.js"() {
      init_folder_info_rep();
      init_util();
      MixinSyncFolderList = {
        name: "sync_folder_list",
        args: ["accountId"],
        essentialOfflineFolders: [
          {
            type: "inbox",
            displayName: "Inbox",
            path: "INBOX",
            serverPath: "INBOX"
          },
          {
            type: "outbox",
            displayName: "outbox"
          },
          {
            type: "localdrafts",
            displayName: "localdrafts"
          }
        ],
        ensureEssentialOfflineFolders(ctx, account) {
          let foldersTOC = account.foldersTOC;
          let newFolders = [];
          for (let desired of this.essentialOfflineFolders) {
            if (foldersTOC.getCanonicalFolderByType(desired.type) === null) {
              newFolders.push(makeFolderMeta({
                id: foldersTOC.issueFolderId(),
                serverId: null,
                name: desired.displayName,
                type: desired.type,
                path: desired.path || desired.displayName,
                serverPath: desired.serverPath || null,
                parentId: null,
                depth: 0,
                lastSyncedAt: 0
              }));
            }
          }
          return Promise.resolve({
            newFolders
          });
        },
        async plan(ctx, rawTask) {
          let decoratedTask = shallowClone2(rawTask);
          decoratedTask.exclusiveResources = [
            `folderInfo:${rawTask.accountId}`
          ];
          decoratedTask.priorityTags = ["view:folders"];
          let account = await ctx.universe.acquireAccount(ctx, rawTask.accountId);
          let {
            newFolders,
            modifiedFolders
          } = await this.ensureEssentialOfflineFolders(ctx, account);
          await ctx.finishTask({
            mutations: {
              folders: modifiedFolders
            },
            newData: {
              folders: newFolders
            },
            taskState: this.execute ? decoratedTask : null
          });
        },
        async execute(ctx, planned) {
          let account = await ctx.universe.acquireAccount(ctx, planned.accountId);
          let {
            modifiedFolders,
            newFolders,
            newTasks,
            modifiedSyncStates
          } = await this.syncFolders(ctx, account);
          await ctx.finishTask({
            mutations: {
              folders: modifiedFolders,
              syncStates: modifiedSyncStates
            },
            newData: {
              folders: newFolders,
              tasks: newTasks
            },
            taskState: null
          });
        }
      };
      mix_sync_folder_list_default = MixinSyncFolderList;
    }
  });

  // src/backend/accounts/feed/tasks/sync_folder_list.js
  var sync_folder_list_default;
  var init_sync_folder_list = __esm({
    "src/backend/accounts/feed/tasks/sync_folder_list.js"() {
      init_task_definer();
      init_mix_sync_folder_list();
      sync_folder_list_default = task_definer_default.defineSimpleTask([
        mix_sync_folder_list_default,
        {
          essentialOfflineFolders: [
            {
              type: "inbox",
              displayName: "Feed"
            }
          ],
          async syncFolders() {
            return {
              newFolders: void 0,
              newTasks: void 0,
              modifiedFolders: void 0,
              modifiedSyncStates: void 0
            };
          }
        }
      ]);
    }
  });

  // src/backend/date_priority_adjuster.js
  function prioritizeNewer(dateTS) {
    return Math.max(-MAX_PRIORITY_BOOST, MAX_PRIORITY_BOOST - (NOW() - dateTS) / ONE_HOUR_IN_MSECS);
  }
  var MAX_PRIORITY_BOOST, ONE_HOUR_IN_MSECS;
  var init_date_priority_adjuster = __esm({
    "src/backend/date_priority_adjuster.js"() {
      init_date();
      MAX_PRIORITY_BOOST = 99999;
      ONE_HOUR_IN_MSECS = 60 * 60 * 1e3;
    }
  });

  // src/backend/db/comparators.js
  function folderConversationComparator(a, b) {
    let dateDelta = b.date - a.date;
    if (dateDelta) {
      return dateDelta;
    }
    let aId = a.id;
    let bId = b.id;
    if (bId > aId) {
      return 1;
    } else if (aId > bId) {
      return -1;
    }
    return 0;
  }
  function conversationMessageComparator(a, b) {
    let dateDelta = b.date - a.date;
    if (dateDelta) {
      return dateDelta;
    }
    let aId = a.id;
    let bId = b.id;
    if (bId > aId) {
      return 1;
    } else if (aId > bId) {
      return -1;
    }
    return 0;
  }
  function oldToNewConversationMessageComparator(a, b) {
    let dateDelta = a.date - b.date;
    if (dateDelta) {
      return dateDelta;
    }
    let aId = a.id;
    let bId = b.id;
    if (bId > aId) {
      return 1;
    } else if (aId > bId) {
      return -1;
    }
    return 0;
  }
  var init_comparators = __esm({
    "src/backend/db/comparators.js"() {
    }
  });

  // src/app_logic/conv_churn.js
  function churnConversation(convInfo, messages, oldConvInfo, convType, convMeta) {
    messages = messages.concat();
    messages.sort(oldToNewConversationMessageComparator);
    let tidbits = convInfo.app.tidbits = [];
    let midToIndex = new Map();
    let findClosestAncestor = (references) => {
      if (!references) {
        return 0;
      }
      for (let i = references.length; i >= 0; i--) {
        let ref = references[i];
        if (midToIndex.has(ref)) {
          return midToIndex.get(ref);
        }
      }
      return 0;
    };
    for (let message of messages) {
      let isRead = message.flags.includes("\\Seen");
      let isStarred = message.flags.includes("\\Flagged");
      tidbits.push({
        id: message.id,
        date: message.date,
        isRead,
        isStarred,
        author: message.author,
        parent: findClosestAncestor(message.references)
      });
      midToIndex.set(message.guid, tidbits.length - 1);
    }
    if (tidbits.length === 1) {
      convInfo.height = 1;
    } else {
      convInfo.height = 2;
    }
    if (convType === "phab-drev") {
      convInfo.app.drevInfo = convMeta.drevInfo;
      const patchInfo = convInfo.app.patchInfo = convMeta.patchInfo;
      for (const folderId of patchInfo.virtFolderIds) {
        convInfo.folderIds.add(folderId);
      }
    }
  }
  var init_conv_churn = __esm({
    "src/app_logic/conv_churn.js"() {
      init_comparators();
    }
  });

  // src/backend/churn_drivers/conv_churn_driver.js
  function churnConversationDriver(convId, oldConvInfo, messages, convType = "mail", convMeta) {
    let userCanonicalField = "address";
    let authorField = "author";
    if (convType === "phab-drev") {
      userCanonicalField = "nick";
    } else if (convType === "event") {
      authorField = "organizer";
      userCanonicalField = "email";
    }
    let authorsById = new Map();
    let snippetCount = 0;
    let tidbits = [];
    let convHasUnread = false;
    let convHasStarred = false;
    let convHasDrafts = false;
    let convHasAttachments = false;
    let convFolderIds = new Set();
    let effectiveDate = 0;
    let fallbackDate = 0;
    for (let message of messages) {
      let isRead = message.flags.includes("\\Seen");
      let isStarred = message.flags.includes("\\Flagged");
      let isDraft = message.draftInfo !== null;
      fallbackDate = Math.max(fallbackDate, message.date);
      if (isDraft) {
        convHasDrafts = true;
      } else {
        effectiveDate = Math.max(effectiveDate, message.date);
      }
      if (!isRead) {
        convHasUnread = true;
      }
      if (isStarred) {
        convHasStarred = true;
      }
      if (message.hasAttachments) {
        convHasAttachments = true;
      }
      const authorInfo = message[authorField];
      if (authorInfo && !authorsById.has(authorInfo[userCanonicalField])) {
        authorsById.set(authorInfo[userCanonicalField], authorInfo);
      }
      for (let folderId of message.folderIds) {
        convFolderIds.add(folderId);
      }
      if (message.snippet !== null) {
        snippetCount++;
      }
    }
    if (!effectiveDate) {
      effectiveDate = fallbackDate;
    }
    let convInfo = {
      id: convId,
      convType,
      date: effectiveDate,
      folderIds: convFolderIds,
      height: 1,
      subject: messages[0].subject,
      messageCount: messages.length,
      snippetCount,
      authors: Array.from(authorsById.values()),
      tidbits,
      hasUnread: convHasUnread,
      hasStarred: convHasStarred,
      hasDrafts: convHasDrafts,
      hasAttachments: convHasAttachments,
      app: {}
    };
    try {
      churnConversation(convInfo, messages, oldConvInfo, convType, convMeta);
    } catch (ex) {
      logic(scope2, "appChurnEx", { ex });
    }
    return convInfo;
  }
  var scope2;
  var init_conv_churn_driver = __esm({
    "src/backend/churn_drivers/conv_churn_driver.js"() {
      init_logic();
      init_conv_churn();
      scope2 = {};
      logic.defineScope(scope2, "churnConversationDriver");
    }
  });

  // src/backend/db/mail_rep.js
  function makeMessageInfo(raw) {
    if (!raw.author) {
      throw new Error("No author?!");
    }
    if (!raw.date) {
      throw new Error("No date?!");
    }
    if (!raw.attachments || !raw.bodyReps) {
      throw new Error("No attachments / bodyReps?!");
    }
    if (Array.isArray(raw.folderIds)) {
      throw new Error("raw.folderIds must be a Set, not an Array");
    }
    return {
      id: raw.id,
      type: "msg",
      umid: raw.umid || null,
      guid: raw.guid || null,
      date: raw.date,
      dateModified: raw.dateModified || raw.date,
      author: raw.author,
      to: raw.to || null,
      cc: raw.cc || null,
      bcc: raw.bcc || null,
      replyTo: raw.replyTo || null,
      flags: raw.flags || [],
      folderIds: raw.folderIds || new Set(),
      hasAttachments: raw.hasAttachments || false,
      subject: raw.subject != null ? raw.subject : null,
      snippet: raw.snippet != null ? raw.snippet : null,
      attachments: raw.attachments,
      relatedParts: raw.relatedParts || null,
      references: raw.references || null,
      bodyReps: raw.bodyReps,
      authoredBodySize: raw.authoredBodySize || 0,
      draftInfo: raw.draftInfo || null
    };
  }
  function makeDraftInfo(raw) {
    return {
      draftType: raw.draftType,
      mode: raw.mode || null,
      refMessageId: raw.refMessageId || null,
      refMessageDate: raw.refMessageDate || null,
      sendProblems: raw.sendProblems || null
    };
  }
  function makeBodyPart(raw) {
    if (raw.type !== "plain" && raw.type !== "html" && raw.type !== "attr") {
      throw new Error("Bad body type: " + raw.type);
    }
    if (raw.sizeEstimate === void 0) {
      throw new Error("Need size estimate!");
    }
    return {
      type: raw.type,
      part: raw.part || null,
      sizeEstimate: raw.sizeEstimate,
      amountDownloaded: raw.amountDownloaded || 0,
      isDownloaded: raw.isDownloaded || false,
      _partInfo: raw._partInfo || null,
      contentBlob: raw.contentBlob || null,
      authoredBodySize: raw.authoredBodySize || 0
    };
  }
  var init_mail_rep = __esm({
    "src/backend/db/mail_rep.js"() {
    }
  });

  // src/backend/bodies/quotechew.js
  function indexOfDefault(string, search, startIndex, defVal) {
    var idx = string.indexOf(search, startIndex);
    if (idx === -1) {
      return defVal;
    }
    return idx;
  }
  function countNewlinesInRegion(string, startIndex, endIndex) {
    var idx = startIndex - 1, count = 0;
    for (; ; ) {
      idx = string.indexOf(NEWLINE, idx + 1);
      if (idx === -1 || idx >= endIndex) {
        return count;
      }
      count++;
    }
  }
  function quoteProcessTextBody(fullBodyText) {
    var contentRep = [];
    var line;
    function countQuoteDepthAndNormalize() {
      var count = 1;
      var lastStartOffset = 1, spaceOk = true;
      for (var i = 1; i < line.length; i++) {
        var c = line.charCodeAt(i);
        if (c === CHARCODE_GT) {
          count++;
          lastStartOffset++;
          spaceOk = true;
        } else if (c === CHARCODE_SPACE) {
          if (!spaceOk) {
            break;
          }
          lastStartOffset++;
          spaceOk = false;
        } else {
          break;
        }
      }
      if (lastStartOffset) {
        line = line.substring(lastStartOffset);
      }
      return count;
    }
    function lookBackwardsForBoilerplate(chunk) {
      var idxLineStart2, idxLineEnd2, chunkLine, idxRegionEnd = chunk.length, scanLinesLeft = MAX_BOILERPLATE_LINES, sawNonWhitespaceLine = false, lastContentLine = null, lastBoilerplateStart = null, sawProduct = false, insertAt = contentRep.length;
      function pushBoilerplate(contentType, merge) {
        var boilerChunk = chunk.substring(idxLineStart2, idxRegionEnd);
        var idxChunkEnd = idxLineStart2 - 1;
        while (chunk.charCodeAt(idxChunkEnd - 1) === CHARCODE_NEWLINE) {
          idxChunkEnd--;
        }
        var newChunk = chunk.substring(0, idxChunkEnd);
        var ate = countNewlinesInRegion(chunk, newChunk.length, idxLineStart2 - 1);
        chunk = newChunk;
        idxRegionEnd = chunk.length;
        if (!merge) {
          contentRep.splice(insertAt, 0, (ate & 255) << 8 | contentType, boilerChunk);
        } else {
          contentRep[insertAt] = (ate & 255) << 8 | contentRep[insertAt] & 255;
          contentRep[insertAt + 1] = boilerChunk + "\n" + contentRep[insertAt + 1];
        }
        sawNonWhitespaceLine = false;
        scanLinesLeft = MAX_BOILERPLATE_LINES;
        lastContentLine = null;
        lastBoilerplateStart = idxLineStart2;
      }
      for (idxLineStart2 = chunk.lastIndexOf("\n") + 1, idxLineEnd2 = chunk.length; idxLineEnd2 > 0 && scanLinesLeft; idxLineEnd2 = idxLineStart2 - 1, idxLineStart2 = chunk.lastIndexOf("\n", idxLineEnd2 - 1) + 1, scanLinesLeft--) {
        chunkLine = chunk.substring(idxLineStart2, idxLineEnd2);
        if (!chunkLine.length || chunkLine.length === 1 && chunkLine.charCodeAt(0) === CHARCODE_NBSP) {
          continue;
        }
        if (RE_SIGNATURE_LINE.test(chunkLine)) {
          if (idxLineEnd2 + 1 === lastBoilerplateStart) {
            pushBoilerplate(null, true);
          } else {
            pushBoilerplate(CT_SIGNATURE);
          }
          continue;
        }
        if (RE_SECTION_DELIM.test(chunkLine)) {
          if (lastContentLine) {
            if (RE_LEGAL_BOILER_START.test(lastContentLine)) {
              pushBoilerplate(CT_BOILERPLATE_DISCLAIMER);
              continue;
            }
            if (RE_LIST_BOILER.test(lastContentLine)) {
              pushBoilerplate(CT_BOILERPLATE_LIST_INFO);
              continue;
            }
          }
          return chunk;
        }
        if (!sawNonWhitespaceLine) {
          if (!sawProduct && RE_PRODUCT_BOILER.test(chunkLine)) {
            pushBoilerplate(CT_BOILERPLATE_PRODUCT);
            sawProduct = true;
            continue;
          }
          sawNonWhitespaceLine = true;
        }
        lastContentLine = chunkLine;
      }
      return chunk;
    }
    function pushContent(considerForBoilerplate, upToPoint2, forcePostLine) {
      if (idxRegionStart === null) {
        if (atePreLines) {
          if (contentRep.length) {
            atePreLines--;
          }
          contentRep.push((atePreLines & 255) << 8 | CT_AUTHORED_CONTENT);
          contentRep.push("");
        }
      } else {
        if (upToPoint2 === void 0) {
          upToPoint2 = idxLineStart;
        }
        var chunk = fullBodyText.substring(idxRegionStart, idxLastNonWhitespaceLineEnd);
        var atePostLines = forcePostLine ? 1 : 0;
        if (idxLastNonWhitespaceLineEnd + 1 !== upToPoint2) {
          atePostLines += countNewlinesInRegion(fullBodyText, idxLastNonWhitespaceLineEnd + 1, upToPoint2);
        }
        contentRep.push((atePreLines & 255) << 8 | (atePostLines & 255) << 16 | CT_AUTHORED_CONTENT);
        var iChunk = contentRep.push(chunk) - 1;
        if (considerForBoilerplate) {
          var newChunk = lookBackwardsForBoilerplate(chunk);
          if (chunk.length !== newChunk.length) {
            if (atePostLines) {
              var iLastMeta = contentRep.length - 2;
              contentRep[iLastMeta] = (atePostLines & 255) << 16 | contentRep[iLastMeta];
              contentRep[iChunk - 1] = (atePreLines & 255) << 8 | CT_AUTHORED_CONTENT;
            }
            if (!newChunk.length) {
              if (atePreLines) {
                var bpAte = contentRep[iChunk + 1] >> 8 & 255;
                bpAte += atePreLines;
                contentRep[iChunk + 1] = (bpAte & 255) << 8 | contentRep[iChunk + 1] & 4294902015;
              }
              contentRep.splice(iChunk - 1, 2);
            } else {
              contentRep[iChunk] = newChunk;
            }
          }
        }
      }
      atePreLines = 0;
      idxRegionStart = null;
      lastNonWhitespaceLine = null;
      idxLastNonWhitespaceLineEnd = null;
      idxPrevLastNonWhitespaceLineEnd = null;
    }
    function pushQuote(newQuoteDepth) {
      var atePostLines = 0;
      while (quoteRunLines.length && !quoteRunLines[quoteRunLines.length - 1]) {
        quoteRunLines.pop();
        atePostLines++;
      }
      contentRep.push((atePostLines & 255) << 24 | (ateQuoteLines & 255) << 16 | inQuoteDepth - 1 << 8 | CT_QUOTED_REPLY);
      contentRep.push(quoteRunLines.join("\n"));
      inQuoteDepth = newQuoteDepth;
      if (inQuoteDepth) {
        quoteRunLines = [];
      } else {
        quoteRunLines = null;
      }
      ateQuoteLines = 0;
      generatedQuoteBlock = true;
    }
    var idxLineStart, idxLineEnd, bodyLength = fullBodyText.length, idxRegionStart = null, lastNonWhitespaceLine = null, idxLastNonWhitespaceLineEnd = null, idxPrevLastNonWhitespaceLineEnd = null, inQuoteDepth = 0, quoteRunLines = null, generatedQuoteBlock = false, atePreLines = 0, ateQuoteLines = 0;
    for (idxLineStart = 0, idxLineEnd = indexOfDefault(fullBodyText, "\n", idxLineStart, fullBodyText.length); idxLineStart < bodyLength; idxLineStart = idxLineEnd + 1, idxLineEnd = indexOfDefault(fullBodyText, "\n", idxLineStart, fullBodyText.length)) {
      line = fullBodyText.substring(idxLineStart, idxLineEnd);
      if (!line.length || line.length === 1 && line.charCodeAt(0) === CHARCODE_NBSP) {
        if (inQuoteDepth) {
          pushQuote(0);
        }
        if (idxRegionStart === null) {
          atePreLines++;
        }
        continue;
      }
      if (line.charCodeAt(0) === CHARCODE_GT) {
        var lineDepth = countQuoteDepthAndNormalize();
        if (!inQuoteDepth) {
          if (lastNonWhitespaceLine && RE_WROTE_LINE.test(lastNonWhitespaceLine)) {
            var upToPoint = idxLastNonWhitespaceLineEnd;
            if (idxPrevLastNonWhitespaceLineEnd !== null) {
              var considerIndex = idxPrevLastNonWhitespaceLineEnd + 1;
              while (considerIndex < idxLastNonWhitespaceLineEnd) {
                if (fullBodyText[considerIndex++] === "\n") {
                  break;
                }
              }
              if (considerIndex === idxLastNonWhitespaceLineEnd) {
                upToPoint = fullBodyText.lastIndexOf("\n", idxPrevLastNonWhitespaceLineEnd - 1);
                lastNonWhitespaceLine = fullBodyText.substring(upToPoint + 1, idxLastNonWhitespaceLineEnd).replace(/\s*\n\s*/, " ");
                idxPrevLastNonWhitespaceLineEnd = upToPoint - 1;
                if (idxPrevLastNonWhitespaceLineEnd <= idxRegionStart) {
                  idxRegionStart = null;
                }
              }
            }
            idxLastNonWhitespaceLineEnd = idxPrevLastNonWhitespaceLineEnd;
            if (idxLastNonWhitespaceLineEnd === null) {
              idxRegionStart = null;
            }
            var leadin = lastNonWhitespaceLine;
            pushContent(!generatedQuoteBlock, upToPoint);
            var leadinNewlines = 0;
            if (upToPoint + 1 !== idxLineStart) {
              leadinNewlines = countNewlinesInRegion(fullBodyText, upToPoint + 1, idxLineStart);
            }
            contentRep.push(leadinNewlines << 8 | CT_LEADIN_TO_QUOTE);
            contentRep.push(leadin);
          } else {
            pushContent(!generatedQuoteBlock);
          }
          quoteRunLines = [];
          inQuoteDepth = lineDepth;
        } else if (lineDepth !== inQuoteDepth) {
          pushQuote(lineDepth);
        }
        if (quoteRunLines.length || line.length) {
          quoteRunLines.push(line);
        } else {
          ateQuoteLines++;
        }
      } else {
        if (inQuoteDepth) {
          pushQuote(0);
          idxLastNonWhitespaceLineEnd = null;
        }
        if (idxRegionStart === null) {
          idxRegionStart = idxLineStart;
        }
        lastNonWhitespaceLine = line;
        idxPrevLastNonWhitespaceLineEnd = idxLastNonWhitespaceLineEnd;
        idxLastNonWhitespaceLineEnd = idxLineEnd;
      }
    }
    if (inQuoteDepth) {
      pushQuote(0);
    } else {
      pushContent(true, fullBodyText.length, fullBodyText.charCodeAt(fullBodyText.length - 1) === CHARCODE_NEWLINE);
    }
    return contentRep;
  }
  function generateSnippet(rep, desiredLength) {
    for (var i = 0; i < rep.length; i += 2) {
      var etype = rep[i] & 15, block = rep[i + 1];
      switch (etype) {
        case CT_AUTHORED_CONTENT:
          if (!block.length) {
            break;
          }
          if (block.length < desiredLength) {
            return block.trim().replace(RE_NORMALIZE_WHITESPACE, " ");
          }
          var idxPrevSpace = block.lastIndexOf(" ", desiredLength);
          if (desiredLength - idxPrevSpace < MAX_WORD_SHRINK) {
            return block.substring(0, idxPrevSpace).trim().replace(RE_NORMALIZE_WHITESPACE, " ");
          }
          return block.substring(0, desiredLength).trim().replace(RE_NORMALIZE_WHITESPACE, " ");
        default:
          break;
      }
    }
    return "";
  }
  function expandQuotedPrefix(s, depth) {
    if (s.charCodeAt(0) === CHARCODE_NEWLINE) {
      return replyQuotePrefixStringsNoSpace[depth];
    }
    return replyQuotePrefixStrings[depth];
  }
  function expandQuoted(s, depth) {
    var ws = replyQuoteNewlineReplaceStrings[depth], nows = replyQuoteNewlineReplaceStringsNoSpace[depth];
    return s.replace(RE_NEWLINE, function(m, idx) {
      if (s.charCodeAt(idx + 1) === CHARCODE_NEWLINE) {
        return nows;
      }
      return ws;
    });
  }
  function generateReplyText(rep) {
    var strBits = [];
    var lastContentDepth = null;
    var suppressWhitespaceBlankLine = false;
    for (var i = 0; i < rep.length; i += 2) {
      var etype = rep[i] & 15, block = rep[i + 1];
      switch (etype) {
        default:
        case CT_AUTHORED_CONTENT:
        case CT_SIGNATURE:
        case CT_LEADIN_TO_QUOTE:
          if (block.length) {
            if (lastContentDepth !== null) {
              strBits.push(NEWLINE);
              if (!suppressWhitespaceBlankLine) {
                strBits.push(replyQuoteBlankLine[lastContentDepth]);
              }
            }
            strBits.push(expandQuotedPrefix(block, 0));
            strBits.push(expandQuoted(block, 0));
            lastContentDepth = 1;
            suppressWhitespaceBlankLine = etype === CT_LEADIN_TO_QUOTE;
          }
          break;
        case CT_QUOTED_TYPE:
          if (i) {
            strBits.push(NEWLINE);
          }
          var depth = (rep[i] >> 8 & 255) + 1;
          if (depth < MAX_QUOTE_REPEAT_DEPTH) {
            if (lastContentDepth !== null) {
              strBits.push(NEWLINE);
              if (!suppressWhitespaceBlankLine) {
                strBits.push(replyQuoteBlankLine[lastContentDepth]);
              }
            }
            strBits.push(expandQuotedPrefix(block, depth));
            strBits.push(expandQuoted(block, depth));
            lastContentDepth = depth;
            suppressWhitespaceBlankLine = RE_REPLY_LAST_LINE_IN_BLOCK_CONTAINS_WROTE.test(block);
          }
          break;
        case CT_BOILERPLATE_DISCLAIMER:
        case CT_BOILERPLATE_LIST_INFO:
        case CT_BOILERPLATE_PRODUCT:
        case CT_BOILERPLATE_ADS:
          break;
      }
    }
    return strBits.join("");
  }
  function generateForwardBodyText(rep) {
    var strBits = [], nl;
    for (var i = 0; i < rep.length; i += 2) {
      if (i) {
        strBits.push(NEWLINE);
      }
      var etype = rep[i] & 15, block = rep[i + 1];
      switch (etype) {
        default:
        case CT_AUTHORED_CONTENT:
          for (nl = rep[i] >> 8 & 255; nl; nl--) {
            strBits.push(NEWLINE);
          }
          strBits.push(block);
          for (nl = rep[i] >> 16 & 255; nl; nl--) {
            strBits.push(NEWLINE);
          }
          break;
        case CT_LEADIN_TO_QUOTE:
          strBits.push(block);
          for (nl = rep[i] >> 8 & 255; nl; nl--) {
            strBits.push(NEWLINE);
          }
          break;
        case CT_SIGNATURE:
        case CT_BOILERPLATE_DISCLAIMER:
        case CT_BOILERPLATE_LIST_INFO:
        case CT_BOILERPLATE_PRODUCT:
        case CT_BOILERPLATE_ADS:
          for (nl = rep[i] >> 8 & 255; nl; nl--) {
            strBits.push(NEWLINE);
          }
          strBits.push(block);
          for (nl = rep[i] >> 16 & 255; nl; nl--) {
            strBits.push(NEWLINE);
          }
          break;
        case CT_QUOTED_TYPE:
          var depth = Math.min(rep[i] >> 8 & 255, 8);
          for (nl = rep[i] >> 16 & 255; nl; nl--) {
            strBits.push(replyQuotePrefixStringsNoSpace[depth]);
            strBits.push(NEWLINE);
          }
          strBits.push(expandQuotedPrefix(block, depth));
          strBits.push(expandQuoted(block, depth));
          for (nl = rep[i] >> 24 & 255; nl; nl--) {
            strBits.push(NEWLINE);
            strBits.push(replyQuotePrefixStringsNoSpace[depth]);
          }
          break;
      }
    }
    return strBits.join("");
  }
  function estimateAuthoredBodySize(bodyRep) {
    let authoredBodySize = 0;
    for (var iRep = 0; iRep < bodyRep.length; iRep += 2) {
      var etype = bodyRep[iRep] & 15, block = bodyRep[iRep + 1];
      if (etype !== CT_AUTHORED_CONTENT) {
        continue;
      }
      authoredBodySize += block.length;
    }
    return authoredBodySize;
  }
  var CT_AUTHORED_CONTENT, CT_SIGNATURE, CT_LEADIN_TO_QUOTE, CT_QUOTED_TYPE, CT_QUOTED_REPLY, CT_BOILERPLATE_DISCLAIMER, CT_BOILERPLATE_LIST_INFO, CT_BOILERPLATE_PRODUCT, CT_BOILERPLATE_ADS, CHARCODE_GT, CHARCODE_SPACE, CHARCODE_NBSP, CHARCODE_NEWLINE, RE_SECTION_DELIM, RE_LIST_BOILER, RE_WROTE_LINE, RE_REPLY_LAST_LINE_IN_BLOCK_CONTAINS_WROTE, RE_SIGNATURE_LINE, MAX_BOILERPLATE_LINES, RE_PRODUCT_BOILER, RE_LEGAL_BOILER_START, NEWLINE, RE_NEWLINE, MAX_WORD_SHRINK, RE_NORMALIZE_WHITESPACE, MAX_QUOTE_REPEAT_DEPTH, replyQuotePrefixStrings, replyQuotePrefixStringsNoSpace, replyQuoteNewlineReplaceStrings, replyQuoteNewlineReplaceStringsNoSpace, replyQuoteBlankLine;
  var init_quotechew = __esm({
    "src/backend/bodies/quotechew.js"() {
      CT_AUTHORED_CONTENT = 1;
      CT_SIGNATURE = 2;
      CT_LEADIN_TO_QUOTE = 3;
      CT_QUOTED_TYPE = 4;
      CT_QUOTED_REPLY = 20;
      CT_BOILERPLATE_DISCLAIMER = 5;
      CT_BOILERPLATE_LIST_INFO = 6;
      CT_BOILERPLATE_PRODUCT = 7;
      CT_BOILERPLATE_ADS = 8;
      CHARCODE_GT = ">".charCodeAt(0);
      CHARCODE_SPACE = " ".charCodeAt(0);
      CHARCODE_NBSP = "\xA0".charCodeAt(0);
      CHARCODE_NEWLINE = "\n".charCodeAt(0);
      RE_SECTION_DELIM = /^[_-]{6,}$/;
      RE_LIST_BOILER = /mailing list$/;
      RE_WROTE_LINE = /wrote/;
      RE_REPLY_LAST_LINE_IN_BLOCK_CONTAINS_WROTE = /wrote[^\n]+$/;
      RE_SIGNATURE_LINE = /^-- $/;
      MAX_BOILERPLATE_LINES = 20;
      RE_PRODUCT_BOILER = /^(?:Sent from (?:Mobile|my .+))$/;
      RE_LEGAL_BOILER_START = /^(?:This message|Este mensaje)/;
      NEWLINE = "\n";
      RE_NEWLINE = /\n/g;
      MAX_WORD_SHRINK = 8;
      RE_NORMALIZE_WHITESPACE = /\s+/g;
      MAX_QUOTE_REPEAT_DEPTH = 5;
      replyQuotePrefixStrings = [
        "> ",
        ">> ",
        ">>> ",
        ">>>> ",
        ">>>>> ",
        ">>>>>> ",
        ">>>>>>> ",
        ">>>>>>>> ",
        ">>>>>>>>> "
      ];
      replyQuotePrefixStringsNoSpace = [
        ">",
        ">>",
        ">>>",
        ">>>>",
        ">>>>>",
        ">>>>>>",
        ">>>>>>>",
        ">>>>>>>>",
        ">>>>>>>>>"
      ];
      replyQuoteNewlineReplaceStrings = [
        "\n> ",
        "\n>> ",
        "\n>>> ",
        "\n>>>> ",
        "\n>>>>> ",
        "\n>>>>>> ",
        "\n>>>>>>> ",
        "\n>>>>>>>> "
      ];
      replyQuoteNewlineReplaceStringsNoSpace = [
        "\n>",
        "\n>>",
        "\n>>>",
        "\n>>>>",
        "\n>>>>>",
        "\n>>>>>>",
        "\n>>>>>>>",
        "\n>>>>>>>>"
      ];
      replyQuoteBlankLine = [
        "\n",
        ">\n",
        ">>\n",
        ">>>\n",
        ">>>>\n",
        ">>>>>\n",
        ">>>>>>\n",
        ">>>>>>>\n",
        ">>>>>>>>\n"
      ];
    }
  });

  // src/backend/bodies/htmlchew.js
  function sanitizeAndNormalizeHtml(htmlString) {
    return callOnMainThread({
      cmd: "sanitizeHTML",
      args: [htmlString]
    });
  }
  function generateSnippet2(htmlString, includeQuotes) {
    return callOnMainThread({
      cmd: "convertHTMLToPlainText",
      args: [htmlString]
    });
  }
  function sanitizeSnippetAndExtractLinks(htmlString) {
    return callOnMainThread({
      cmd: "sanitizeSnippetAndExtractLinks",
      args: [htmlString]
    });
  }
  function escapePlaintextIntoElementContext(text) {
    return text.replace(/[&<>"'\/]/g, (c) => {
      const code = c.charCodeAt(0);
      return `&${entities[code] || "#" + code};`;
    });
  }
  function escapePlaintextIntoAttribute(text) {
    return text.replace(/[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u0100]/g, function(c) {
      var code = c.charCodeAt(0);
      return `&${entities[code] || "#" + code};`;
    });
  }
  function wrapTextIntoSafeHTMLString(text, wrapTag, transformNewlines, attrs) {
    if (transformNewlines === void 0) {
      transformNewlines = true;
    }
    wrapTag = wrapTag || "div";
    text = escapePlaintextIntoElementContext(text);
    text = transformNewlines ? text.replace(/\n/g, "<br/>") : text;
    let attributes = "";
    for (let i = 0, ii = attrs?.length || 0; i < ii; i += 2) {
      attributes += ` ${attrs[i]}="${escapePlaintextIntoAttribute(attrs[i + 1])}"`;
    }
    return `<${wrapTag}${attributes}>${text}</${wrapTag}>`;
  }
  function escapeAttrValue(s) {
    return s.replace(RE_QUOTE_CHAR, "&quot;");
  }
  var entities, RE_QUOTE_CHAR;
  var init_htmlchew = __esm({
    "src/backend/bodies/htmlchew.js"() {
      init_worker_router();
      entities = {
        34: "quot",
        38: "amp",
        39: "apos",
        60: "lt",
        62: "gt",
        160: "nbsp",
        161: "iexcl",
        162: "cent",
        163: "pound",
        164: "curren",
        165: "yen",
        166: "brvbar",
        167: "sect",
        168: "uml",
        169: "copy",
        170: "ordf",
        171: "laquo",
        172: "not",
        173: "shy",
        174: "reg",
        175: "macr",
        176: "deg",
        177: "plusmn",
        178: "sup2",
        179: "sup3",
        180: "acute",
        181: "micro",
        182: "para",
        183: "middot",
        184: "cedil",
        185: "sup1",
        186: "ordm",
        187: "raquo",
        188: "frac14",
        189: "frac12",
        190: "frac34",
        191: "iquest",
        192: "Agrave",
        193: "Aacute",
        194: "Acirc",
        195: "Atilde",
        196: "Auml",
        197: "Aring",
        198: "AElig",
        199: "Ccedil",
        200: "Egrave",
        201: "Eacute",
        202: "Ecirc",
        203: "Euml",
        204: "Igrave",
        205: "Iacute",
        206: "Icirc",
        207: "Iuml",
        208: "ETH",
        209: "Ntilde",
        210: "Ograve",
        211: "Oacute",
        212: "Ocirc",
        213: "Otilde",
        214: "Ouml",
        215: "times",
        216: "Oslash",
        217: "Ugrave",
        218: "Uacute",
        219: "Ucirc",
        220: "Uuml",
        221: "Yacute",
        222: "THORN",
        223: "szlig",
        224: "agrave",
        225: "aacute",
        226: "acirc",
        227: "atilde",
        228: "auml",
        229: "aring",
        230: "aelig",
        231: "ccedil",
        232: "egrave",
        233: "eacute",
        234: "ecirc",
        235: "euml",
        236: "igrave",
        237: "iacute",
        238: "icirc",
        239: "iuml",
        240: "eth",
        241: "ntilde",
        242: "ograve",
        243: "oacute",
        244: "ocirc",
        245: "otilde",
        246: "ouml",
        247: "divide",
        248: "oslash",
        249: "ugrave",
        250: "uacute",
        251: "ucirc",
        252: "uuml",
        253: "yacute",
        254: "thorn",
        255: "yuml",
        402: "fnof",
        913: "Alpha",
        914: "Beta",
        915: "Gamma",
        916: "Delta",
        917: "Epsilon",
        918: "Zeta",
        919: "Eta",
        920: "Theta",
        921: "Iota",
        922: "Kappa",
        923: "Lambda",
        924: "Mu",
        925: "Nu",
        926: "Xi",
        927: "Omicron",
        928: "Pi",
        929: "Rho",
        931: "Sigma",
        932: "Tau",
        933: "Upsilon",
        934: "Phi",
        935: "Chi",
        936: "Psi",
        937: "Omega",
        945: "alpha",
        946: "beta",
        947: "gamma",
        948: "delta",
        949: "epsilon",
        950: "zeta",
        951: "eta",
        952: "theta",
        953: "iota",
        954: "kappa",
        955: "lambda",
        956: "mu",
        957: "nu",
        958: "xi",
        959: "omicron",
        960: "pi",
        961: "rho",
        962: "sigmaf",
        963: "sigma",
        964: "tau",
        965: "upsilon",
        966: "phi",
        967: "chi",
        968: "psi",
        969: "omega",
        977: "thetasym",
        978: "upsih",
        982: "piv",
        8226: "bull",
        8230: "hellip",
        8242: "prime",
        8243: "Prime",
        8254: "oline",
        8260: "frasl",
        8472: "weierp",
        8465: "image",
        8476: "real",
        8482: "trade",
        8501: "alefsym",
        8592: "larr",
        8593: "uarr",
        8594: "rarr",
        8595: "darr",
        8596: "harr",
        8629: "crarr",
        8656: "lArr",
        8657: "uArr",
        8658: "rArr",
        8659: "dArr",
        8660: "hArr",
        8704: "forall",
        8706: "part",
        8707: "exist",
        8709: "empty",
        8711: "nabla",
        8712: "isin",
        8713: "notin",
        8715: "ni",
        8719: "prod",
        8721: "sum",
        8722: "minus",
        8727: "lowast",
        8730: "radic",
        8733: "prop",
        8734: "infin",
        8736: "ang",
        8743: "and",
        8744: "or",
        8745: "cap",
        8746: "cup",
        8747: "int",
        8756: "there4",
        8764: "sim",
        8773: "cong",
        8776: "asymp",
        8800: "ne",
        8801: "equiv",
        8804: "le",
        8805: "ge",
        8834: "sub",
        8835: "sup",
        8836: "nsub",
        8838: "sube",
        8839: "supe",
        8853: "oplus",
        8855: "otimes",
        8869: "perp",
        8901: "sdot",
        8968: "lceil",
        8969: "rceil",
        8970: "lfloor",
        8971: "rfloor",
        9001: "lang",
        9002: "rang",
        9674: "loz",
        9824: "spades",
        9827: "clubs",
        9829: "hearts",
        9830: "diams",
        338: "OElig",
        339: "oelig",
        352: "Scaron",
        353: "scaron",
        376: "Yuml",
        710: "circ",
        732: "tilde",
        8194: "ensp",
        8195: "emsp",
        8201: "thinsp",
        8204: "zwnj",
        8205: "zwj",
        8206: "lrm",
        8207: "rlm",
        8211: "ndash",
        8212: "mdash",
        8216: "lsquo",
        8217: "rsquo",
        8218: "sbquo",
        8220: "ldquo",
        8221: "rdquo",
        8222: "bdquo",
        8224: "dagger",
        8225: "Dagger",
        8240: "permil",
        8249: "lsaquo",
        8250: "rsaquo",
        8364: "euro"
      };
      RE_QUOTE_CHAR = /"/g;
    }
  });

  // src/backend/bodies/urlchew.js
  function processLink(url, text) {
    try {
      url = new URL(url);
    } catch {
      try {
        url = new URL(`https://${url}`);
      } catch {
        return null;
      }
    }
    if (linksToIgnore.includes(url.href) || url.protocol === "tel:") {
      return null;
    }
    const link = {
      url: url.href
    };
    if (conferencingInfo.find((info) => url.host.endsWith(info.domain))) {
      link.type = "conferencing";
      return link;
    }
    if (text && url.href !== text) {
      link.text = text;
    }
    return link;
  }
  function processLinks(links, description) {
    const map = new Map();
    for (const [href, content] of Object.entries(links)) {
      const link = processLink(href, content);
      if (link?.text !== "") {
        map.set(link.url, link);
      }
    }
    if (description) {
      const descriptionURLs = description.match(URL_REGEX);
      if (descriptionURLs?.length) {
        for (const descriptionURL of descriptionURLs) {
          const descriptionLink = processLink(descriptionURL);
          if (descriptionLink?.text && !map.has(descriptionLink.url)) {
            map.set(descriptionLink.url, descriptionLink);
          }
        }
      }
    }
    return Array.from(map.values());
  }
  function getConferencingDetails(url) {
    if (!url) {
      return null;
    }
    try {
      url = new URL(url);
    } catch {
      try {
        url = new URL(`https://${url}`);
      } catch {
        return null;
      }
    }
    const domainInfo = conferencingInfo.find((info) => url.host.endsWith(info.domain));
    if (!domainInfo) {
      return null;
    }
    return {
      icon: domainInfo.icon,
      name: domainInfo.name,
      url: url.toString()
    };
  }
  function getConferenceInfo(data, links) {
    if (data.conferenceData?.conferenceSolution) {
      let locationURL;
      for (const entry of data.conferenceData.entryPoints) {
        if (entry.uri.startsWith("https:")) {
          locationURL = new URL(entry.uri);
          break;
        }
      }
      const conferencingDetails = getConferencingDetails(locationURL);
      return conferencingDetails || {
        icon: data.conferenceData.conferenceSolution.iconUri,
        name: data.conferenceData.conferenceSolution.name,
        url: locationURL.toString()
      };
    }
    if (data.onlineMeeting) {
      const locationURL = new URL(data.onlineMeeting.joinUrl);
      return getConferencingDetails(locationURL);
    }
    if (data.location) {
      try {
        let locationURL;
        if (data.location.displayName) {
          locationURL = new URL(data.location.displayName);
        } else {
          locationURL = new URL(data.location);
        }
        return getConferencingDetails(locationURL);
      } catch {
      }
    }
    const conferenceLink = links.find((link) => link.type == "conferencing");
    if (conferenceLink) {
      return getConferencingDetails(conferenceLink.url);
    }
    return null;
  }
  var URL_REGEX, linksToIgnore, conferencingInfo;
  var init_urlchew = __esm({
    "src/backend/bodies/urlchew.js"() {
      URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;
      linksToIgnore = [
        "https://aka.ms/JoinTeamsMeeting"
      ];
      conferencingInfo = [
        {
          name: "Zoom",
          domain: "zoom.us",
          icon: "chrome://browser/content/companion/zoom.png"
        },
        {
          name: "Teams",
          domain: "teams.microsoft.com",
          icon: "chrome://browser/content/companion/teams.png"
        },
        {
          name: "Meet",
          domain: "meet.google.com",
          icon: "chrome://browser/content/companion/meet.png"
        },
        {
          name: "Jitsi",
          domain: "meet.jit.si",
          icon: "chrome://browser/content/companion/jitsi.png"
        },
        {
          name: "GoToMeeting",
          domain: ".gotomeeting.com",
          icon: "chrome://browser/content/companion/gotomeeting.png"
        },
        {
          name: "WebEx",
          domain: ".webex.com",
          icon: "chrome://browser/content/companion/webex.png"
        }
      ];
    }
  });

  // src/backend/bodies/mailchew.js
  function generateBaseComposeParts(identity) {
    let textMsg;
    if (identity.signatureEnabled && identity.signature && identity.signature.length) {
      textMsg = "\n\n--\n" + identity.signature;
    } else {
      textMsg = "";
    }
    return makeBodyPartsFromTextAndHTML(textMsg, null);
  }
  function generateReplySubject(origSubject) {
    var re = "Re: ";
    if (origSubject) {
      if (RE_RE.test(origSubject)) {
        return origSubject;
      }
      return re + origSubject;
    }
    return re;
  }
  function generateForwardSubject(origSubject) {
    var fwd = "Fwd: ";
    if (origSubject) {
      if (RE_FWD.test(origSubject)) {
        return origSubject;
      }
      return fwd + origSubject;
    }
    return fwd;
  }
  function generateMessageIdHeaderValue() {
    return Math.random().toString(16).substr(2) + Math.random().toString(16).substr(1) + "@mozgaia";
  }
  function setLocalizedStrings(strings2) {
    l10n_wroteString = strings2.wrote;
    l10n_originalMessageString = strings2.originalMessage;
    l10n_forward_header_labels = strings2.forwardHeaderLabels;
  }
  function makeBodyPartsFromTextAndHTML(textMsg, htmlMsg) {
    let bodyReps = [];
    bodyReps.push(makeBodyPart({
      type: "plain",
      part: null,
      sizeEstimate: textMsg.length,
      amountDownloaded: textMsg.length,
      isDownloaded: true,
      _partInfo: {},
      contentBlob: new Blob([JSON.stringify([1, textMsg])], {
        type: "application/json"
      })
    }));
    if (htmlMsg) {
      bodyReps.push(makeBodyPart({
        type: "html",
        part: null,
        sizeEstimate: htmlMsg.length,
        amountDownloaded: htmlMsg.length,
        isDownloaded: true,
        _partInfo: {},
        contentBlob: new Blob([htmlMsg], { type: "text/html" })
      }));
    }
    return bodyReps;
  }
  async function generateReplyParts(reps, authorPair, msgDate, identity, refGuid) {
    var useName = authorPair.name ? authorPair.name.trim() : authorPair.address;
    var textMsg = "\n\n" + l10n_wroteString.replace("{name}", useName) + ":\n", htmlMsg = null;
    for (let i = 0; i < reps.length; i++) {
      let repType = reps[i].type;
      let repBlob = reps[i].contentBlob;
      let rep;
      if (repType === "plain") {
        rep = JSON.parse(await repBlob.text());
        var replyText = generateReplyText(rep);
        if (htmlMsg) {
          htmlMsg += wrapTextIntoSafeHTMLString(replyText) + "\n";
        } else {
          textMsg += replyText;
        }
      } else if (repType === "html") {
        rep = await repBlob.text();
        if (!htmlMsg) {
          htmlMsg = "";
          if (textMsg.slice(-1) === "\n") {
            textMsg = textMsg.slice(0, -1);
          }
        }
        htmlMsg += "<blockquote ";
        if (refGuid) {
          htmlMsg += 'cite="mid:' + escapeAttrValue(refGuid) + '" ';
        }
        htmlMsg += 'type="cite">' + rep + "</blockquote>";
      }
    }
    if (identity.signature && identity.signatureEnabled) {
      if (htmlMsg) {
        htmlMsg += wrapTextIntoSafeHTMLString(identity.signature, "pre", false, ["class", "moz-signature", "cols", "72"]);
      } else {
        textMsg += "\n\n-- \n" + identity.signature;
      }
    }
    return makeBodyPartsFromTextAndHTML(textMsg, htmlMsg);
  }
  async function generateForwardParts(sourceMessage, identity) {
    var textMsg = "\n\n", htmlMsg = null;
    if (identity.signature && identity.signatureEnabled) {
      textMsg += "-- \n" + identity.signature + "\n\n";
    }
    textMsg += "-------- " + l10n_originalMessageString + " --------\n";
    textMsg += l10n_forward_header_labels.subject + ": " + sourceMessage.subject + "\n";
    textMsg += l10n_forward_header_labels.date + ": " + new Date(sourceMessage.date) + "\n";
    textMsg += l10n_forward_header_labels.from + ": " + formatAddresses([sourceMessage.author]) + "\n";
    if (sourceMessage.replyTo) {
      textMsg += l10n_forward_header_labels.replyTo + ": " + formatAddresses([sourceMessage.replyTo]) + "\n";
    }
    if (sourceMessage.to && sourceMessage.to.length) {
      textMsg += l10n_forward_header_labels.to + ": " + formatAddresses(sourceMessage.to) + "\n";
    }
    if (sourceMessage.cc && sourceMessage.cc.length) {
      textMsg += l10n_forward_header_labels.cc + ": " + formatAddresses(sourceMessage.cc) + "\n";
    }
    textMsg += "\n";
    let reps = sourceMessage.bodyReps;
    for (let i = 0; i < reps.length; i++) {
      let repType = reps[i].type;
      let repBlob = reps[i].contentBlob;
      let rep;
      if (repType === "plain") {
        rep = JSON.parse(await repBlob.text());
        let forwardText = generateForwardBodyText(rep);
        if (htmlMsg) {
          htmlMsg += wrapTextIntoSafeHTMLString(forwardText) + "\n";
        } else {
          textMsg += forwardText;
        }
      } else if (repType === "html") {
        rep = await repBlob.text();
        if (!htmlMsg) {
          htmlMsg = "";
          if (textMsg.slice(-1) === "\n") {
            textMsg = textMsg.slice(0, -1);
          }
        }
        htmlMsg += rep;
      }
    }
    return makeBodyPartsFromTextAndHTML(textMsg, htmlMsg);
  }
  async function processMessageContent(content, type, isDownloaded, generateSnippet3) {
    if (content.slice(-1) === "\n") {
      content = content.slice(0, -1);
    }
    let parsedContent, contentBlob, snippet;
    let authoredBodySize = 0;
    switch (type) {
      case "plain":
        try {
          parsedContent = quoteProcessTextBody(content);
          authoredBodySize = estimateAuthoredBodySize(parsedContent);
        } catch (ex) {
          logic(scope3, "textChewError", { ex });
          parsedContent = [];
        }
        if (generateSnippet3) {
          try {
            snippet = generateSnippet(parsedContent, DESIRED_SNIPPET_LENGTH);
          } catch (ex) {
            logic(scope3, "textSnippetError", { ex });
            snippet = "";
          }
        }
        contentBlob = new Blob([JSON.stringify(parsedContent)], {
          type: "application/json"
        });
        break;
      case "html":
        if (generateSnippet3) {
          try {
            snippet = await generateSnippet2(content);
          } catch (ex) {
            logic(scope3, "htmlSnippetError", { ex });
            snippet = "";
          }
        }
        if (isDownloaded) {
          try {
            parsedContent = await sanitizeAndNormalizeHtml(content);
            contentBlob = new Blob([parsedContent], { type: "text/html" });
            authoredBodySize = (await generateSnippet2(parsedContent, false)).length;
          } catch (ex) {
            logic(scope3, "htmlParseError", { ex });
            parsedContent = "";
          }
        }
        break;
      default: {
        throw new Error("unpossible!");
      }
    }
    return { contentBlob, snippet, authoredBodySize };
  }
  async function processEventContent({
    data,
    content,
    type,
    processAsText = false
  }) {
    const { links, document, snippet } = type === "html" ? await sanitizeSnippetAndExtractLinks(content) : { links: {}, document: content, snippet: content };
    const contentBlob = new Blob([document], { type: `text/${type}` });
    const authoredBodySize = snippet.length;
    const processedLinks = processLinks(links, (processAsText || type === "plain") && content);
    const conference = getConferenceInfo(data, processedLinks);
    return {
      conference,
      links: processedLinks.filter((link) => link.type != "conferencing"),
      contentBlob,
      snippet,
      authoredBodySize
    };
  }
  var scope3, RE_RE, RE_FWD, l10n_wroteString, l10n_originalMessageString, l10n_forward_header_labels;
  var init_mailchew = __esm({
    "src/backend/bodies/mailchew.js"() {
      init_logic();
      init_util();
      init_mailchew_strings();
      init_quotechew();
      init_htmlchew();
      init_urlchew();
      init_syncbase();
      init_mail_rep();
      scope3 = logic.scope("MailChew");
      RE_RE = /^[Rr][Ee]:/;
      RE_FWD = /^[Ff][Ww][Dd]:/;
      l10n_wroteString = "{name} wrote";
      l10n_originalMessageString = "Original Message";
      l10n_forward_header_labels = {
        subject: "Subject",
        date: "Date",
        from: "From",
        replyTo: "Reply-To",
        to: "To",
        cc: "CC"
      };
      if (strings) {
        setLocalizedStrings(strings);
      }
      events.on("strings", function(strings2) {
        setLocalizedStrings(strings2);
      });
    }
  });

  // src/backend/accounts/feed/chew_item.js
  var FeedItemChewer;
  var init_chew_item = __esm({
    "src/backend/accounts/feed/chew_item.js"() {
      init_mail_rep();
      init_mailchew();
      init_id_conversions();
      FeedItemChewer = class {
        constructor({ convId, item, foldersTOC }) {
          this.convId = convId;
          this.item = item;
          this.foldersTOC = foldersTOC;
          this.inboxFolder = foldersTOC.getCanonicalFolderByType("inbox");
          this.allMessages = [];
        }
        async chewItem() {
          const item = this.item;
          let contentBlob, snippet, authoredBodySize;
          let bodyReps = [];
          const msgId = makeMessageId(this.convId, "0");
          if (item.description) {
            const description = item.description;
            ({ contentBlob, snippet, authoredBodySize } = await processMessageContent(description, item.contentType, true, true));
            bodyReps.push(makeBodyPart({
              type: item.contentType,
              part: null,
              sizeEstimate: description.length,
              amountDownloaded: description.length,
              isDownloaded: true,
              _partInfo: null,
              contentBlob,
              authoredBodySize
            }));
          }
          const msgInfo = makeMessageInfo({
            id: msgId,
            umid: null,
            guid: item.guid,
            date: item.date,
            dateModified: item.dateModified,
            author: item.author,
            flags: [],
            folderIds: new Set([this.inboxFolder.id]),
            subject: item.title,
            snippet,
            attachments: [],
            relatedParts: null,
            references: null,
            bodyReps,
            authoredBodySize,
            draftInfo: null
          });
          this.allMessages.push(msgInfo);
        }
      };
    }
  });

  // src/backend/accounts/feed/tasks/sync_item.js
  var sync_item_default;
  var init_sync_item = __esm({
    "src/backend/accounts/feed/tasks/sync_item.js"() {
      init_util();
      init_date_priority_adjuster();
      init_task_definer();
      init_conv_churn_driver();
      init_chew_item();
      sync_item_default = task_definer_default.defineSimpleTask([
        {
          name: "sync_item",
          async plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];
            plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];
            if (rawTask.mostRecent) {
              plannedTask.relPriority = prioritizeNewer(rawTask.mostRecent);
            }
            await ctx.finishTask({
              taskState: plannedTask
            });
          },
          async execute(ctx, req) {
            const account = await ctx.universe.acquireAccount(ctx, req.accountId);
            const foldersTOC = await ctx.universe.acquireAccountFoldersTOC(ctx, account.id);
            const fromDb = await ctx.beginMutate({
              conversations: new Map([[req.convId, null]])
            });
            const oldConvInfo = fromDb.conversations.get(req.convId);
            if (oldConvInfo) {
              await ctx.finishTask({});
              return;
            }
            const itemChewer = new FeedItemChewer({
              convId: req.convId,
              item: req.item,
              foldersTOC
            });
            await itemChewer.chewItem();
            const convInfo = churnConversationDriver(req.convId, null, itemChewer.allMessages);
            await ctx.finishTask({
              newData: {
                conversations: [convInfo],
                messages: itemChewer.allMessages
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/utils/network.js
  async function fetchCacheAware(request, state) {
    if (typeof request === "string") {
      request = new Request(request);
    }
    request.cache = "no-store";
    if (!state) {
      state = Object.create(null);
    }
    const result = {
      response: null,
      requestCacheState: state
    };
    const { etag, lastModified } = state;
    const headers = request.headers;
    if (etag) {
      headers.set("If-None-Match", etag);
    }
    if (lastModified) {
      headers.set("If-Modified-Since", lastModified);
    }
    const response = await fetch(request);
    if (response.status === 304) {
      return result;
    }
    const newEtag = response.headers.get("ETag");
    if (newEtag) {
      state.etag = newEtag;
    }
    const newLastModified = response.headers.get("Last-Modified");
    if (newLastModified) {
      state.lastModified = newLastModified;
    }
    result.response = response;
    return result;
  }
  var init_network = __esm({
    "src/backend/utils/network.js"() {
    }
  });

  // src/backend/accounts/feed/sync_state_helper.js
  var FeedSyncStateHelper;
  var init_sync_state_helper = __esm({
    "src/backend/accounts/feed/sync_state_helper.js"() {
      init_logic();
      init_date();
      init_id_conversions();
      FeedSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId, why) {
          logic.defineScope(this, "FeedSyncState", { ctxId: ctx.id, why });
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {
              lastChangeDatestamp: NOW(),
              requestCacheState: null
            };
          }
          this._accountId = accountId;
          this.rawSyncState = rawSyncState;
          this.tasksToSchedule = [];
        }
        _makeItemConvTask({ convId, item }) {
          const task = {
            type: "sync_item",
            accountId: this._accountId,
            convId,
            item
          };
          this.tasksToSchedule.push(task);
          return task;
        }
        _makeDefaultData() {
          return {
            author: "No author",
            title: "No title",
            description: "",
            contentType: "plain"
          };
        }
        ingestHEntry(entry) {
          const data = this._makeDefaultData();
          data.guid = entry.uid?.[0] || entry.name?.[0] || entry.summary?.[0];
          data.date = (entry.published?.[0] || NOW()).valueOf();
          data.dateModified = (entry.updated?.[0] || NOW()).valueOf();
          data.author = entry.author?.[0] || data.author;
          data.title = entry.name?.[0] || entry.summary?.[0] || data.title;
          const content = entry.content?.[0] || {};
          if (content.html) {
            data.description = content.html;
            data.contentType = "html";
          } else {
            data.description = content.value || "";
            data.contentType = "plain";
          }
          const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
          this._makeItemConvTask({
            convId,
            item: data
          });
        }
        ingestItem(item) {
          const data = this._makeDefaultData();
          if (item.guid) {
            data.guid = typeof item.guid === "string" ? item.guid : item.guid["#content"];
          } else {
            data.guid = item.title || item.description;
          }
          data.date = data.dateModified = (item.pubDate || NOW()).valueOf();
          data.author = item.author || data.author;
          data.title = item.title || data.title;
          data.description = item.description || data.description;
          data.contentType = "html";
          const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
          this._makeItemConvTask({
            convId,
            item: data
          });
        }
        ingestJsonItem(item) {
          const data = this._makeDefaultData();
          data.guid = item.id;
          data.date = (item.date_published || NOW()).valueOf();
          data.dateModified = (item.date_modified || NOW()).valueOf();
          data.author = item.authors?.[0]?.name || data.author;
          data.title = item.title || data.title;
          if (item.content_html) {
            data.description = item.content_html;
            data.contentType = "html";
          } else {
            data.description = item.content_text;
            data.contentType = "plain";
          }
          const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
          this._makeItemConvTask({
            convId,
            item: data
          });
        }
        ingestEntry(entry) {
          const getContent = (value) => value?.["#content"] || value;
          const data = this._makeDefaultData();
          for (const fieldName of [
            "title",
            "summary",
            "id",
            "published",
            "updated"
          ]) {
            entry[fieldName] = getContent(entry[fieldName]);
          }
          data.guid = entry.id || entry.title || entry.summary || NOW().valueOf().toString();
          data.date = (entry.published || entry.updated || NOW()).valueOf();
          data.dateModified = entry.updated?.valueOf() || data.date;
          const author = entry.author?.[0];
          if (author?.name && author?.email) {
            data.author = `${getContent(author.name)} (${getContent(author.email)})`;
          } else {
            data.author = getContent(author?.name) || getContent(author?.email) || data.author;
          }
          data.title = entry.title || data.title;
          if (entry.content) {
            if (entry.content.type === "text") {
              data.description = getContent(entry.content);
              data.contentType = "plain";
            } else {
              data.description = entry.content.div;
              data.contentType = "html";
            }
          }
          const convId = makeGlobalNamespacedConvId(this._accountId, data.guid);
          this._makeItemConvTask({
            convId,
            item: data
          });
        }
      };
    }
  });

  // src/backend/task_helpers/sync_overlay_helpers.js
  function syncNormalOverlay(id, marker, inProgress, blockedBy) {
    let status;
    if (inProgress) {
      status = "active";
    } else if (marker) {
      status = "pending";
    } else {
      return null;
    }
    let blocked = null;
    if (blockedBy) {
      switch (blockedBy[blockedBy.length - 1][0]) {
        case "o":
          blocked = "offline";
          break;
        case "c":
          blocked = "bad-auth";
          break;
        case "h":
          blocked = "unknown";
          break;
        default:
          break;
      }
    }
    return { status, blocked };
  }
  function syncPrefixOverlay(fullId, binId, marker, inProgress, blockedBy) {
    return syncNormalOverlay(binId, marker, inProgress, blockedBy);
  }
  var init_sync_overlay_helpers = __esm({
    "src/backend/task_helpers/sync_overlay_helpers.js"() {
    }
  });

  // src/backend/accounts/feed/tasks/sync_refresh.js
  var sync_refresh_default;
  var init_sync_refresh = __esm({
    "src/backend/accounts/feed/tasks/sync_refresh.js"() {
      init_logic();
      init_feed_parser3();
      init_feed_parser2();
      init_network();
      init_feed_parser();
      init_util();
      init_date();
      init_task_definer();
      init_sync_state_helper();
      init_id_conversions();
      init_sync_overlay_helpers();
      sync_refresh_default = task_definer_default.defineAtMostOnceTask([
        {
          name: "sync_refresh",
          binByArg: "accountId",
          helped_overlay_accounts: syncNormalOverlay,
          helped_prefix_overlay_folders: [accountIdFromFolderId, syncPrefixOverlay],
          helped_invalidate_overlays(accountId, dataOverlayManager) {
            dataOverlayManager.announceUpdatedOverlayData("accounts", accountId);
            dataOverlayManager.announceUpdatedOverlayData("accountCascadeToFolders", accountId);
          },
          helped_already_planned(ctx, rawTask) {
            return Promise.resolve({
              result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.accountId)
            });
          },
          helped_plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.resources = [
              "online",
              `credentials!${rawTask.accountId}`,
              `happy!${rawTask.accountId}`
            ];
            plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];
            let groupPromise = ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.accountId);
            return Promise.resolve({
              taskState: plannedTask,
              remainInProgressUntil: groupPromise,
              result: groupPromise
            });
          },
          async helped_execute(ctx, req) {
            let fromDb = await ctx.beginMutate({
              syncStates: new Map([[req.accountId, null]])
            });
            let rawSyncState = fromDb.syncStates.get(req.accountId);
            let syncState = new FeedSyncStateHelper(ctx, rawSyncState, req.accountId, "refresh");
            let account = await ctx.universe.acquireAccount(ctx, req.accountId);
            let syncDate = NOW();
            logic(ctx, "syncStart", { syncDate });
            if (account.feedType === "html") {
              const parsed = await parseHFeedFromUrl(account.feedUrl);
              for (const entry of parsed.entries) {
                syncState.ingestHEntry(entry);
              }
            } else {
              const { response, requestCacheState } = await fetchCacheAware(account.feedUrl, syncState.rawSyncState.requestCacheState);
              syncState.rawSyncState.requestCacheState = requestCacheState;
              if (!response) {
                logic(ctx, "syncEnd", {});
                return null;
              }
              const feedText = await response.text();
              const parsed = account.feedType === "json" ? parseJsonFeed(feedText) : parseFeed(feedText);
              if (parsed?.rss?.channel.item) {
                for (const item of parsed.rss.channel.item) {
                  syncState.ingestItem(item);
                }
              } else if (parsed?.feed?.entry) {
                for (const entry of parsed.feed.entry) {
                  syncState.ingestEntry(entry);
                }
              } else if (parsed?.entry) {
                syncState.ingestEntry(parsed.entry);
              } else if (parsed?.items) {
                for (const item of parsed.items) {
                  syncState.ingestJsonItem(item);
                }
              }
            }
            logic(ctx, "syncEnd", {});
            return {
              mutations: {
                syncStates: new Map([[req.accountId, syncState.rawSyncState]])
              },
              newData: {
                tasks: syncState.tasksToSchedule
              },
              atomicClobbers: {
                accounts: new Map([
                  [
                    req.accountId,
                    {
                      syncInfo: {
                        lastSuccessfulSyncAt: syncDate,
                        lastAttemptedSyncAt: syncDate,
                        failedSyncsSinceLastSuccessfulSync: 0
                      }
                    }
                  ]
                ])
              }
            };
          }
        }
      ]);
    }
  });

  // src/backend/tasks/account_modify.js
  var account_modify_default;
  var init_account_modify = __esm({
    "src/backend/tasks/account_modify.js"() {
      init_logic();
      init_task_definer();
      init_date();
      account_modify_default = task_definer_default.defineSimpleTask([
        {
          name: "account_modify",
          async plan(ctx, rawTask) {
            const accountDef = ctx.readSingle("accounts", rawTask.accountId);
            const accountClobbers = new Map();
            for (let key in rawTask.mods) {
              const val = rawTask.mods[key];
              switch (key) {
                case "name":
                  accountClobbers.set(["map"], val);
                  break;
                case "username":
                  if (accountDef.credentials.outgoingUsername === accountDef.credentials.username) {
                    accountClobbers.set(["credentials", "outgoingUsername"], val);
                  }
                  accountClobbers.set(["credentials", "username"], val);
                  break;
                case "incomingUsername":
                  accountClobbers.set(["credentials", "username"], val);
                  break;
                case "outgoingUsername":
                  accountClobbers.set(["credentials", "outgoingUsername"], val);
                  break;
                case "password":
                  if (accountDef.credentials.outgoingPassword === accountDef.credentials.password) {
                    accountClobbers.set(["credentials", "outgoingPassword"], val);
                  }
                  accountClobbers.set(["credentials", "password"], val);
                  break;
                case "incomingPassword":
                  accountClobbers.set(["credentials", "password"], val);
                  break;
                case "outgoingPassword":
                  accountClobbers.set(["credentials", "outgoingPassword"], val);
                  break;
                case "oauthTokens":
                  accountClobbers.set(["credentials", "oauth2", "accessToken"], val.accessToken);
                  accountClobbers.set(["credentials", "oauth2", "refreshToken"], val.refreshToken);
                  accountClobbers.set(["credentials", "oauth2", "expireTimeMS"], val.expireTimeMS);
                  break;
                case "identities":
                  break;
                case "servers":
                  break;
                case "syncRange":
                  accountClobbers.set(["syncRange"], val);
                  break;
                case "syncInterval":
                  accountClobbers.set(["syncInterval"], val);
                  break;
                case "notifyOnNew":
                  accountClobbers.set(["notifyOnNew"], val);
                  break;
                case "playSoundOnSend":
                  accountClobbers.set(["playSoundOnSend"], val);
                  break;
                case "setAsDefault":
                  if (val) {
                    accountClobbers.set(["defaultPriority"], NOW());
                  }
                  break;
                default:
                  logic(ctx, "badModifyAccountKey", { key });
                  break;
              }
            }
            await ctx.finishTask({
              atomicClobbers: {
                accounts: new Map([[rawTask.accountId, accountClobbers]])
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/tasks/identity_modify.js
  var identity_modify_default;
  var init_identity_modify = __esm({
    "src/backend/tasks/identity_modify.js"() {
      init_logic();
      init_task_definer();
      identity_modify_default = task_definer_default.defineSimpleTask([
        {
          name: "identity_modify",
          async plan(ctx, rawTask) {
            const accountClobbers = new Map();
            const identIndex = 0;
            const identPath = ["identities", identIndex];
            for (let key in rawTask.mods) {
              const val = rawTask.mods[key];
              switch (key) {
                case "name":
                  accountClobbers.set(identPath.concat("name"), val);
                  break;
                case "address":
                  accountClobbers.set(identPath.concat("address"), val);
                  break;
                case "replyTo":
                  accountClobbers.set(identPath.concat("replyTo"), val);
                  break;
                case "signature":
                  accountClobbers.set(identPath.concat("signature"), val);
                  break;
                case "signatureEnabled":
                  accountClobbers.set(identPath.concat("signatureEnabled"), val);
                  break;
                default:
                  logic(ctx, "badModifyIdentityKey", { key });
                  break;
              }
            }
            await ctx.finishTask({
              atomicClobbers: {
                accounts: new Map([[rawTask.accountId, accountClobbers]])
              }
            });
          }
        }
      ]);
    }
  });

  // src/app_logic/new_message_summarizer.js
  function extractRelevantMessageInfoForChurning(message) {
    return {
      date: message.date,
      authorNameish: message.author.name || message.author.address,
      subject: message.subject
    };
  }
  var init_new_message_summarizer = __esm({
    "src/app_logic/new_message_summarizer.js"() {
    }
  });

  // src/backend/tasks/new_tracking.js
  var new_tracking_default;
  var init_new_tracking = __esm({
    "src/backend/tasks/new_tracking.js"() {
      init_task_definer();
      init_new_message_summarizer();
      init_id_conversions();
      new_tracking_default = task_definer_default.defineComplexTask([
        {
          name: "new_tracking",
          initPersistentState() {
            return {
              compareDate: null,
              pendingDate: 0,
              newByConv: new Map()
            };
          },
          deriveMemoryStateFromPersistentState(persistentState, accountId, accountInfo, foldersTOC) {
            let inboxFolder = foldersTOC.getCanonicalFolderByType("inbox");
            return {
              memoryState: {
                inboxFolderId: inboxFolder && inboxFolder.id,
                foldersTOC,
                pendingTaskGroupId: null,
                complexStateMap: new Map([[[accountId, this.name], persistentState]]),
                newFlushTaskReq: {
                  type: "new_flush"
                }
              },
              markers: []
            };
          },
          async plan(ctx, persistentState, memoryState, req) {
            if (!persistentState.newByConv.size) {
              await ctx.finishTask({});
              return;
            }
            let newTasks = [];
            if (req.op === "clear") {
              if (!req.silent) {
                newTasks.push({
                  type: "new_flush"
                });
              }
              persistentState.newByConv.clear();
            }
            await ctx.finishTask({
              newData: { tasks: newTasks },
              complexTaskState: persistentState
            });
          },
          execute: null,
          consult(askingCtx, persistentState) {
            return persistentState.newByConv;
          },
          "trigger_msg!*!add": function(persistentState, memoryState, triggerCtx, message) {
            if (!memoryState.inboxFolderId) {
              let inboxFolder = memoryState.foldersTOC.getCanonicalFolderByType("inbox");
              memoryState.inboxFolderId = inboxFolder && inboxFolder.id;
              if (!memoryState.inboxFolderId) {
                return;
              }
            }
            if (!message.folderIds.has(memoryState.inboxFolderId)) {
              return;
            }
            if (message.flags.includes("\\Seen")) {
              return;
            }
            let curTaskGroupId = triggerCtx.rootTaskGroupId;
            let dirty = false;
            if (curTaskGroupId !== memoryState.pendingTaskGroupId) {
              persistentState.compareDate = persistentState.pendingDate;
              memoryState.pendingTaskGroupId = curTaskGroupId;
              dirty = true;
            }
            if (message.date >= persistentState.pendingDate) {
              dirty = true;
              persistentState.pendingDate = Math.max(persistentState.pendingDate, message.date);
              let convId = convIdFromMessageId(message.id);
              let summary = extractRelevantMessageInfoForChurning(message);
              let messageMap = persistentState.newByConv.get(convId);
              if (!messageMap) {
                messageMap = new Map();
                persistentState.newByConv.set(convId, messageMap);
              }
              messageMap.set(message.id, summary);
            }
            if (dirty) {
              triggerCtx.modify({
                complexTaskStates: memoryState.complexStateMap,
                rootGroupDeferredTask: memoryState.newFlushTaskReq
              });
            }
          },
          "trigger_msg!*!change": function(persistentState, memoryState, triggerCtx, messageId, preInfo, message, added, kept, removed) {
            if (removed.has(memoryState.inboxFolderId) || message && message.flags.includes("\\Seen")) {
              let convId = convIdFromMessageId(messageId);
              let messageMap = persistentState.newByConv.get(convId);
              if (!messageMap) {
                return;
              }
              if (messageMap.delete(messageId)) {
                if (messageMap.size === 0) {
                  persistentState.newByConv.delete(convId);
                }
                triggerCtx.modify({
                  complexTaskStates: memoryState.complexStateMap,
                  rootGroupDeferredTask: memoryState.newFlushTaskReq
                });
              }
            }
          }
        }
      ]);
    }
  });

  // src/backend/accounts/feed/feed_tasks.js
  var feed_tasks_exports = {};
  __export(feed_tasks_exports, {
    default: () => feed_tasks_default
  });
  var feed_tasks_default;
  var init_feed_tasks = __esm({
    "src/backend/accounts/feed/feed_tasks.js"() {
      init_sync_folder_list();
      init_sync_item();
      init_sync_refresh();
      init_account_modify();
      init_identity_modify();
      init_new_tracking();
      feed_tasks_default = [
        sync_folder_list_default,
        sync_item_default,
        sync_refresh_default,
        account_modify_default,
        identity_modify_default,
        new_tracking_default
      ];
    }
  });

  // src/backend/accounts/gapi/account_sync_state_helper.js
  var GapiAccountSyncStateHelper;
  var init_account_sync_state_helper = __esm({
    "src/backend/accounts/gapi/account_sync_state_helper.js"() {
      init_logic();
      GapiAccountSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId) {
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {};
          }
          this._ctx = ctx;
          this._accountId = accountId;
          this.rawSyncState = rawSyncState;
        }
      };
    }
  });

  // src/backend/accounts/gapi/tasks/sync_folder_list.js
  var sync_folder_list_default2;
  var init_sync_folder_list2 = __esm({
    "src/backend/accounts/gapi/tasks/sync_folder_list.js"() {
      init_task_definer();
      init_mix_sync_folder_list();
      init_folder_info_rep();
      init_account_sync_state_helper();
      sync_folder_list_default2 = task_definer_default.defineSimpleTask([
        mix_sync_folder_list_default,
        {
          essentialOfflineFolders: [],
          async syncFolders(ctx, account) {
            const fromDb = await ctx.beginMutate({
              syncStates: new Map([[account.id, null]])
            });
            const rawSyncState = fromDb.syncStates.get(account.id);
            const syncState = new GapiAccountSyncStateHelper(ctx, rawSyncState, account.id);
            const foldersTOC = account.foldersTOC;
            const clResult = await account.client.pagedApiGetCall("https://www.googleapis.com/calendar/v3/users/me/calendarList", {}, "items", (result) => {
            });
            const newFolders = [];
            const modifiedFolders = new Map();
            const observedFolderServerIds = new Set();
            for (const calInfo of clResult.items) {
              let wantFolder = calInfo.selected;
              let calFolder = foldersTOC.items.find((f) => f.serverId === calInfo.id);
              if (!wantFolder) {
                if (calFolder) {
                  modifiedFolders.set(calFolder.id, null);
                }
                continue;
              }
              observedFolderServerIds.add(calInfo.id);
              let desiredCalendarInfo = {
                timeZone: calInfo.timeZone,
                color: calInfo.backgroundColor || null
              };
              if (!calFolder) {
                calFolder = makeFolderMeta({
                  id: foldersTOC.issueFolderId(),
                  serverId: calInfo.id,
                  name: calInfo.summary,
                  description: calInfo.description,
                  type: "calendar",
                  path: null,
                  serverPath: null,
                  parentId: null,
                  delim: null,
                  depth: 0,
                  syncGranularity: "folder",
                  calendarInfo: desiredCalendarInfo
                });
                newFolders.push(calFolder);
              } else {
                let modified = false;
                if (calFolder.name !== calInfo.summary) {
                  calFolder.name = calInfo.summary;
                  modified = true;
                }
                if (calFolder.description !== calInfo.description) {
                  calFolder.description = calInfo.description;
                  modified = true;
                }
                for (const [dkey, dvalue] of Object.entries(desiredCalendarInfo)) {
                  if (calFolder.calendarInfo[dkey] !== dvalue) {
                    calFolder.calendarInfo[dkey] = dvalue;
                    modified = true;
                  }
                }
                if (modified) {
                  modifiedFolders.set(calFolder.id, calFolder);
                }
              }
            }
            for (const folderInfo of foldersTOC.items.filter((x) => x.type === "calendar")) {
              if (!observedFolderServerIds.has(folderInfo.serverId)) {
                modifiedFolders.set(folderInfo.id, null);
              }
            }
            return {
              newFolders,
              modifiedFolders,
              modifiedSyncStates: new Map([[account.id, syncState.rawSyncState]])
            };
          }
        }
      ]);
    }
  });

  // src/backend/db/cal_event_rep.js
  function makeIdentityInfo(raw) {
    return {
      email: raw.email,
      displayName: raw.displayName,
      isSelf: raw.isSelf || false
    };
  }
  function makeAttendeeInfo(raw) {
    return {
      email: raw.email,
      displayName: raw.displayName,
      isSelf: raw.isSelf || false,
      isOrganizer: raw.isOrganizer || false,
      isResource: raw.isResource || false,
      responseStatus: raw.responseStatus,
      comment: raw.comment || null,
      isOptional: raw.isOptional || false
    };
  }
  function makeCalendarEventInfo(raw) {
    return {
      id: raw.id,
      type: "cal",
      date: raw.date,
      startDate: raw.startDate,
      endDate: raw.endDate,
      isAllDay: raw.isAllDay,
      isRecurring: raw.isRecurring || false,
      creator: raw.creator,
      organizer: raw.organizer,
      attendees: raw.attendees || null,
      flags: raw.flags || [],
      folderIds: raw.folderIds || new Set(),
      subject: raw.summary ?? null,
      snippet: raw.snippet ?? null,
      bodyReps: raw.bodyReps,
      authoredBodySize: raw.authoredBodySize || 0,
      conference: raw.conference || null,
      links: raw.links || []
    };
  }
  var init_cal_event_rep = __esm({
    "src/backend/db/cal_event_rep.js"() {
    }
  });

  // src/backend/accounts/gapi/chew_gapi_cal_events.js
  var GapiCalEventChewer;
  var init_chew_gapi_cal_events = __esm({
    "src/backend/accounts/gapi/chew_gapi_cal_events.js"() {
      init_mail_rep();
      init_mailchew();
      init_date();
      init_id_conversions();
      init_cal_event_rep();
      init_logic();
      GapiCalEventChewer = class {
        constructor({
          ctx,
          convId,
          folderId,
          rangeOldestTS,
          rangeNewestTS,
          eventMap,
          oldConvInfo,
          oldEvents,
          foldersTOC
        }) {
          this.ctx = ctx;
          this.convId = convId;
          this.folderId = folderId;
          this.rangeOldestTS = rangeOldestTS;
          this.rangeNewestTS = rangeNewestTS;
          this.eventMap = eventMap;
          this.oldConvInfo = oldConvInfo;
          this.oldEvents = oldEvents;
          this.foldersTOC = foldersTOC;
          this.oldById = new Map();
          this.unifiedEvents = [];
          this.modifiedEventMap = new Map();
          this.newEvents = [];
          this.allEvents = [];
        }
        _chewCalIdentity(raw) {
          return makeIdentityInfo({
            displayName: raw.displayName,
            email: raw.email,
            isSelf: raw.self
          });
        }
        _chewCalAttendee(raw) {
          return makeAttendeeInfo({
            displayName: raw.displayName,
            email: raw.email,
            isSelf: raw.self,
            isOrganizer: raw.organizer,
            isResource: raw.resource,
            responseStatus: raw.responseStatus,
            comment: raw.comment,
            isOptional: raw.optional
          });
        }
        async chewEventBundle() {
          const oldById = this.oldById;
          for (const oldInfo of this.oldEvents) {
            if (EVENT_OUTSIDE_SYNC_RANGE(oldInfo, this)) {
              this.modifiedEventMap.set(oldInfo.id, null);
            } else {
              oldById.set(oldInfo.id, oldInfo);
              this.allEvents.push(oldInfo);
            }
          }
          for (const gapiEvent of this.eventMap.values()) {
            try {
              const eventId = makeMessageId(this.convId, gapiEvent.id);
              if (gapiEvent.status === "cancelled") {
                this.modifiedEventMap.set(eventId, null);
                logic(this.ctx, "cancelled", { _event: gapiEvent });
                continue;
              }
              logic(this.ctx, "event", { _event: gapiEvent });
              let contentBlob, snippet, authoredBodySize, links, conference;
              const bodyReps = [];
              let description = gapiEvent.description;
              if (description) {
                description = description.trim().replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<wbr>/g, "");
                ({
                  contentBlob,
                  snippet,
                  authoredBodySize,
                  links,
                  conference
                } = await processEventContent({
                  data: gapiEvent,
                  content: description,
                  type: "html",
                  processAsText: true
                }));
                bodyReps.push(makeBodyPart({
                  type: "html",
                  part: null,
                  sizeEstimate: description.length,
                  amountDownloaded: description.length,
                  isDownloaded: true,
                  _partInfo: null,
                  contentBlob,
                  authoredBodySize
                }));
              }
              let startDate, endDate, isAllDay;
              if (!gapiEvent.start?.dateTime || !gapiEvent.end?.dateTime) {
                isAllDay = true;
                startDate = new Date(gapiEvent.start.date).valueOf();
                endDate = new Date(gapiEvent.end.date).valueOf();
              } else {
                isAllDay = false;
                startDate = new Date(gapiEvent.start.dateTime).valueOf();
                endDate = new Date(gapiEvent.end.dateTime).valueOf();
              }
              const summary = gapiEvent.summary;
              const creator = this._chewCalIdentity(gapiEvent.creator);
              const organizer = this._chewCalIdentity(gapiEvent.organizer);
              const location = gapiEvent.location || "";
              const attendees = (gapiEvent.attendees || []).map((who) => this._chewCalAttendee(who));
              const oldInfo = this.oldById.get(eventId);
              const eventInfo = makeCalendarEventInfo({
                id: eventId,
                date: startDate,
                startDate,
                endDate,
                isAllDay,
                creator,
                organizer,
                attendees,
                location,
                flags: oldInfo?.flags,
                folderIds: new Set([this.folderId]),
                summary,
                snippet,
                bodyReps,
                authoredBodySize,
                links,
                conference
              });
              this.allEvents.push(eventInfo);
              if (oldInfo) {
                this.modifiedEventMap.set(eventId, eventInfo);
              } else {
                this.newEvents.push(eventInfo);
              }
            } catch (ex) {
              logic(this.ctx, "eventChewingError", { ex });
            }
          }
        }
      };
    }
  });

  // src/backend/accounts/gapi/tasks/cal_sync_conv.js
  var cal_sync_conv_default;
  var init_cal_sync_conv = __esm({
    "src/backend/accounts/gapi/tasks/cal_sync_conv.js"() {
      init_logic();
      init_util();
      init_task_definer();
      init_conv_churn_driver();
      init_chew_gapi_cal_events();
      cal_sync_conv_default = task_definer_default.defineSimpleTask([
        {
          name: "cal_sync_conv",
          async plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];
            plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];
            await ctx.finishTask({
              taskState: plannedTask
            });
          },
          async execute(ctx, req) {
            let account = await ctx.universe.acquireAccount(ctx, req.accountId);
            let foldersTOC = await ctx.universe.acquireAccountFoldersTOC(ctx, account.id);
            let fromDb = await ctx.beginMutate({
              conversations: new Map([[req.convId, null]]),
              messagesByConversation: new Map([[req.convId, null]])
            });
            const oldEvents = fromDb.messagesByConversation.get(req.convId);
            const oldConvInfo = fromDb.conversations.get(req.convId);
            const eventChewer = new GapiCalEventChewer({
              ctx,
              convId: req.convId,
              folderId: req.folderId,
              rangeOldestTS: req.rangeOldestTS,
              rangeNewestTS: req.rangeNewestTS,
              eventMap: req.eventMap,
              oldConvInfo,
              oldEvents,
              foldersTOC
            });
            await eventChewer.chewEventBundle();
            logic(ctx, "debuggy", {
              eventMap: eventChewer.eventMap,
              allEvents: eventChewer.allEvents
            });
            let convInfo;
            if (eventChewer.allEvents.length) {
              convInfo = churnConversationDriver(req.convId, oldConvInfo, eventChewer.allEvents, "event");
            } else {
              convInfo = null;
            }
            let modifiedConversations, newConversations;
            if (oldConvInfo) {
              modifiedConversations = new Map([[req.convId, convInfo]]);
            } else if (convInfo) {
              newConversations = [convInfo];
            }
            await ctx.finishTask({
              mutations: {
                conversations: modifiedConversations,
                messages: eventChewer.modifiedEventMap
              },
              newData: {
                conversations: newConversations,
                messages: eventChewer.newEvents
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/accounts/gapi/cal_folder_sync_state_helper.js
  var GapiCalFolderSyncStateHelper;
  var init_cal_folder_sync_state_helper = __esm({
    "src/backend/accounts/gapi/cal_folder_sync_state_helper.js"() {
      init_logic();
      init_date();
      init_id_conversions();
      GapiCalFolderSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId, folderId, why) {
          logic.defineScope(this, "GapiSyncState", { ctxId: ctx.id, why });
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {
              syncToken: null,
              etag: null,
              calUpdatedTS: null,
              rangeOldestTS: makeDaysAgo(15),
              rangeNewestTS: makeDaysAgo(-60)
            };
          }
          this._accountId = accountId;
          this._folderId = folderId;
          this.rawSyncState = rawSyncState;
          this.eventChangesByRecurringEventId = new Map();
          this.tasksToSchedule = [];
          this.convMutations = null;
        }
        get syncToken() {
          return this.rawSyncState.syncToken;
        }
        set syncToken(nextSyncToken) {
          this.rawSyncState.syncToken = nextSyncToken;
        }
        get etag() {
          return this.rawSyncState.etag;
        }
        set etag(etag) {
          this.rawSyncState.etag = etag;
        }
        set updatedTime(updatedTimeDateStr) {
          this.rawSyncState.calUpdatedTS = Date.parse(updatedTimeDateStr);
        }
        get timeMinDateStr() {
          return new Date(this.rawSyncState.rangeOldestTS).toISOString();
        }
        get timeMaxDateStr() {
          return new Date(this.rawSyncState.rangeNewestTS).toISOString();
        }
        _makeUidConvTask({
          convId,
          eventMap,
          calUpdatedTS,
          rangeOldestTS,
          rangeNewestTS
        }) {
          let task = {
            type: "cal_sync_conv",
            accountId: this._accountId,
            folderId: this._folderId,
            convId,
            calUpdatedTS,
            rangeOldestTS,
            rangeNewestTS,
            eventMap
          };
          this.tasksToSchedule.push(task);
          return task;
        }
        ingestEvent(event) {
          const recurringId = event.recurringEventId || event.id;
          let eventMap = this.eventChangesByRecurringEventId.get(recurringId);
          if (!eventMap) {
            eventMap = new Map();
            this.eventChangesByRecurringEventId.set(recurringId, eventMap);
          }
          eventMap.set(event.id, event);
        }
        processEvents() {
          for (const [
            recurringId,
            eventMap
          ] of this.eventChangesByRecurringEventId.entries()) {
            const convId = makeFolderNamespacedConvId(this._folderId, recurringId);
            this._makeUidConvTask({
              convId,
              eventMap,
              calUpdatedTS: this.rawSyncState.calUpdatedTS,
              rangeOldestTS: this.rawSyncState.rangeOldestTS,
              rangeNewestTS: this.rawSyncState.rangeNewestTS
            });
          }
        }
      };
    }
  });

  // src/backend/accounts/gapi/tasks/cal_sync_refresh.js
  var cal_sync_refresh_default;
  var init_cal_sync_refresh = __esm({
    "src/backend/accounts/gapi/tasks/cal_sync_refresh.js"() {
      init_logic();
      init_util();
      init_date();
      init_task_definer();
      init_sync_overlay_helpers();
      init_cal_folder_sync_state_helper();
      cal_sync_refresh_default = task_definer_default.defineAtMostOnceTask([
        {
          name: "sync_refresh",
          binByArg: "folderId",
          helped_overlay_folders: syncNormalOverlay,
          helped_invalidate_overlays(folderId, dataOverlayManager) {
            dataOverlayManager.announceUpdatedOverlayData("folders", folderId);
          },
          helped_already_planned(ctx, rawTask) {
            return Promise.resolve({
              result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.folderId)
            });
          },
          helped_plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.resources = [
              "online",
              `credentials!${rawTask.accountId}`,
              `happy!${rawTask.accountId}`
            ];
            plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];
            let groupPromise = ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.folderId);
            return {
              taskState: plannedTask,
              remainInProgressUntil: groupPromise,
              result: groupPromise
            };
          },
          async helped_execute(ctx, req) {
            const fromDb = await ctx.beginMutate({
              syncStates: new Map([[req.folderId, null]])
            });
            const rawSyncState = fromDb.syncStates.get(req.folderId);
            const syncState = new GapiCalFolderSyncStateHelper(ctx, rawSyncState, req.accountId, req.folderId, "refresh");
            const account = await ctx.universe.acquireAccount(ctx, req.accountId);
            const folderInfo = account.foldersTOC.foldersById.get(req.folderId);
            const calendarId = folderInfo.serverId;
            let syncDate = NOW();
            logic(ctx, "syncStart", { syncDate });
            const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
            let params;
            if (syncState.syncToken) {
              params = {
                syncToken: syncState.syncToken
              };
            } else {
              params = {
                singleEvents: true,
                timeMin: syncState.timeMinDateStr,
                timeMax: syncState.timeMaxDateStr
              };
            }
            params.maxAttendees = 50;
            const results = await account.client.pagedApiGetCall(endpoint, params, "items", (result) => result.nextPageToken ? {
              params: { pageToken: result.nextPageToken }
            } : null);
            for (const event of results.items) {
              syncState.ingestEvent(event);
            }
            syncState.syncToken = results.nextSyncToken;
            syncState.etag = results.etag;
            syncState.updatedTime = results.updatedTime;
            syncState.processEvents();
            logic(ctx, "syncEnd", {});
            return {
              mutations: {
                syncStates: new Map([[req.folderId, syncState.rawSyncState]])
              },
              newData: {
                tasks: syncState.tasksToSchedule
              },
              atomicClobbers: {
                folders: new Map([
                  [
                    req.folderId,
                    {
                      syncInfo: {
                        lastSuccessfulSyncAt: syncDate,
                        lastAttemptedSyncAt: syncDate,
                        failedSyncsSinceLastSuccessfulSync: 0
                      }
                    }
                  ]
                ])
              }
            };
          }
        }
      ]);
    }
  });

  // src/backend/tasks/folder_modify.js
  var CommonFolderModify;
  var init_folder_modify = __esm({
    "src/backend/tasks/folder_modify.js"() {
      init_logic();
      init_task_definer();
      CommonFolderModify = task_definer_default.defineSimpleTask([
        {
          name: "folder_modify",
          async plan(ctx, rawTask) {
            const { mods } = rawTask;
            const folders = new Map();
            const folderClobbers = new Map();
            for (const [folderId, actions] of Object.entries(mods.actions)) {
              const folderDef = await ctx.readSingle("folders", folderId);
              const tags = folderDef.tags || [];
              for (const [key, val] of Object.entries(actions)) {
                switch (key) {
                  case "addtag":
                    {
                      const prevLength = tags.length;
                      for (const tag of val) {
                        if (!tags.includes(tag)) {
                          tags.push(tag);
                        }
                      }
                      if (tags.length !== prevLength) {
                        folderClobbers.set(["tags"], tags);
                      }
                    }
                    break;
                  case "rmtag":
                    {
                      const prevLength = tags.length;
                      for (const tag of val) {
                        const idx = tags.indexOf(tag);
                        if (idx !== -1) {
                          tags.splice(idx, 1);
                        }
                      }
                      if (tags.length !== prevLength) {
                        folderClobbers.set(["tags"], tags);
                      }
                    }
                    break;
                  default:
                    logic(ctx, "badModifyFolderKey", { key });
                    break;
                }
              }
              if (folderClobbers.size) {
                folders.set(folderId, folderClobbers);
              }
            }
            await ctx.finishTask({
              atomicClobbers: {
                folders
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/accounts/gapi/gapi_tasks.js
  var gapi_tasks_exports = {};
  __export(gapi_tasks_exports, {
    default: () => gapi_tasks_default
  });
  var gapi_tasks_default;
  var init_gapi_tasks = __esm({
    "src/backend/accounts/gapi/gapi_tasks.js"() {
      init_sync_folder_list2();
      init_cal_sync_conv();
      init_cal_sync_refresh();
      init_account_modify();
      init_folder_modify();
      init_identity_modify();
      init_new_tracking();
      gapi_tasks_default = [
        sync_folder_list_default2,
        cal_sync_conv_default,
        cal_sync_refresh_default,
        account_modify_default,
        CommonFolderModify,
        identity_modify_default,
        new_tracking_default
      ];
    }
  });

  // src/backend/accounts/mapi/account_sync_state_helper.js
  var MapiAccountSyncStateHelper;
  var init_account_sync_state_helper2 = __esm({
    "src/backend/accounts/mapi/account_sync_state_helper.js"() {
      init_logic();
      MapiAccountSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId) {
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {};
          }
          this._ctx = ctx;
          this._accountId = accountId;
          this.rawSyncState = rawSyncState;
        }
      };
    }
  });

  // src/backend/accounts/mapi/tasks/sync_folder_list.js
  var sync_folder_list_default3;
  var init_sync_folder_list3 = __esm({
    "src/backend/accounts/mapi/tasks/sync_folder_list.js"() {
      init_task_definer();
      init_mix_sync_folder_list();
      init_folder_info_rep();
      init_account_sync_state_helper2();
      sync_folder_list_default3 = task_definer_default.defineSimpleTask([
        mix_sync_folder_list_default,
        {
          essentialOfflineFolders: [],
          async syncFolders(ctx, account) {
            const fromDb = await ctx.beginMutate({
              syncStates: new Map([[account.id, null]])
            });
            const rawSyncState = fromDb.syncStates.get(account.id);
            const syncState = new MapiAccountSyncStateHelper(ctx, rawSyncState, account.id);
            const foldersTOC = account.foldersTOC;
            const clResult = await account.client.pagedApiGetCall("https://graph.microsoft.com/v1.0/me/calendars", {}, "value", (result) => {
            });
            const newFolders = [];
            const modifiedFolders = new Map();
            const observedFolderServerIds = new Set();
            for (const calInfo of clResult.value) {
              observedFolderServerIds.add(calInfo.id);
              const desiredCalendarInfo = {
                color: calInfo.hexColor || null
              };
              let calFolder = foldersTOC.items.find((f) => f.serverId === calInfo.id);
              if (!calFolder) {
                const name = calInfo.name || "unknown";
                calFolder = makeFolderMeta({
                  id: foldersTOC.issueFolderId(),
                  serverId: calInfo.id,
                  name,
                  description: name,
                  type: "calendar",
                  path: null,
                  serverPath: null,
                  parentId: null,
                  delim: null,
                  depth: 0,
                  syncGranularity: "folder",
                  calendarInfo: desiredCalendarInfo
                });
                newFolders.push(calFolder);
              } else {
                let modified = false;
                if (calFolder.name !== calInfo.name) {
                  calFolder.name = calFolder.description = calInfo.name;
                  modified = true;
                }
                for (const [dkey, dvalue] of Object.entries(desiredCalendarInfo)) {
                  if (calFolder.calendarInfo[dkey] !== dvalue) {
                    calFolder.calendarInfo[dkey] = dvalue;
                    modified = true;
                  }
                }
                if (modified) {
                  modifiedFolders.set(calFolder.id, calFolder);
                }
              }
            }
            for (const folderInfo of foldersTOC.items.filter((x) => x.type === "calendar")) {
              if (!observedFolderServerIds.has(folderInfo.serverId)) {
                modifiedFolders.set(folderInfo.id, null);
              }
            }
            return {
              newFolders,
              modifiedFolders,
              modifiedSyncStates: new Map([[account.id, syncState.rawSyncState]])
            };
          }
        }
      ]);
    }
  });

  // src/backend/accounts/mapi/chew_mapi_cal_events.js
  var MapiCalEventChewer;
  var init_chew_mapi_cal_events = __esm({
    "src/backend/accounts/mapi/chew_mapi_cal_events.js"() {
      init_mail_rep();
      init_mailchew();
      init_date();
      init_id_conversions();
      init_cal_event_rep();
      init_logic();
      MapiCalEventChewer = class {
        constructor({
          ctx,
          convId,
          recurringId,
          folderId,
          rangeOldestTS,
          rangeNewestTS,
          eventMap,
          oldConvInfo,
          oldEvents,
          foldersTOC
        }) {
          this.ctx = ctx;
          this.convId = convId;
          this.recurringId = recurringId;
          this.folderId = folderId;
          this.rangeOldestTS = rangeOldestTS;
          this.rangeNewestTS = rangeNewestTS;
          this.eventMap = eventMap;
          this.oldConvInfo = oldConvInfo;
          this.oldEvents = oldEvents;
          this.foldersTOC = foldersTOC;
          this.oldById = new Map();
          this.unifiedEvents = [];
          this.modifiedEventMap = new Map();
          this.newEvents = [];
          this.allEvents = [];
        }
        _chewCalIdentity(raw) {
          const email = raw.emailAddress;
          return makeIdentityInfo({
            displayName: email.name,
            email: email.address,
            isSelf: false
          });
        }
        _chewCalAttendee(raw, organizer) {
          const email = raw.emailAddress;
          const type = raw.type;
          return makeAttendeeInfo({
            displayName: email.name,
            email: email.address,
            isSelf: false,
            isOrganizer: email.address === organizer.email && email.name === organizer.displayName,
            isResource: type === "resource",
            responseStatus: raw.status,
            comment: "",
            isOptional: type === "optional"
          });
        }
        async chewEventBundle() {
          const oldById = this.oldById;
          for (const oldInfo of this.oldEvents) {
            if (EVENT_OUTSIDE_SYNC_RANGE(oldInfo, this)) {
              this.modifiedEventMap.set(oldInfo.id, null);
            } else {
              oldById.set(oldInfo.id, oldInfo);
              this.allEvents.push(oldInfo);
            }
          }
          let mainEvent = null;
          if (this.eventMap.size > 1) {
            mainEvent = this.eventMap.get(this.recurringId);
            this.eventMap.delete(this.recurringId);
          }
          for (const mapiEvent of this.eventMap.values()) {
            try {
              const eventId = makeMessageId(this.convId, mapiEvent.id);
              if (mainEvent && mapiEvent !== mainEvent) {
                for (const [key, value] of Object.entries(mainEvent)) {
                  if (!(key in mapiEvent)) {
                    mapiEvent[key] = value;
                  }
                }
              }
              if (mapiEvent.isCancelled) {
                this.modifiedEventMap.set(eventId, null);
                logic(this.ctx, "cancelled", { _event: mapiEvent });
                return;
              }
              logic(this.ctx, "event", { _event: mapiEvent });
              let contentBlob, snippet, authoredBodySize, links, conference;
              const bodyReps = [];
              const body = mapiEvent.body;
              if (body?.content) {
                const { content, contentType: type } = body;
                ({
                  contentBlob,
                  snippet,
                  authoredBodySize,
                  links,
                  conference
                } = await processEventContent({
                  data: mapiEvent,
                  content,
                  type
                }));
                bodyReps.push(makeBodyPart({
                  type,
                  part: null,
                  sizeEstimate: content.length,
                  amountDownloaded: content.length,
                  isDownloaded: true,
                  _partInfo: null,
                  contentBlob,
                  authoredBodySize
                }));
              }
              const isAllDay = mapiEvent.isAllDay;
              const startDate = new Date(mapiEvent.start.dateTime + "Z").valueOf();
              const endDate = new Date(mapiEvent.end.dateTime + "Z").valueOf();
              const summary = mapiEvent.subject;
              const organizer = this._chewCalIdentity(mapiEvent.organizer);
              const creator = organizer;
              const eventLocation = mapiEvent.location;
              const location = `${eventLocation.displayName}@${eventLocation.address}`;
              const attendees = (mapiEvent.attendees || []).map((who) => {
                return this._chewCalAttendee(who, organizer);
              });
              const oldInfo = this.oldById.get(eventId);
              const eventInfo = makeCalendarEventInfo({
                id: eventId,
                date: startDate,
                startDate,
                endDate,
                isAllDay,
                creator,
                organizer,
                attendees,
                location,
                flags: oldInfo?.flags,
                folderIds: new Set([this.folderId]),
                summary,
                snippet,
                bodyReps,
                authoredBodySize,
                links,
                conference
              });
              this.allEvents.push(eventInfo);
              if (oldInfo) {
                this.modifiedEventMap.set(eventId, eventInfo);
              } else {
                this.newEvents.push(eventInfo);
              }
            } catch (ex) {
              logic(this.ctx, "eventChewingError", { ex });
            }
          }
        }
      };
    }
  });

  // src/backend/accounts/mapi/tasks/cal_sync_conv.js
  var cal_sync_conv_default2;
  var init_cal_sync_conv2 = __esm({
    "src/backend/accounts/mapi/tasks/cal_sync_conv.js"() {
      init_logic();
      init_util();
      init_task_definer();
      init_conv_churn_driver();
      init_chew_mapi_cal_events();
      cal_sync_conv_default2 = task_definer_default.defineSimpleTask([
        {
          name: "cal_sync_conv",
          async plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];
            plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];
            await ctx.finishTask({
              taskState: plannedTask
            });
          },
          async execute(ctx, req) {
            let account = await ctx.universe.acquireAccount(ctx, req.accountId);
            let foldersTOC = await ctx.universe.acquireAccountFoldersTOC(ctx, account.id);
            let fromDb = await ctx.beginMutate({
              conversations: new Map([[req.convId, null]]),
              messagesByConversation: new Map([[req.convId, null]])
            });
            const oldEvents = fromDb.messagesByConversation.get(req.convId);
            const oldConvInfo = fromDb.conversations.get(req.convId);
            const eventChewer = new MapiCalEventChewer({
              ctx,
              convId: req.convId,
              recurringId: req.recurringId,
              folderId: req.folderId,
              rangeOldestTS: req.rangeOldestTS,
              rangeNewestTS: req.rangeNewestTS,
              eventMap: req.eventMap,
              oldConvInfo,
              oldEvents,
              foldersTOC
            });
            await eventChewer.chewEventBundle();
            logic(ctx, "debuggy", {
              event: eventChewer.event,
              allEvents: eventChewer.allEvents
            });
            let convInfo;
            if (eventChewer.allEvents.length) {
              convInfo = churnConversationDriver(req.convId, oldConvInfo, eventChewer.allEvents, "event");
            } else {
              convInfo = null;
            }
            let modifiedConversations, newConversations;
            if (oldConvInfo) {
              modifiedConversations = new Map([[req.convId, convInfo]]);
            } else if (convInfo) {
              newConversations = [convInfo];
            }
            await ctx.finishTask({
              mutations: {
                conversations: modifiedConversations,
                messages: eventChewer.modifiedEventMap
              },
              newData: {
                conversations: newConversations,
                messages: eventChewer.newEvents
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/accounts/mapi/cal_folder_sync_state_helper.js
  var MapiCalFolderSyncStateHelper;
  var init_cal_folder_sync_state_helper2 = __esm({
    "src/backend/accounts/mapi/cal_folder_sync_state_helper.js"() {
      init_logic();
      init_date();
      init_id_conversions();
      MapiCalFolderSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId, folderId, why) {
          logic.defineScope(this, "MapiSyncState", { ctxId: ctx.id, why });
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {
              syncUrl: null,
              calUpdatedTS: null,
              rangeOldestTS: makeDaysAgo(15),
              rangeNewestTS: makeDaysAgo(-60)
            };
          }
          this._accountId = accountId;
          this._folderId = folderId;
          this.rawSyncState = rawSyncState;
          this.eventChangesByRecurringEventId = new Map();
          this.allEvents = [];
          this.tasksToSchedule = [];
          this.convMutations = null;
        }
        get syncUrl() {
          return this.rawSyncState.syncUrl;
        }
        set syncUrl(nextSyncUrl) {
          this.rawSyncState.syncUrl = nextSyncUrl;
        }
        set updatedTime(updatedTimeDateStr) {
          this.rawSyncState.calUpdatedTS = Date.parse(updatedTimeDateStr);
        }
        get timeMinDateStr() {
          return new Date(this.rawSyncState.rangeOldestTS).toISOString();
        }
        get timeMaxDateStr() {
          return new Date(this.rawSyncState.rangeNewestTS).toISOString();
        }
        _makeUidConvTask({
          convId,
          recurringId,
          eventMap,
          calUpdatedTS,
          rangeOldestTS,
          rangeNewestTS
        }) {
          const task = {
            type: "cal_sync_conv",
            accountId: this._accountId,
            folderId: this._folderId,
            convId,
            recurringId,
            calUpdatedTS,
            rangeOldestTS,
            rangeNewestTS,
            eventMap
          };
          this.tasksToSchedule.push(task);
          return task;
        }
        ingestEvent(event) {
          const recurringId = event.seriesMasterId || event.id;
          let eventMap = this.eventChangesByRecurringEventId.get(recurringId);
          if (!eventMap) {
            eventMap = new Map();
            this.eventChangesByRecurringEventId.set(recurringId, eventMap);
          }
          eventMap.set(event.id, event);
        }
        processEvents() {
          for (const [
            recurringId,
            eventMap
          ] of this.eventChangesByRecurringEventId.entries()) {
            const convId = makeFolderNamespacedConvId(this._folderId, recurringId);
            this._makeUidConvTask({
              convId,
              recurringId,
              eventMap,
              calUpdatedTS: this.rawSyncState.calUpdatedTS,
              rangeOldestTS: this.rawSyncState.rangeOldestTS,
              rangeNewestTS: this.rawSyncState.rangeNewestTS
            });
          }
        }
      };
    }
  });

  // src/backend/accounts/mapi/tasks/cal_sync_refresh.js
  var cal_sync_refresh_default2;
  var init_cal_sync_refresh2 = __esm({
    "src/backend/accounts/mapi/tasks/cal_sync_refresh.js"() {
      init_logic();
      init_util();
      init_date();
      init_task_definer();
      init_sync_overlay_helpers();
      init_cal_folder_sync_state_helper2();
      cal_sync_refresh_default2 = task_definer_default.defineAtMostOnceTask([
        {
          name: "sync_refresh",
          binByArg: "folderId",
          helped_overlay_folders: syncNormalOverlay,
          helped_invalidate_overlays(folderId, dataOverlayManager) {
            dataOverlayManager.announceUpdatedOverlayData("folders", folderId);
          },
          helped_already_planned(ctx, rawTask) {
            return Promise.resolve({
              result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.folderId)
            });
          },
          helped_plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.resources = [
              "online",
              `credentials!${rawTask.accountId}`,
              `happy!${rawTask.accountId}`
            ];
            plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];
            let groupPromise = ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.folderId);
            return {
              taskState: plannedTask,
              remainInProgressUntil: groupPromise,
              result: groupPromise
            };
          },
          async helped_execute(ctx, req) {
            const fromDb = await ctx.beginMutate({
              syncStates: new Map([[req.folderId, null]])
            });
            const rawSyncState = fromDb.syncStates.get(req.folderId);
            const syncState = new MapiCalFolderSyncStateHelper(ctx, rawSyncState, req.accountId, req.folderId, "refresh");
            const account = await ctx.universe.acquireAccount(ctx, req.accountId);
            const folderInfo = account.foldersTOC.foldersById.get(req.folderId);
            const calendarId = folderInfo.serverId;
            let syncDate = NOW();
            logic(ctx, "syncStart", { syncDate });
            const params = Object.create(null);
            let endpoint;
            if (syncState.syncUrl) {
              endpoint = syncState.syncUrl;
            } else {
              endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta`;
              if (syncState.timeMinDateStr && syncState.timeMaxDateStr) {
                params.startDateTime = syncState.timeMinDateStr;
                params.endDateTime = syncState.timeMaxDateStr;
              }
            }
            const results = await account.client.pagedApiGetCall(endpoint, params, "value", (result) => result["@odata.nextLink"] ? {
              url: result["@odata.nextLink"]
            } : null);
            for (const event of results.value) {
              syncState.ingestEvent(event);
            }
            syncState.syncUrl = results["@odata.deltaLink"];
            syncState.updatedTime = results.updatedTime;
            syncState.updatedTime = syncDate;
            syncState.processEvents();
            logic(ctx, "syncEnd", {});
            return {
              mutations: {
                syncStates: new Map([[req.folderId, syncState.rawSyncState]])
              },
              newData: {
                tasks: syncState.tasksToSchedule
              },
              atomicClobbers: {
                folders: new Map([
                  [
                    req.folderId,
                    {
                      syncInfo: {
                        lastSuccessfulSyncAt: syncDate,
                        lastAttemptedSyncAt: syncDate,
                        failedSyncsSinceLastSuccessfulSync: 0
                      }
                    }
                  ]
                ])
              }
            };
          }
        }
      ]);
    }
  });

  // src/backend/accounts/mapi/mapi_tasks.js
  var mapi_tasks_exports = {};
  __export(mapi_tasks_exports, {
    default: () => mapi_tasks_default
  });
  var mapi_tasks_default;
  var init_mapi_tasks = __esm({
    "src/backend/accounts/mapi/mapi_tasks.js"() {
      init_sync_folder_list3();
      init_cal_sync_conv2();
      init_cal_sync_refresh2();
      init_account_modify();
      init_folder_modify();
      init_identity_modify();
      init_new_tracking();
      mapi_tasks_default = [
        sync_folder_list_default3,
        cal_sync_conv_default2,
        cal_sync_refresh_default2,
        account_modify_default,
        CommonFolderModify,
        identity_modify_default,
        new_tracking_default
      ];
    }
  });

  // src/backend/accounts/ical/tasks/sync_folder_list.js
  var sync_folder_list_default4;
  var init_sync_folder_list4 = __esm({
    "src/backend/accounts/ical/tasks/sync_folder_list.js"() {
      init_task_definer();
      init_mix_sync_folder_list();
      sync_folder_list_default4 = task_definer_default.defineSimpleTask([
        mix_sync_folder_list_default,
        {
          essentialOfflineFolders: [
            {
              type: "calendar",
              displayName: "Events"
            }
          ],
          async syncFolders() {
            return {
              newFolders: void 0,
              newTasks: void 0,
              modifiedFolders: void 0,
              modifiedSyncStates: void 0
            };
          }
        }
      ]);
    }
  });

  // src/backend/accounts/ical/chew_event_bundle.js
  var import_ical2, RecurringEventBundleChewer;
  var init_chew_event_bundle = __esm({
    "src/backend/accounts/ical/chew_event_bundle.js"() {
      import_ical2 = __toModule(require_ical());
      init_mail_rep();
      init_mailchew();
      init_cal_event_rep();
      RecurringEventBundleChewer = class {
        constructor({
          convId,
          uid,
          rangeOldestTS,
          rangeNewestTS,
          jcalEvents,
          oldConvInfo,
          oldEvents,
          foldersTOC
        }) {
          this.convId = convId;
          this.uid = uid;
          this.rangeOldestTS = rangeOldestTS;
          this.rangeNewestTS = rangeNewestTS;
          this.jcalEvents = jcalEvents;
          this.oldConvInfo = oldConvInfo;
          this.oldEvents = oldEvents;
          this.foldersTOC = foldersTOC;
          this.calendarFolder = foldersTOC.getCanonicalFolderByType("calendar");
          const oldById = this.oldById = new Map();
          for (const old of oldEvents) {
            oldById.set(old.id, old);
          }
          this.unifiedEvents = [];
          this.contentsChanged = true;
          this.modifiedEventMap = new Map();
          this.newEvents = [];
          this.allEvents = [];
        }
        async chewEventBundle() {
          if (!this.jcalEvents.length) {
            return;
          }
          this.rootComponent = new import_ical2.default.Component(["vcalendar", [], this.jcalEvents]);
          const rootEvent = new import_ical2.default.Event(this.rootComponent.getFirstSubcomponent());
          if (!rootEvent.isRecurring()) {
            if (rootEvent.endDate.toJSDate().valueOf() < this.rangeOldestTS || rootEvent.startDate.toJSDate().valueOf() > this.rangeNewestTS) {
              return;
            }
            const fakeOccur = {
              recurrenceId: rootEvent.startDate,
              item: rootEvent,
              startDate: rootEvent.startDate,
              endDate: rootEvent.endDate
            };
            await this._chewOccurrence(fakeOccur);
          } else {
            const calIter = rootEvent.iterator();
            let stepCount = 0;
            const promises = [];
            for (calIter.next(); calIter.complete === false && stepCount < 1024 && calIter.last.toJSDate().valueOf() <= this.rangeNewestTS; calIter.next(), stepCount++) {
              const curOccur = calIter.last;
              const occurInfo = rootEvent.getOccurrenceDetails(curOccur);
              if (occurInfo.endDate.toJSDate().valueOf() < this.rangeOldestTS || occurInfo.startDate.toJSDate().valueOf() > this.rangeNewestTS) {
                continue;
              }
              promises.push(this._chewOccurrence(occurInfo));
            }
            await Promise.all(promises);
          }
        }
        _chewCalIdentity(calAddress) {
          if (!calAddress) {
            return {
              displayName: "Omitted",
              email: ""
            };
          }
          const cn = calAddress.getParameter("cn");
          const mailto = calAddress.getFirstValue().replace(/^mailto:/g, "");
          return makeAttendeeInfo({
            displayName: cn,
            email: mailto
          });
        }
        async _chewOccurrence({ recurrenceId, item, startDate, endDate }) {
          const msgId = `${this.convId}.${recurrenceId}.0`;
          const component = item.component;
          if (!this.contentsChanged && this.oldById.has(msgId)) {
            const oldInfo = this.oldById.get(msgId);
            this.allEvents.push(oldInfo);
            return;
          }
          let contentBlob, snippet, authoredBodySize;
          let bodyReps = [];
          let location = null;
          if (component.hasProperty("location")) {
            location = component.getFirstPropertyValue("location");
          }
          let description = component.getFirstPropertyValue("description");
          if (description) {
            description = description.replace(/\\n/g, "\n");
            ({ contentBlob, snippet, authoredBodySize } = await processMessageContent(description, "html", true, true));
            bodyReps.push(makeBodyPart({
              type: "html",
              part: null,
              sizeEstimate: description.length,
              amountDownloaded: description.length,
              isDownloaded: true,
              _partInfo: null,
              contentBlob,
              authoredBodySize
            }));
          }
          const summary = component.getFirstPropertyValue("summary");
          const organizer = this._chewCalIdentity(component.getFirstProperty("organizer"));
          const attendees = component.getAllProperties("attendee").map((who) => this._chewCalIdentity(who));
          const eventInfo = makeCalendarEventInfo({
            id: msgId,
            date: startDate.toJSDate().valueOf(),
            startDate: startDate.toJSDate().valueOf(),
            endDate: endDate.toJSDate().valueOf(),
            isAllDay: startDate.isDate,
            creator: organizer,
            organizer,
            attendees,
            location,
            flags: [],
            folderIds: new Set([this.calendarFolder.id]),
            summary,
            snippet,
            bodyReps,
            authoredBodySize
          });
          this.allEvents.push(eventInfo);
          if (this.oldById.has(msgId)) {
            this.modifiedEventMap.set(msgId, eventInfo);
          } else {
            this.newEvents.push(eventInfo);
          }
        }
      };
    }
  });

  // src/backend/accounts/ical/tasks/sync_uid.js
  var sync_uid_default;
  var init_sync_uid = __esm({
    "src/backend/accounts/ical/tasks/sync_uid.js"() {
      init_util();
      init_date_priority_adjuster();
      init_task_definer();
      init_conv_churn_driver();
      init_chew_event_bundle();
      sync_uid_default = task_definer_default.defineSimpleTask([
        {
          name: "sync_uid",
          async plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];
            plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];
            if (rawTask.mostRecent) {
              plannedTask.relPriority = prioritizeNewer(rawTask.mostRecent);
            }
            await ctx.finishTask({
              taskState: plannedTask
            });
          },
          async execute(ctx, req) {
            let account = await ctx.universe.acquireAccount(ctx, req.accountId);
            let foldersTOC = await ctx.universe.acquireAccountFoldersTOC(ctx, account.id);
            let fromDb = await ctx.beginMutate({
              conversations: new Map([[req.convId, null]]),
              messagesByConversation: new Map([[req.convId, null]])
            });
            const oldEvents = fromDb.messagesByConversation.get(req.convId);
            const oldConvInfo = fromDb.conversations.get(req.convId);
            const eventChewer = new RecurringEventBundleChewer({
              convId: req.convId,
              uid: req.uid,
              rangeOldestTS: req.rangeOldestTS,
              rangeNewestTS: req.rangeNewestTS,
              jcalEvents: req.jcalEvents,
              oldConvInfo,
              oldEvents,
              foldersTOC
            });
            await eventChewer.chewEventBundle();
            let convInfo;
            if (eventChewer.allEvents.length) {
              convInfo = churnConversationDriver(req.convId, oldConvInfo, eventChewer.allEvents);
            } else {
              convInfo = null;
            }
            let modifiedConversations, newConversations;
            if (oldConvInfo) {
              modifiedConversations = new Map([[req.convId, convInfo]]);
            } else if (convInfo) {
              newConversations = [convInfo];
            }
            await ctx.finishTask({
              mutations: {
                conversations: modifiedConversations,
                messages: eventChewer.modifiedEventMap
              },
              newData: {
                conversations: newConversations,
                messages: eventChewer.newEvents
              }
            });
          }
        }
      ]);
    }
  });

  // src/backend/accounts/ical/sync_state_helper.js
  var ICalSyncStateHelper;
  var init_sync_state_helper2 = __esm({
    "src/backend/accounts/ical/sync_state_helper.js"() {
      init_logic();
      init_a64();
      init_date();
      ICalSyncStateHelper = class {
        constructor(ctx, rawSyncState, accountId, why) {
          logic.defineScope(this, "ICalSyncState", { ctxId: ctx.id, why });
          if (!rawSyncState) {
            logic(ctx, "creatingDefaultSyncState", {});
            rawSyncState = {
              nextConvId: 1,
              rangeOldestTS: makeDaysAgo(30),
              rangeNewestTS: makeDaysAgo(-30),
              uidToConvIdAndLastModified: new Map()
            };
          }
          this._accountId = accountId;
          this.rawSyncState = rawSyncState;
          this.uidToConvIdAndLastModified = rawSyncState.uidToConvIdAndLastModified;
          this.unseenUids = new Set(rawSyncState.uidToConvIdAndLastModified.keys());
          this.eventsByUid = new Map();
          this.tasksToSchedule = [];
          this.convMutations = null;
        }
        _makeUidConvTask({
          convId,
          uid,
          lastModifiedTS,
          jcalEvents,
          rangeOldestTS,
          rangeNewestTS
        }) {
          let task = {
            type: "sync_uid",
            accountId: this._accountId,
            convId,
            uid,
            lastModifiedTS,
            rangeOldestTS,
            rangeNewestTS,
            jcalEvents
          };
          this.tasksToSchedule.push(task);
          return task;
        }
        _issueUniqueConvId() {
          return this._accountId + "." + encodeInt(this.rawSyncState.nextConvId++);
        }
        ingestEvent(event) {
          const uid = event.getFirstPropertyValue("uid");
          let eventArray = this.eventsByUid.get(uid);
          if (!eventArray) {
            eventArray = [];
            this.eventsByUid.set(uid, eventArray);
          }
          eventArray.push(event);
        }
        processEvents() {
          for (const [uid, eventArray] of this.eventsByUid.entries()) {
            const event = eventArray[0];
            const lastModifiedDateTime = event.getFirstPropertyValue("last-modified");
            const lastModifiedTS = lastModifiedDateTime.toJSDate().valueOf();
            let existingSyncInfo = this.uidToConvIdAndLastModified.get(uid);
            let convId;
            let needsIndexing = false;
            if (!existingSyncInfo) {
              convId = this._issueUniqueConvId();
              this.uidToConvIdAndLastModified.set(uid, { convId, lastModifiedTS });
              needsIndexing = true;
            } else {
              this.unseenUids.delete(uid);
              convId = existingSyncInfo.convId;
              if (existingSyncInfo.lastModifiedTS !== lastModifiedTS) {
                needsIndexing = true;
                existingSyncInfo.lastModifiedTS = lastModifiedTS;
              }
            }
            if (needsIndexing) {
              eventArray.sort((cA, cB) => {
                const aVal = cA.hasProperty("recurrence-id") ? 1 : 0;
                const bVal = cB.hasProperty("recurrence-id") ? 1 : 0;
                return bVal - aVal;
              });
              const jcalEvents = eventArray.map((cEvent) => cEvent.toJSON());
              this._makeUidConvTask({
                convId,
                uid,
                lastModifiedTS,
                jcalEvents,
                rangeOldestTS: this.rawSyncState.rangeOldestTS,
                rangeNewestTS: this.rawSyncState.rangeNewestTS
              });
            }
          }
          if (this.unseenUids.size) {
            this.convMutations = new Map();
            for (const uid of this.unseenUids) {
              const existingSyncInfo = this.uidToConvIdAndLastModified.get(uid);
              this.uidToConvIdAndLastModified.delete(uid);
              this._makeUidConvTask({
                convId: existingSyncInfo.convId,
                uid,
                lastModifiedTS: 0,
                jcalEvents: [],
                rangeOldestTS: this.rawSyncState.rangeOldestTS,
                rangeNewestTS: this.rawSyncState.rangeNewestTS
              });
            }
          }
        }
      };
    }
  });

  // src/backend/accounts/ical/tasks/sync_refresh.js
  var import_ical3, sync_refresh_default2;
  var init_sync_refresh2 = __esm({
    "src/backend/accounts/ical/tasks/sync_refresh.js"() {
      init_logic();
      import_ical3 = __toModule(require_ical());
      init_util();
      init_date();
      init_task_definer();
      init_sync_state_helper2();
      init_id_conversions();
      init_sync_overlay_helpers();
      sync_refresh_default2 = task_definer_default.defineAtMostOnceTask([
        {
          name: "sync_refresh",
          binByArg: "accountId",
          helped_overlay_accounts: syncNormalOverlay,
          helped_prefix_overlay_folders: [accountIdFromFolderId, syncPrefixOverlay],
          helped_invalidate_overlays(accountId, dataOverlayManager) {
            dataOverlayManager.announceUpdatedOverlayData("accounts", accountId);
            dataOverlayManager.announceUpdatedOverlayData("accountCascadeToFolders", accountId);
          },
          helped_already_planned(ctx, rawTask) {
            return Promise.resolve({
              result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.accountId)
            });
          },
          helped_plan(ctx, rawTask) {
            let plannedTask = shallowClone2(rawTask);
            plannedTask.resources = [
              "online",
              `credentials!${rawTask.accountId}`,
              `happy!${rawTask.accountId}`
            ];
            plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];
            let groupPromise = ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.accountId);
            return Promise.resolve({
              taskState: plannedTask,
              remainInProgressUntil: groupPromise,
              result: groupPromise
            });
          },
          async helped_execute(ctx, req) {
            let fromDb = await ctx.beginMutate({
              syncStates: new Map([[req.accountId, null]])
            });
            let rawSyncState = fromDb.syncStates.get(req.accountId);
            let syncState = new ICalSyncStateHelper(ctx, rawSyncState, req.accountId, "refresh");
            let account = await ctx.universe.acquireAccount(ctx, req.accountId);
            let syncDate = NOW();
            logic(ctx, "syncStart", { syncDate });
            const icalResp = await fetch(account.calendarUrl);
            const icalText = await icalResp.text();
            const parsed = import_ical3.default.parse(icalText);
            const root = new import_ical3.default.Component(parsed);
            for (const event of root.getAllSubcomponents("vevent")) {
              syncState.ingestEvent(event);
            }
            syncState.processEvents();
            logic(ctx, "syncEnd", {});
            return {
              mutations: {
                syncStates: new Map([[req.accountId, syncState.rawSyncState]])
              },
              newData: {
                tasks: syncState.tasksToSchedule
              },
              atomicClobbers: {
                accounts: new Map([
                  [
                    req.accountId,
                    {
                      syncInfo: {
                        lastSuccessfulSyncAt: syncDate,
                        lastAttemptedSyncAt: syncDate,
                        failedSyncsSinceLastSuccessfulSync: 0
                      }
                    }
                  ]
                ])
              }
            };
          }
        }
      ]);
    }
  });

  // src/backend/accounts/ical/ical_tasks.js
  var ical_tasks_exports = {};
  __export(ical_tasks_exports, {
    default: () => ical_tasks_default
  });
  var ical_tasks_default;
  var init_ical_tasks = __esm({
    "src/backend/accounts/ical/ical_tasks.js"() {
      init_sync_folder_list4();
      init_sync_uid();
      init_sync_refresh2();
      init_account_modify();
      init_identity_modify();
      init_new_tracking();
      ical_tasks_default = [
        sync_folder_list_default4,
        sync_uid_default,
        sync_refresh_default2,
        account_modify_default,
        identity_modify_default,
        new_tracking_default
      ];
    }
  });

  // src/vendor/fibonacci-heap.js
  var require_fibonacci_heap = __commonJS({
    "src/vendor/fibonacci-heap.js"(exports, module) {
      (function(root, factory) {
        "use strict";
        if (typeof define === "function" && define.amd) {
          define([], function() {
            return root.FibonacciHeap = factory();
          });
        } else if (typeof exports === "object") {
          module.exports = factory();
        } else {
          root.FibonacciHeap = factory();
        }
      })(exports, function() {
        "use strict";
        var FibonacciHeap2 = function(customCompare) {
          this.minNode = void 0;
          this.nodeCount = 0;
          if (customCompare) {
            this.compare = customCompare;
          }
        };
        FibonacciHeap2.prototype.clear = function() {
          this.minNode = void 0;
          this.nodeCount = 0;
        };
        FibonacciHeap2.prototype.decreaseKey = function(node, newKey) {
          if (typeof node === "undefined") {
            throw "Cannot decrease key of non-existent node";
          }
          if (this.compare({ key: newKey }, { key: node.key }) > 0) {
            throw "New key is larger than old key";
          }
          node.key = newKey;
          var parent = node.parent;
          if (parent && this.compare(node, parent) < 0) {
            cut(node, parent, this.minNode, this.compare);
            cascadingCut(parent, this.minNode, this.compare);
          }
          if (this.compare(node, this.minNode) < 0) {
            this.minNode = node;
          }
        };
        FibonacciHeap2.prototype.delete = function(node) {
          node.isMinimum = true;
          var parent = node.parent;
          if (parent) {
            cut(node, parent, this.minNode, this.compare);
            cascadingCut(parent, this.minNode, this.compare);
          }
          this.minNode = node;
          this.extractMinimum();
        };
        FibonacciHeap2.prototype.extractMinimum = function() {
          var extractedMin = this.minNode;
          if (extractedMin) {
            if (extractedMin.child) {
              var child = extractedMin.child;
              do {
                child.parent = void 0;
                child = child.next;
              } while (child !== extractedMin.child);
            }
            var nextInRootList;
            if (this.minNode.next !== this.minNode) {
              nextInRootList = this.minNode.next;
            }
            removeNodeFromList(extractedMin);
            this.nodeCount--;
            this.minNode = mergeLists(nextInRootList, extractedMin.child, this.compare);
            if (nextInRootList) {
              this.minNode = nextInRootList;
              this.minNode = consolidate(this.minNode, this.compare);
            }
          }
          return extractedMin;
        };
        FibonacciHeap2.prototype.findMinimum = function() {
          return this.minNode;
        };
        FibonacciHeap2.prototype.insert = function(key, value) {
          var node = new Node(key, value);
          this.minNode = mergeLists(this.minNode, node, this.compare);
          this.nodeCount++;
          return node;
        };
        FibonacciHeap2.prototype.isEmpty = function() {
          return this.minNode === void 0;
        };
        FibonacciHeap2.prototype.size = function() {
          if (this.isEmpty()) {
            return 0;
          }
          return getNodeListSize(this.minNode);
        };
        FibonacciHeap2.prototype.union = function(other) {
          this.minNode = mergeLists(this.minNode, other.minNode, this.compare);
          this.nodeCount += other.nodeCount;
        };
        FibonacciHeap2.prototype.compare = function(a, b) {
          if (a.key > b.key) {
            return 1;
          }
          if (a.key < b.key) {
            return -1;
          }
          return 0;
        };
        function cut(node, parent, minNode, compare) {
          removeNodeFromList(node);
          parent.degree--;
          if (node.next === node) {
            parent.child = void 0;
          } else {
            parent.child = node.next;
          }
          minNode = mergeLists(minNode, node, compare);
          node.isMarked = false;
          return minNode;
        }
        function cascadingCut(node, minNode, compare) {
          var parent = node.parent;
          if (parent) {
            if (node.isMarked) {
              minNode = cut(node, parent, minNode, compare);
              minNode = cascadingCut(parent, minNode, compare);
            } else {
              node.isMarked = true;
            }
          }
          return minNode;
        }
        function consolidate(minNode, compare) {
          var aux = [];
          var it = new NodeListIterator(minNode);
          while (it.hasNext()) {
            var current = it.next();
            while (aux[current.degree]) {
              if (compare(current, aux[current.degree]) > 0) {
                var temp = current;
                current = aux[current.degree];
                aux[current.degree] = temp;
              }
              linkHeaps(aux[current.degree], current, compare);
              aux[current.degree] = void 0;
              current.degree++;
            }
            aux[current.degree] = current;
          }
          minNode = void 0;
          for (var i = 0; i < aux.length; i++) {
            if (aux[i]) {
              aux[i].next = aux[i];
              aux[i].prev = aux[i];
              minNode = mergeLists(minNode, aux[i], compare);
            }
          }
          return minNode;
        }
        function removeNodeFromList(node) {
          var prev = node.prev;
          var next = node.next;
          prev.next = next;
          next.prev = prev;
          node.next = node;
          node.prev = node;
        }
        function linkHeaps(max, min, compare) {
          removeNodeFromList(max);
          min.child = mergeLists(max, min.child, compare);
          max.parent = min;
          max.isMarked = false;
        }
        function mergeLists(a, b, compare) {
          if (!a && !b) {
            return void 0;
          }
          if (!a) {
            return b;
          }
          if (!b) {
            return a;
          }
          var temp = a.next;
          a.next = b.next;
          a.next.prev = a;
          b.next = temp;
          b.next.prev = b;
          return compare(a, b) < 0 ? a : b;
        }
        function getNodeListSize(node) {
          var count = 0;
          var current = node;
          do {
            count++;
            if (current.child) {
              count += getNodeListSize(current.child);
            }
            current = current.next;
          } while (current !== node);
          return count;
        }
        function Node(key, value) {
          this.key = key;
          this.value = value;
          this.prev = this;
          this.next = this;
          this.degree = 0;
          this.parent = void 0;
          this.child = void 0;
          this.isMarked = void 0;
          this.isMinimum = void 0;
        }
        var NodeListIterator = function(start) {
          if (!start) {
            return;
          }
          this.items = [];
          var current = start;
          do {
            this.items.push(current);
            current = current.next;
          } while (start !== current);
        };
        NodeListIterator.prototype.hasNext = function() {
          return this.items.length > 0;
        };
        NodeListIterator.prototype.next = function() {
          return this.items.shift();
        };
        return FibonacciHeap2;
      });
    }
  });

  // src/vendor/streams.js
  var require_streams = __commonJS({
    "src/vendor/streams.js"(exports, module) {
      (function(f) {
        if (typeof exports === "object" && typeof module !== "undefined") {
          module.exports = f();
        } else if (typeof define === "function" && define.amd) {
          define([], f);
        } else {
          var g;
          if (typeof window !== "undefined") {
            g = window;
          } else if (typeof global !== "undefined") {
            g = global;
          } else if (typeof self !== "undefined") {
            g = self;
          } else {
            g = this;
          }
          g.Streams = f();
        }
      })(function() {
        var define2, module2, exports2;
        return function e(t, n, r) {
          function s(o2, u) {
            if (!n[o2]) {
              if (!t[o2]) {
                var a = typeof __require == "function" && __require;
                if (!u && a)
                  return a(o2, true);
                if (i)
                  return i(o2, true);
                var f = new Error("Cannot find module '" + o2 + "'");
                throw f.code = "MODULE_NOT_FOUND", f;
              }
              var l = n[o2] = { exports: {} };
              t[o2][0].call(l.exports, function(e2) {
                var n2 = t[o2][1][e2];
                return s(n2 ? n2 : e2);
              }, l, l.exports, e, t, n, r);
            }
            return n[o2].exports;
          }
          var i = typeof __require == "function" && __require;
          for (var o = 0; o < r.length; o++)
            s(r[o]);
          return s;
        }({ 1: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          exports3.assert = assert;
          function assert(val, msg) {
            if (!val) {
              throw new Error("AssertionError: " + msg);
            }
          }
        }, {}], 2: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          var _createClass = function() {
            function defineProperties(target, props) {
              for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor)
                  descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
              }
            }
            return function(Constructor, protoProps, staticProps) {
              if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
              if (staticProps)
                defineProperties(Constructor, staticProps);
              return Constructor;
            };
          }();
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          var _helpers = require2("./helpers");
          var ByteLengthQueuingStrategy = function() {
            function ByteLengthQueuingStrategy2(_ref) {
              var highWaterMark = _ref.highWaterMark;
              _classCallCheck(this, ByteLengthQueuingStrategy2);
              (0, _helpers.createDataProperty)(this, "highWaterMark", highWaterMark);
            }
            _createClass(ByteLengthQueuingStrategy2, [{
              key: "size",
              value: function size(chunk) {
                return chunk.byteLength;
              }
            }]);
            return ByteLengthQueuingStrategy2;
          }();
          exports3["default"] = ByteLengthQueuingStrategy;
          module3.exports = exports3["default"];
        }, { "./helpers": 4 }], 3: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          var _createClass = function() {
            function defineProperties(target, props) {
              for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor)
                  descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
              }
            }
            return function(Constructor, protoProps, staticProps) {
              if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
              if (staticProps)
                defineProperties(Constructor, staticProps);
              return Constructor;
            };
          }();
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          var _helpers = require2("./helpers");
          var CountQueuingStrategy2 = function() {
            function CountQueuingStrategy3(_ref) {
              var highWaterMark = _ref.highWaterMark;
              _classCallCheck(this, CountQueuingStrategy3);
              (0, _helpers.createDataProperty)(this, "highWaterMark", highWaterMark);
            }
            _createClass(CountQueuingStrategy3, [{
              key: "size",
              value: function size(chunk) {
                return 1;
              }
            }]);
            return CountQueuingStrategy3;
          }();
          exports3["default"] = CountQueuingStrategy2;
          module3.exports = exports3["default"];
        }, { "./helpers": 4 }], 4: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          exports3.promiseCall = promiseCall;
          exports3.typeIsObject = typeIsObject;
          exports3.toInteger = toInteger;
          exports3.createDataProperty = createDataProperty;
          exports3.createArrayFromList = createArrayFromList;
          exports3.CreateIterResultObject = CreateIterResultObject;
          exports3.InvokeOrNoop = InvokeOrNoop;
          exports3.PromiseInvokeOrNoop = PromiseInvokeOrNoop;
          exports3.PromiseInvokeOrFallbackOrNoop = PromiseInvokeOrFallbackOrNoop;
          exports3.ValidateAndNormalizeQueuingStrategy = ValidateAndNormalizeQueuingStrategy;
          var _assert = require2("./assert");
          function promiseCall(func) {
            for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
              args[_key - 1] = arguments[_key];
            }
            try {
              return Promise.resolve(func.apply(void 0, args));
            } catch (e) {
              return Promise.reject(e);
            }
          }
          function typeIsObject(x) {
            return typeof x === "object" && x !== null || typeof x === "function";
          }
          function toInteger(v) {
            v = Number(v);
            if (isNaN(v)) {
              return 0;
            }
            if (v < 0) {
              return -1 * Math.floor(Math.abs(v));
            }
            return Math.floor(Math.abs(v));
          }
          function createDataProperty(o, p, v) {
            (0, _assert.assert)(typeIsObject(o));
            Object.defineProperty(o, p, { value: v, writable: true, enumerable: true, configurable: true });
          }
          function createArrayFromList(elements) {
            return elements.slice();
          }
          function CreateIterResultObject(value, done) {
            (0, _assert.assert)(typeof done === "boolean");
            var obj = {};
            Object.defineProperty(obj, "value", { value, enumerable: true, writable: true, configurable: true });
            Object.defineProperty(obj, "done", { value: done, enumerable: true, writable: true, configurable: true });
            return obj;
          }
          function InvokeOrNoop(O, P, args) {
            var method = O[P];
            if (method === void 0) {
              return void 0;
            }
            return method.apply(O, args);
          }
          function PromiseInvokeOrNoop(O, P, args) {
            var method = void 0;
            try {
              method = O[P];
            } catch (methodE) {
              return Promise.reject(methodE);
            }
            if (method === void 0) {
              return Promise.resolve(void 0);
            }
            try {
              return Promise.resolve(method.apply(O, args));
            } catch (e) {
              return Promise.reject(e);
            }
          }
          function PromiseInvokeOrFallbackOrNoop(O, P1, args1, P2, args2) {
            var method = void 0;
            try {
              method = O[P1];
            } catch (methodE) {
              return Promise.reject(methodE);
            }
            if (method === void 0) {
              return PromiseInvokeOrNoop(O, P2, args2);
            }
            try {
              return Promise.resolve(method.apply(O, args1));
            } catch (e) {
              return Promise.reject(e);
            }
          }
          function ValidateAndNormalizeQueuingStrategy(size, highWaterMark) {
            if (size !== void 0 && typeof size !== "function") {
              throw new TypeError("size property of a queuing strategy must be a function");
            }
            highWaterMark = Number(highWaterMark);
            if (Number.isNaN(highWaterMark)) {
              throw new TypeError("highWaterMark property of a queuing strategy must be convertible to a non-NaN number");
            }
            if (highWaterMark < 0) {
              throw new RangeError("highWaterMark property of a queuing strategy must be nonnegative");
            }
            return { size, highWaterMark };
          }
        }, { "./assert": 1 }], 5: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          function _interopRequireDefault(obj) {
            return obj && obj.__esModule ? obj : { "default": obj };
          }
          var _byteLengthQueuingStrategyJs = require2("./byte-length-queuing-strategy.js");
          var _byteLengthQueuingStrategyJs2 = _interopRequireDefault(_byteLengthQueuingStrategyJs);
          var _countQueuingStrategyJs = require2("./count-queuing-strategy.js");
          var _countQueuingStrategyJs2 = _interopRequireDefault(_countQueuingStrategyJs);
          var _readableStreamJs = require2("./readable-stream.js");
          var _readableStreamJs2 = _interopRequireDefault(_readableStreamJs);
          var _transformStreamJs = require2("./transform-stream.js");
          var _transformStreamJs2 = _interopRequireDefault(_transformStreamJs);
          var _writableStreamJs = require2("./writable-stream.js");
          var _writableStreamJs2 = _interopRequireDefault(_writableStreamJs);
          var Streams = {
            ByteLengthQueuingStrategy: _byteLengthQueuingStrategyJs2["default"],
            CountQueuingStrategy: _countQueuingStrategyJs2["default"],
            ReadableStream: _readableStreamJs2["default"],
            TransformStream: _transformStreamJs2["default"],
            WritableStream: _writableStreamJs2["default"]
          };
          exports3["default"] = Streams;
          module3.exports = exports3["default"];
        }, { "./byte-length-queuing-strategy.js": 2, "./count-queuing-strategy.js": 3, "./readable-stream.js": 7, "./transform-stream.js": 8, "./writable-stream.js": 10 }], 6: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          exports3.DequeueValue = DequeueValue;
          exports3.EnqueueValueWithSize = EnqueueValueWithSize;
          exports3.GetTotalQueueSize = GetTotalQueueSize;
          exports3.PeekQueueValue = PeekQueueValue;
          var _assert = require2("./assert");
          function DequeueValue(queue) {
            (0, _assert.assert)(queue.length > 0, "Spec-level failure: should never dequeue from an empty queue.");
            var pair = queue.shift();
            return pair.value;
          }
          function EnqueueValueWithSize(queue, value, size) {
            size = Number(size);
            if (Number.isNaN(size) || size === Infinity || size === -Infinity) {
              throw new RangeError("Size must be a finite, non-NaN number.");
            }
            queue.push({ value, size });
          }
          function GetTotalQueueSize(queue) {
            var totalSize = 0;
            queue.forEach(function(pair) {
              (0, _assert.assert)(typeof pair.size === "number" && !Number.isNaN(pair.size) && pair.size !== Infinity && pair.size !== -Infinity, "Spec-level failure: should never find an invalid size in the queue.");
              totalSize += pair.size;
            });
            return totalSize;
          }
          function PeekQueueValue(queue) {
            (0, _assert.assert)(queue.length > 0, "Spec-level failure: should never peek at an empty queue.");
            var pair = queue[0];
            return pair.value;
          }
        }, { "./assert": 1 }], 7: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          var _createClass = function() {
            function defineProperties(target, props) {
              for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor)
                  descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
              }
            }
            return function(Constructor, protoProps, staticProps) {
              if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
              if (staticProps)
                defineProperties(Constructor, staticProps);
              return Constructor;
            };
          }();
          function _slicedToArray(arr, i) {
            if (Array.isArray(arr)) {
              return arr;
            } else if (Symbol.iterator in Object(arr)) {
              var _arr = [];
              var _n = true;
              var _d = false;
              var _e = void 0;
              try {
                for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                  _arr.push(_s.value);
                  if (i && _arr.length === i)
                    break;
                }
              } catch (err) {
                _d = true;
                _e = err;
              } finally {
                try {
                  if (!_n && _i["return"])
                    _i["return"]();
                } finally {
                  if (_d)
                    throw _e;
                }
              }
              return _arr;
            } else {
              throw new TypeError("Invalid attempt to destructure non-iterable instance");
            }
          }
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          var _assert = require2("./assert");
          var _helpers = require2("./helpers");
          var _utils = require2("./utils");
          var _queueWithSizes = require2("./queue-with-sizes");
          var ReadableStream = function() {
            function ReadableStream2() {
              var _this = this;
              var underlyingSource = arguments[0] === void 0 ? {} : arguments[0];
              var _ref = arguments[1] === void 0 ? {} : arguments[1];
              var size = _ref.size;
              var _ref$highWaterMark = _ref.highWaterMark;
              var highWaterMark = _ref$highWaterMark === void 0 ? 1 : _ref$highWaterMark;
              _classCallCheck(this, ReadableStream2);
              this._underlyingSource = underlyingSource;
              this._queue = [];
              this._state = "readable";
              this._started = false;
              this._closeRequested = false;
              this._pulling = false;
              this._pullAgain = false;
              this._reader = void 0;
              this._storedError = void 0;
              var normalizedStrategy = (0, _helpers.ValidateAndNormalizeQueuingStrategy)(size, highWaterMark);
              this._strategySize = normalizedStrategy.size;
              this._strategyHWM = normalizedStrategy.highWaterMark;
              this._controller = new ReadableStreamController(this);
              var startResult = (0, _helpers.InvokeOrNoop)(underlyingSource, "start", [this._controller]);
              Promise.resolve(startResult).then(function() {
                _this._started = true;
                RequestReadableStreamPull(_this);
              }, function(r) {
                if (_this._state === "readable") {
                  return ErrorReadableStream(_this, r);
                }
              })["catch"](_utils.rethrowAssertionErrorRejection);
            }
            _createClass(ReadableStream2, [{
              key: "cancel",
              value: function cancel(reason) {
                if (IsReadableStream(this) === false) {
                  return Promise.reject(new TypeError("ReadableStream.prototype.cancel can only be used on a ReadableStream"));
                }
                if (IsReadableStreamLocked(this) === true) {
                  return Promise.reject(new TypeError("Cannot cancel a stream that already has a reader"));
                }
                return CancelReadableStream(this, reason);
              }
            }, {
              key: "getReader",
              value: function getReader() {
                if (IsReadableStream(this) === false) {
                  throw new TypeError("ReadableStream.prototype.getReader can only be used on a ReadableStream");
                }
                return AcquireReadableStreamReader(this);
              }
            }, {
              key: "pipeThrough",
              value: function pipeThrough(_ref2, options) {
                var writable = _ref2.writable;
                var readable = _ref2.readable;
                this.pipeTo(writable, options);
                return readable;
              }
            }, {
              key: "pipeTo",
              value: function pipeTo(dest) {
                var _ref3 = arguments[1] === void 0 ? {} : arguments[1];
                var preventClose = _ref3.preventClose;
                var preventAbort = _ref3.preventAbort;
                var preventCancel = _ref3.preventCancel;
                preventClose = Boolean(preventClose);
                preventAbort = Boolean(preventAbort);
                preventCancel = Boolean(preventCancel);
                var source = this;
                var reader = void 0;
                var lastRead = void 0;
                var lastWrite = void 0;
                var closedPurposefully = false;
                var resolvePipeToPromise = void 0;
                var rejectPipeToPromise = void 0;
                return new Promise(function(resolve, reject) {
                  resolvePipeToPromise = resolve;
                  rejectPipeToPromise = reject;
                  reader = source.getReader();
                  reader.closed["catch"](abortDest);
                  dest.closed.then(function() {
                    if (!closedPurposefully) {
                      cancelSource(new TypeError("destination is closing or closed and cannot be piped to anymore"));
                    }
                  }, cancelSource);
                  doPipe();
                });
                function doPipe() {
                  lastRead = reader.read();
                  Promise.all([lastRead, dest.ready]).then(function(_ref4) {
                    var _ref42 = _slicedToArray(_ref4, 1);
                    var _ref42$0 = _ref42[0];
                    var value = _ref42$0.value;
                    var done = _ref42$0.done;
                    if (Boolean(done) === true) {
                      closeDest();
                    } else if (dest.state === "writable") {
                      lastWrite = dest.write(value);
                      doPipe();
                    }
                  });
                }
                function cancelSource(reason) {
                  if (preventCancel === false) {
                    reader.cancel(reason);
                    rejectPipeToPromise(reason);
                  } else {
                    lastRead.then(function() {
                      reader.releaseLock();
                      rejectPipeToPromise(reason);
                    });
                  }
                }
                function closeDest() {
                  reader.releaseLock();
                  var destState = dest.state;
                  if (preventClose === false && (destState === "waiting" || destState === "writable")) {
                    closedPurposefully = true;
                    dest.close().then(resolvePipeToPromise, rejectPipeToPromise);
                  } else if (lastWrite !== void 0) {
                    lastWrite.then(resolvePipeToPromise, rejectPipeToPromise);
                  } else {
                    resolvePipeToPromise();
                  }
                }
                function abortDest(reason) {
                  reader.releaseLock();
                  if (preventAbort === false) {
                    dest.abort(reason);
                  }
                  rejectPipeToPromise(reason);
                }
              }
            }, {
              key: "tee",
              value: function tee() {
                if (IsReadableStream(this) === false) {
                  throw new TypeError("ReadableStream.prototype.tee can only be used on a ReadableStream");
                }
                var branches = TeeReadableStream(this, false);
                return (0, _helpers.createArrayFromList)(branches);
              }
            }]);
            return ReadableStream2;
          }();
          exports3["default"] = ReadableStream;
          var ReadableStreamController = function() {
            function ReadableStreamController2(stream) {
              _classCallCheck(this, ReadableStreamController2);
              if (IsReadableStream(stream) === false) {
                throw new TypeError("ReadableStreamController can only be constructed with a ReadableStream instance");
              }
              if (stream._controller !== void 0) {
                throw new TypeError("ReadableStreamController instances can only be created by the ReadableStream constructor");
              }
              this._controlledReadableStream = stream;
            }
            _createClass(ReadableStreamController2, [{
              key: "desiredSize",
              get: function() {
                if (IsReadableStreamController(this) === false) {
                  throw new TypeError("ReadableStreamController.prototype.desiredSize can only be used on a ReadableStreamController");
                }
                return GetReadableStreamDesiredSize(this._controlledReadableStream);
              }
            }, {
              key: "close",
              value: function close() {
                if (IsReadableStreamController(this) === false) {
                  throw new TypeError("ReadableStreamController.prototype.close can only be used on a ReadableStreamController");
                }
                var stream = this._controlledReadableStream;
                if (stream._closeRequested === true) {
                  throw new TypeError("The stream has already been closed; do not close it again! " + new Error().stack);
                }
                if (stream._state === "errored") {
                  throw new TypeError("The stream is in an errored state and cannot be closed");
                }
                return CloseReadableStream(stream);
              }
            }, {
              key: "enqueue",
              value: function enqueue(chunk) {
                if (IsReadableStreamController(this) === false) {
                  throw new TypeError("ReadableStreamController.prototype.enqueue can only be used on a ReadableStreamController");
                }
                var stream = this._controlledReadableStream;
                if (stream._state === "errored") {
                  throw stream._storedError;
                }
                if (stream._closeRequested === true) {
                  throw new TypeError("stream is closed or draining" + new Error().stack);
                }
                return EnqueueInReadableStream(stream, chunk);
              }
            }, {
              key: "error",
              value: function error(e) {
                if (IsReadableStreamController(this) === false) {
                  throw new TypeError("ReadableStreamController.prototype.error can only be used on a ReadableStreamController");
                }
                if (this._controlledReadableStream._state !== "readable") {
                  throw new TypeError("The stream is " + this._controlledReadableStream._state + " and so cannot be errored");
                }
                return ErrorReadableStream(this._controlledReadableStream, e);
              }
            }]);
            return ReadableStreamController2;
          }();
          var ReadableStreamReader = function() {
            function ReadableStreamReader2(stream) {
              var _this2 = this;
              _classCallCheck(this, ReadableStreamReader2);
              if (IsReadableStream(stream) === false) {
                throw new TypeError("ReadableStreamReader can only be constructed with a ReadableStream instance");
              }
              if (IsReadableStreamLocked(stream) === true) {
                throw new TypeError("This stream has already been locked for exclusive reading by another reader");
              }
              stream._reader = this;
              this._ownerReadableStream = stream;
              this._state = "readable";
              this._storedError = void 0;
              this._readRequests = [];
              this._closedPromise = new Promise(function(resolve, reject) {
                _this2._closedPromise_resolve = resolve;
                _this2._closedPromise_reject = reject;
              });
              if (stream._state === "closed" || stream._state === "errored") {
                ReleaseReadableStreamReader(this);
              }
            }
            _createClass(ReadableStreamReader2, [{
              key: "closed",
              get: function() {
                if (IsReadableStreamReader(this) === false) {
                  return Promise.reject(new TypeError("ReadableStreamReader.prototype.closed can only be used on a ReadableStreamReader"));
                }
                return this._closedPromise;
              }
            }, {
              key: "cancel",
              value: function cancel(reason) {
                if (IsReadableStreamReader(this) === false) {
                  return Promise.reject(new TypeError("ReadableStreamReader.prototype.cancel can only be used on a ReadableStreamReader"));
                }
                if (this._state === "closed") {
                  return Promise.resolve(void 0);
                }
                if (this._state === "errored") {
                  return Promise.reject(this._storedError);
                }
                (0, _assert.assert)(this._ownerReadableStream !== void 0);
                (0, _assert.assert)(this._ownerReadableStream._state === "readable");
                return CancelReadableStream(this._ownerReadableStream, reason);
              }
            }, {
              key: "read",
              value: function read() {
                if (IsReadableStreamReader(this) === false) {
                  return Promise.reject(new TypeError("ReadableStreamReader.prototype.read can only be used on a ReadableStreamReader"));
                }
                return ReadFromReadableStreamReader(this);
              }
            }, {
              key: "releaseLock",
              value: function releaseLock() {
                if (IsReadableStreamReader(this) === false) {
                  throw new TypeError("ReadableStreamReader.prototype.releaseLock can only be used on a ReadableStreamReader");
                }
                if (this._ownerReadableStream === void 0) {
                  return void 0;
                }
                if (this._readRequests.length > 0) {
                  throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
                }
                return ReleaseReadableStreamReader(this);
              }
            }]);
            return ReadableStreamReader2;
          }();
          function AcquireReadableStreamReader(stream) {
            return new ReadableStreamReader(stream);
          }
          function CancelReadableStream(stream, reason) {
            if (stream._state === "closed") {
              return Promise.resolve(void 0);
            }
            if (stream._state === "errored") {
              return Promise.reject(stream._storedError);
            }
            stream._queue = [];
            FinishClosingReadableStream(stream);
            var sourceCancelPromise = (0, _helpers.PromiseInvokeOrNoop)(stream._underlyingSource, "cancel", [reason]);
            return sourceCancelPromise.then(function() {
              return void 0;
            });
          }
          function CloseReadableStream(stream) {
            (0, _assert.assert)(stream._closeRequested === false);
            (0, _assert.assert)(stream._state !== "errored");
            if (stream._state === "closed") {
              return void 0;
            }
            stream._closeRequested = true;
            if (stream._queue.length === 0) {
              return FinishClosingReadableStream(stream);
            }
          }
          function EnqueueInReadableStream(stream, chunk) {
            (0, _assert.assert)(stream._closeRequested === false);
            (0, _assert.assert)(stream._state !== "errored");
            if (stream._state === "closed") {
              return void 0;
            }
            if (IsReadableStreamLocked(stream) === true && stream._reader._readRequests.length > 0) {
              var readRequest = stream._reader._readRequests.shift();
              readRequest._resolve((0, _helpers.CreateIterResultObject)(chunk, false));
            } else {
              var chunkSize = 1;
              if (stream._strategySize !== void 0) {
                try {
                  chunkSize = stream._strategySize(chunk);
                } catch (chunkSizeE) {
                  ErrorReadableStream(stream, chunkSizeE);
                  throw chunkSizeE;
                }
              }
              try {
                (0, _queueWithSizes.EnqueueValueWithSize)(stream._queue, chunk, chunkSize);
              } catch (enqueueE) {
                ErrorReadableStream(stream, enqueueE);
                throw enqueueE;
              }
            }
            RequestReadableStreamPull(stream);
            return void 0;
          }
          function ErrorReadableStream(stream, e) {
            (0, _assert.assert)(stream._state === "readable");
            stream._queue = [];
            stream._storedError = e;
            stream._state = "errored";
            if (IsReadableStreamLocked(stream) === true) {
              return ReleaseReadableStreamReader(stream._reader);
            }
          }
          function FinishClosingReadableStream(stream) {
            (0, _assert.assert)(stream._state === "readable");
            stream._state = "closed";
            if (IsReadableStreamLocked(stream) === true) {
              return ReleaseReadableStreamReader(stream._reader);
            }
            return void 0;
          }
          function GetReadableStreamDesiredSize(stream) {
            var queueSize = (0, _queueWithSizes.GetTotalQueueSize)(stream._queue);
            return stream._strategyHWM - queueSize;
          }
          function IsReadableStream(x) {
            if (!(0, _helpers.typeIsObject)(x)) {
              return false;
            }
            if (!Object.prototype.hasOwnProperty.call(x, "_underlyingSource")) {
              return false;
            }
            return true;
          }
          function IsReadableStreamLocked(stream) {
            (0, _assert.assert)(IsReadableStream(stream) === true, "IsReadableStreamLocked should only be used on known readable streams");
            if (stream._reader === void 0) {
              return false;
            }
            return true;
          }
          function IsReadableStreamController(x) {
            if (!(0, _helpers.typeIsObject)(x)) {
              return false;
            }
            if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableStream")) {
              return false;
            }
            return true;
          }
          function IsReadableStreamReader(x) {
            if (!(0, _helpers.typeIsObject)(x)) {
              return false;
            }
            if (!Object.prototype.hasOwnProperty.call(x, "_ownerReadableStream")) {
              return false;
            }
            return true;
          }
          function ReadFromReadableStreamReader(reader) {
            if (reader._state === "closed") {
              return Promise.resolve((0, _helpers.CreateIterResultObject)(void 0, true));
            }
            if (reader._state === "errored") {
              return Promise.reject(reader._storedError);
            }
            (0, _assert.assert)(reader._ownerReadableStream !== void 0);
            (0, _assert.assert)(reader._ownerReadableStream._state === "readable");
            if (reader._ownerReadableStream._queue.length > 0) {
              var chunk = (0, _queueWithSizes.DequeueValue)(reader._ownerReadableStream._queue);
              if (reader._ownerReadableStream._closeRequested === true && reader._ownerReadableStream._queue.length === 0) {
                FinishClosingReadableStream(reader._ownerReadableStream);
              } else {
                RequestReadableStreamPull(reader._ownerReadableStream);
              }
              return Promise.resolve((0, _helpers.CreateIterResultObject)(chunk, false));
            } else {
              var _ret = function() {
                var readRequest = {};
                readRequest.promise = new Promise(function(resolve, reject) {
                  readRequest._resolve = resolve;
                  readRequest._reject = reject;
                });
                reader._readRequests.push(readRequest);
                RequestReadableStreamPull(reader._ownerReadableStream);
                return {
                  v: readRequest.promise
                };
              }();
              if (typeof _ret === "object")
                return _ret.v;
            }
          }
          function ReleaseReadableStreamReader(reader) {
            (0, _assert.assert)(reader._ownerReadableStream !== void 0);
            if (reader._ownerReadableStream._state === "errored") {
              reader._state = "errored";
              var e = reader._ownerReadableStream._storedError;
              reader._storedError = e;
              reader._closedPromise_reject(e);
              var _iteratorNormalCompletion = true;
              var _didIteratorError = false;
              var _iteratorError = void 0;
              try {
                for (var _iterator = reader._readRequests[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                  var _reject = _step.value._reject;
                  _reject(e);
                }
              } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion && _iterator["return"]) {
                    _iterator["return"]();
                  }
                } finally {
                  if (_didIteratorError) {
                    throw _iteratorError;
                  }
                }
              }
            } else {
              reader._state = "closed";
              reader._closedPromise_resolve(void 0);
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = void 0;
              try {
                for (var _iterator2 = reader._readRequests[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  var _resolve = _step2.value._resolve;
                  _resolve((0, _helpers.CreateIterResultObject)(void 0, true));
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
                    _iterator2["return"]();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }
            }
            reader._readRequests = [];
            reader._ownerReadableStream._reader = void 0;
            reader._ownerReadableStream = void 0;
          }
          function RequestReadableStreamPull(stream) {
            var shouldPull = ShouldReadableStreamPull(stream);
            if (shouldPull === false) {
              return void 0;
            }
            if (stream._pulling === true) {
              stream._pullAgain = true;
              return void 0;
            }
            stream._pulling = true;
            var pullPromise = (0, _helpers.PromiseInvokeOrNoop)(stream._underlyingSource, "pull", [stream._controller]);
            pullPromise.then(function() {
              stream._pulling = false;
              if (stream._pullAgain === true) {
                stream._pullAgain = false;
                return RequestReadableStreamPull(stream);
              }
            }, function(e) {
              if (stream._state === "readable") {
                return ErrorReadableStream(stream, e);
              }
            })["catch"](_utils.rethrowAssertionErrorRejection);
            return void 0;
          }
          function ShouldReadableStreamPull(stream) {
            if (stream._state === "closed" || stream._state === "errored") {
              return false;
            }
            if (stream._closeRequested === true) {
              return false;
            }
            if (stream._started === false) {
              return false;
            }
            if (IsReadableStreamLocked(stream) === true && stream._reader._readRequests.length > 0) {
              return true;
            }
            var desiredSize = GetReadableStreamDesiredSize(stream);
            if (desiredSize > 0) {
              return true;
            }
            return false;
          }
          function TeeReadableStream(stream, shouldClone) {
            (0, _assert.assert)(IsReadableStream(stream) === true);
            (0, _assert.assert)(typeof shouldClone === "boolean");
            var reader = AcquireReadableStreamReader(stream);
            var teeState = {
              closedOrErrored: false,
              canceled1: false,
              canceled2: false,
              reason1: void 0,
              reason2: void 0
            };
            teeState.promise = new Promise(function(resolve) {
              return teeState._resolve = resolve;
            });
            var pull = create_TeeReadableStreamPullFunction();
            pull._reader = reader;
            pull._teeState = teeState;
            pull._shouldClone = shouldClone;
            var cancel1 = create_TeeReadableStreamBranch1CancelFunction();
            cancel1._stream = stream;
            cancel1._teeState = teeState;
            var cancel2 = create_TeeReadableStreamBranch2CancelFunction();
            cancel2._stream = stream;
            cancel2._teeState = teeState;
            var underlyingSource1 = Object.create(Object.prototype);
            (0, _helpers.createDataProperty)(underlyingSource1, "pull", pull);
            (0, _helpers.createDataProperty)(underlyingSource1, "cancel", cancel1);
            var branch1 = new ReadableStream(underlyingSource1);
            var underlyingSource2 = Object.create(Object.prototype);
            (0, _helpers.createDataProperty)(underlyingSource2, "pull", pull);
            (0, _helpers.createDataProperty)(underlyingSource2, "cancel", cancel2);
            var branch2 = new ReadableStream(underlyingSource2);
            pull._branch1 = branch1;
            pull._branch2 = branch2;
            reader._closedPromise["catch"](function(r) {
              if (teeState.closedOrErrored === true) {
                return void 0;
              }
              ErrorReadableStream(branch1, r);
              ErrorReadableStream(branch2, r);
              teeState.closedOrErrored = true;
            });
            return [branch1, branch2];
          }
          function create_TeeReadableStreamPullFunction() {
            var f = function f2() {
              var reader = f2._reader;
              var branch1 = f2._branch1;
              var branch2 = f2._branch2;
              var teeState = f2._teeState;
              var shouldClone = f2._shouldClone;
              return ReadFromReadableStreamReader(reader).then(function(result) {
                (0, _assert.assert)((0, _helpers.typeIsObject)(result));
                var value = result.value;
                var done = result.done;
                (0, _assert.assert)(typeof done === "boolean");
                if (done === true && teeState.closedOrErrored === false) {
                  CloseReadableStream(branch1);
                  CloseReadableStream(branch2);
                  teeState.closedOrErrored = true;
                }
                if (teeState.closedOrErrored === true) {
                  return void 0;
                }
                if (teeState.canceled1 === false) {
                  var value1 = value;
                  EnqueueInReadableStream(branch1, value1);
                }
                if (teeState.canceled2 === false) {
                  var value2 = value;
                  EnqueueInReadableStream(branch2, value2);
                }
              });
            };
            return f;
          }
          function create_TeeReadableStreamBranch1CancelFunction() {
            var f = function f2(reason) {
              var stream = f2._stream;
              var teeState = f2._teeState;
              teeState.canceled1 = true;
              teeState.reason1 = reason;
              if (teeState.canceled2 === true) {
                var compositeReason = (0, _helpers.createArrayFromList)([teeState.reason1, teeState.reason2]);
                var cancelResult = CancelReadableStream(stream, compositeReason);
                teeState._resolve(cancelResult);
              }
              return teeState.promise;
            };
            return f;
          }
          function create_TeeReadableStreamBranch2CancelFunction() {
            var f = function f2(reason) {
              var stream = f2._stream;
              var teeState = f2._teeState;
              teeState.canceled2 = true;
              teeState.reason2 = reason;
              if (teeState.canceled1 === true) {
                var compositeReason = (0, _helpers.createArrayFromList)([teeState.reason1, teeState.reason2]);
                var cancelResult = CancelReadableStream(stream, compositeReason);
                teeState._resolve(cancelResult);
              }
              return teeState.promise;
            };
            return f;
          }
          module3.exports = exports3["default"];
        }, { "./assert": 1, "./helpers": 4, "./queue-with-sizes": 6, "./utils": 9 }], 8: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          function _interopRequireDefault(obj) {
            return obj && obj.__esModule ? obj : { "default": obj };
          }
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          var _readableStream = require2("./readable-stream");
          var _readableStream2 = _interopRequireDefault(_readableStream);
          var _writableStream = require2("./writable-stream");
          var _writableStream2 = _interopRequireDefault(_writableStream);
          var TransformStream2 = function TransformStream3(transformer) {
            _classCallCheck(this, TransformStream3);
            if (transformer.flush === void 0) {
              transformer.flush = function(enqueue, close) {
                return close();
              };
            }
            if (typeof transformer.transform !== "function") {
              throw new TypeError("transform must be a function");
            }
            var writeChunk = void 0, writeDone = void 0, errorWritable = void 0;
            var transforming = false;
            var chunkWrittenButNotYetTransformed = false;
            this.writable = new _writableStream2["default"]({
              start: function start(error) {
                errorWritable = error;
              },
              write: function write(chunk) {
                writeChunk = chunk;
                chunkWrittenButNotYetTransformed = true;
                var p = new Promise(function(resolve) {
                  return writeDone = resolve;
                });
                maybeDoTransform();
                return p;
              },
              abort(e) {
                errorReadable(e);
              },
              close: function close() {
                try {
                  transformer.flush(enqueueInReadable, closeReadable);
                } catch (e) {
                  errorWritable(e);
                  errorReadable(e);
                }
              }
            }, transformer.writableStrategy);
            var enqueueInReadable = void 0, closeReadable = void 0, errorReadable = void 0;
            this.readable = new _readableStream2["default"]({
              start: function start(c) {
                enqueueInReadable = c.enqueue.bind(c);
                closeReadable = c.close.bind(c);
                errorReadable = c.error.bind(c);
              },
              pull: function pull() {
                if (chunkWrittenButNotYetTransformed === true) {
                  maybeDoTransform();
                }
              }
            }, transformer.readableStrategy);
            function maybeDoTransform() {
              if (transforming === false) {
                transforming = true;
                try {
                  transformer.transform(writeChunk, enqueueInReadable, transformDone);
                  writeChunk = void 0;
                  chunkWrittenButNotYetTransformed = false;
                } catch (e) {
                  transforming = false;
                  errorWritable(e);
                  errorReadable(e);
                }
              }
            }
            function transformDone() {
              transforming = false;
              writeDone();
            }
          };
          exports3["default"] = TransformStream2;
          module3.exports = exports3["default"];
        }, { "./readable-stream": 7, "./writable-stream": 10 }], 9: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          exports3.rethrowAssertionErrorRejection = rethrowAssertionErrorRejection;
          var _assert = require2("./assert");
          function rethrowAssertionErrorRejection(e) {
            if (e && e.constructor === _assert.assert.AssertionError) {
              setTimeout(function() {
                throw e;
              }, 0);
            }
          }
        }, { "./assert": 1 }], 10: [function(require2, module3, exports3) {
          "use strict";
          Object.defineProperty(exports3, "__esModule", {
            value: true
          });
          var _createClass = function() {
            function defineProperties(target, props) {
              for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor)
                  descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
              }
            }
            return function(Constructor, protoProps, staticProps) {
              if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
              if (staticProps)
                defineProperties(Constructor, staticProps);
              return Constructor;
            };
          }();
          exports3.IsWritableStream = IsWritableStream;
          function _interopRequireDefault(obj) {
            return obj && obj.__esModule ? obj : { "default": obj };
          }
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          var _assert = require2("./assert");
          var _helpers = require2("./helpers");
          var _utils = require2("./utils");
          var _queueWithSizes = require2("./queue-with-sizes");
          var _countQueuingStrategy = require2("./count-queuing-strategy");
          var _countQueuingStrategy2 = _interopRequireDefault(_countQueuingStrategy);
          var WritableStream2 = function() {
            function WritableStream3() {
              var _this = this;
              var underlyingSink = arguments[0] === void 0 ? {} : arguments[0];
              var _ref = arguments[1] === void 0 ? {} : arguments[1];
              var size = _ref.size;
              var _ref$highWaterMark = _ref.highWaterMark;
              var highWaterMark = _ref$highWaterMark === void 0 ? 0 : _ref$highWaterMark;
              _classCallCheck(this, WritableStream3);
              this._underlyingSink = underlyingSink;
              this._closedPromise = new Promise(function(resolve, reject) {
                _this._closedPromise_resolve = resolve;
                _this._closedPromise_reject = reject;
              });
              this._readyPromise = Promise.resolve(void 0);
              this._readyPromise_resolve = null;
              this._queue = [];
              this._state = "writable";
              this._started = false;
              this._writing = false;
              var normalizedStrategy = (0, _helpers.ValidateAndNormalizeQueuingStrategy)(size, highWaterMark);
              this._strategySize = normalizedStrategy.size;
              this._strategyHWM = normalizedStrategy.highWaterMark;
              SyncWritableStreamStateWithQueue(this);
              var error = closure_WritableStreamErrorFunction();
              error._stream = this;
              var startResult = (0, _helpers.InvokeOrNoop)(underlyingSink, "start", [error]);
              this._startedPromise = Promise.resolve(startResult);
              this._startedPromise.then(function() {
                _this._started = true;
                _this._startedPromise = void 0;
              });
              this._startedPromise["catch"](function(r) {
                return ErrorWritableStream(_this, r);
              })["catch"](_utils.rethrowAssertionErrorRejection);
            }
            _createClass(WritableStream3, [{
              key: "closed",
              get: function() {
                if (!IsWritableStream(this)) {
                  return Promise.reject(new TypeError("WritableStream.prototype.closed can only be used on a WritableStream"));
                }
                return this._closedPromise;
              }
            }, {
              key: "state",
              get: function() {
                if (!IsWritableStream(this)) {
                  throw new TypeError("WritableStream.prototype.state can only be used on a WritableStream");
                }
                return this._state;
              }
            }, {
              key: "abort",
              value: function abort(reason) {
                if (!IsWritableStream(this)) {
                  return Promise.reject(new TypeError("WritableStream.prototype.abort can only be used on a WritableStream"));
                }
                if (this._state === "closed") {
                  return Promise.resolve(void 0);
                }
                if (this._state === "errored") {
                  return Promise.reject(this._storedError);
                }
                ErrorWritableStream(this, reason);
                var sinkAbortPromise = (0, _helpers.PromiseInvokeOrFallbackOrNoop)(this._underlyingSink, "abort", [reason], "close", []);
                return sinkAbortPromise.then(function() {
                  return void 0;
                });
              }
            }, {
              key: "close",
              value: function close() {
                if (!IsWritableStream(this)) {
                  return Promise.reject(new TypeError("WritableStream.prototype.close can only be used on a WritableStream"));
                }
                if (this._state === "closing") {
                  return Promise.reject(new TypeError("cannot close an already-closing stream"));
                }
                if (this._state === "closed") {
                  return Promise.reject(new TypeError("cannot close an already-closed stream"));
                }
                if (this._state === "errored") {
                  return Promise.reject(this._storedError);
                }
                if (this._state === "waiting") {
                  this._readyPromise_resolve(void 0);
                }
                this._state = "closing";
                (0, _queueWithSizes.EnqueueValueWithSize)(this._queue, "close", 0);
                CallOrScheduleWritableStreamAdvanceQueue(this);
                return this._closedPromise;
              }
            }, {
              key: "ready",
              get: function() {
                if (!IsWritableStream(this)) {
                  return Promise.reject(new TypeError("WritableStream.prototype.ready can only be used on a WritableStream"));
                }
                return this._readyPromise;
              }
            }, {
              key: "write",
              value: function write(chunk) {
                if (!IsWritableStream(this)) {
                  return Promise.reject(new TypeError("WritableStream.prototype.write can only be used on a WritableStream"));
                }
                if (this._state === "closing") {
                  return Promise.reject(new TypeError("cannot write while stream is closing"));
                }
                if (this._state === "closed") {
                  return Promise.reject(new TypeError("cannot write after stream is closed" + new Error().stack));
                }
                if (this._state === "errored") {
                  return Promise.reject(this._storedError);
                }
                (0, _assert.assert)(this._state === "waiting" || this._state === "writable");
                var chunkSize = 1;
                if (this._strategySize !== void 0) {
                  try {
                    chunkSize = this._strategySize(chunk);
                  } catch (chunkSizeE) {
                    ErrorWritableStream(this, chunkSizeE);
                    return Promise.reject(chunkSizeE);
                  }
                }
                var resolver = void 0, rejecter = void 0;
                var promise = new Promise(function(resolve, reject) {
                  resolver = resolve;
                  rejecter = reject;
                });
                var writeRecord = { promise, chunk, _resolve: resolver, _reject: rejecter };
                try {
                  (0, _queueWithSizes.EnqueueValueWithSize)(this._queue, writeRecord, chunkSize);
                } catch (enqueueResultE) {
                  ErrorWritableStream(this, enqueueResultE);
                  return Promise.reject(enqueueResultE);
                }
                try {
                  SyncWritableStreamStateWithQueue(this);
                } catch (syncResultE) {
                  ErrorWritableStream(this, syncResultE);
                  return promise;
                }
                CallOrScheduleWritableStreamAdvanceQueue(this);
                return promise;
              }
            }]);
            return WritableStream3;
          }();
          exports3["default"] = WritableStream2;
          function closure_WritableStreamErrorFunction() {
            var f = function f2(e) {
              return ErrorWritableStream(f2._stream, e);
            };
            return f;
          }
          function CallOrScheduleWritableStreamAdvanceQueue(stream) {
            if (stream._started === false) {
              stream._startedPromise.then(function() {
                WritableStreamAdvanceQueue(stream);
              })["catch"](_utils.rethrowAssertionErrorRejection);
              return void 0;
            }
            if (stream._started === true) {
              return WritableStreamAdvanceQueue(stream);
            }
          }
          function CloseWritableStream(stream) {
            (0, _assert.assert)(stream._state === "closing", "stream must be in closing state while calling CloseWritableStream");
            var sinkClosePromise = (0, _helpers.PromiseInvokeOrNoop)(stream._underlyingSink, "close");
            sinkClosePromise.then(function() {
              if (stream._state === "errored") {
                return;
              }
              (0, _assert.assert)(stream._state === "closing");
              stream._closedPromise_resolve(void 0);
              stream._state = "closed";
            }, function(r) {
              return ErrorWritableStream(stream, r);
            })["catch"](_utils.rethrowAssertionErrorRejection);
          }
          function ErrorWritableStream(stream, e) {
            if (stream._state === "closed" || stream._state === "errored") {
              return void 0;
            }
            while (stream._queue.length > 0) {
              var writeRecord = (0, _queueWithSizes.DequeueValue)(stream._queue);
              if (writeRecord !== "close") {
                writeRecord._reject(e);
              }
            }
            stream._storedError = e;
            if (stream._state === "waiting") {
              stream._readyPromise_resolve(void 0);
            }
            stream._closedPromise_reject(e);
            stream._state = "errored";
          }
          function IsWritableStream(x) {
            if (!(0, _helpers.typeIsObject)(x)) {
              return false;
            }
            if (!Object.prototype.hasOwnProperty.call(x, "_underlyingSink")) {
              return false;
            }
            return true;
          }
          function SyncWritableStreamStateWithQueue(stream) {
            if (stream._state === "closing") {
              return void 0;
            }
            (0, _assert.assert)(stream._state === "writable" || stream._state === "waiting", "stream must be in a writable or waiting state while calling SyncWritableStreamStateWithQueue");
            var queueSize = (0, _queueWithSizes.GetTotalQueueSize)(stream._queue);
            var shouldApplyBackpressure = queueSize > stream._strategyHWM;
            if (shouldApplyBackpressure === true && stream._state === "writable") {
              stream._state = "waiting";
              stream._readyPromise = new Promise(function(resolve, reject) {
                stream._readyPromise_resolve = resolve;
              });
            }
            if (shouldApplyBackpressure === false && stream._state === "waiting") {
              stream._state = "writable";
              stream._readyPromise_resolve(void 0);
            }
            return void 0;
          }
          function WritableStreamAdvanceQueue(stream) {
            if (stream._queue.length === 0 || stream._writing === true) {
              return void 0;
            }
            var writeRecord = (0, _queueWithSizes.PeekQueueValue)(stream._queue);
            if (writeRecord === "close") {
              (0, _assert.assert)(stream._state === "closing", "can't process final write record unless already closing");
              (0, _queueWithSizes.DequeueValue)(stream._queue);
              (0, _assert.assert)(stream._queue.length === 0, "queue must be empty once the final write record is dequeued");
              return CloseWritableStream(stream);
            } else {
              stream._writing = true;
              (0, _helpers.PromiseInvokeOrNoop)(stream._underlyingSink, "write", [writeRecord.chunk]).then(function() {
                if (stream._state === "errored") {
                  return;
                }
                stream._writing = false;
                writeRecord._resolve(void 0);
                (0, _queueWithSizes.DequeueValue)(stream._queue);
                try {
                  SyncWritableStreamStateWithQueue(stream);
                } catch (syncResultE) {
                  return ErrorWritableStream(stream, syncResultE);
                }
                return WritableStreamAdvanceQueue(stream);
              }, function(r) {
                return ErrorWritableStream(stream, r);
              })["catch"](_utils.rethrowAssertionErrorRejection);
            }
          }
        }, { "./assert": 1, "./count-queuing-strategy": 3, "./helpers": 4, "./queue-with-sizes": 6, "./utils": 9 }] }, {}, [5])(5);
      });
    }
  });

  // src/backend/worker-setup.js
  init_logic();
  init_worker_router();

  // src/backend/mailbridge.js
  init_logic();
  init_mailchew_strings();

  // src/backend/bridge/bridge_context.js
  init_logic();
  var NamedContext = class {
    constructor(name, type, bridgeContext) {
      logic.defineScope(this, type, {
        name,
        bridge: bridgeContext.bridge.name
      });
      this.name = name;
      this._bridgeContext = bridgeContext;
      this._active = true;
      this._stuffToRelease = [];
      this.__childContexts = [];
      this.pendingCommand = null;
      this.commandQueue = [];
    }
    get batchManager() {
      return this._bridgeContext.batchManager;
    }
    get dataOverlayManager() {
      return this._bridgeContext.dataOverlayManager;
    }
    acquire(acquireable) {
      if (!this._active) {
        throw new Error("we have already cleaned up!");
      }
      this._stuffToRelease.push(acquireable);
      return acquireable.__acquire(this);
    }
    sendMessage(type, data) {
      this._bridgeContext.bridge.__sendMessage({
        type,
        handle: this.name,
        data
      });
    }
    runAtCleanup(func) {
      this._stuffToRelease.push({
        __release: func
      });
    }
    cleanup() {
      this._active = false;
      for (let acquireable of this._stuffToRelease) {
        try {
          acquireable.__release(this);
        } catch (ex) {
          logic(this, "problemReleasing", {
            what: acquireable,
            ex,
            stack: ex && ex.stack
          });
        }
      }
    }
  };
  var BridgeContext = class {
    constructor({ bridge, batchManager, dataOverlayManager, taskGroupTracker }) {
      logic.defineScope(this, "BridgeContext", { name: bridge.name });
      this.bridge = bridge;
      this.batchManager = batchManager;
      this.dataOverlayManager = dataOverlayManager;
      this.taskGroupTracker = taskGroupTracker;
      this._namedContexts = new Map();
      this.taskGroupTracker.on("rootTaskGroupCompleted", this, "onRootTaskGroupCompleted");
    }
    onRootTaskGroupCompleted() {
      this.batchManager.flushBecauseTaskGroupCompleted();
    }
    createNamedContext(name, type, parentContext) {
      let ctx = new NamedContext(name, type, this);
      this._namedContexts.set(name, ctx);
      if (parentContext) {
        parentContext.__childContexts.push(ctx);
      }
      return ctx;
    }
    getNamedContextOrThrow(name) {
      if (this._namedContexts.has(name)) {
        return this._namedContexts.get(name);
      }
      throw new Error("no such namedContext: " + name);
    }
    maybeGetNamedContext(name) {
      return this._namedContexts.get(name);
    }
    cleanupNamedContext(name) {
      if (!this._namedContexts.has(name)) {
        return;
      }
      const ctx = this._namedContexts.get(name);
      for (let childContext of ctx.__childContexts) {
        this.cleanupNamedContext(childContext.name);
      }
      this._namedContexts.delete(name);
      ctx.cleanup();
    }
    cleanupAll() {
      for (let namedContext of this._namedContext.values()) {
        namedContext.cleanup();
      }
      this._namedContexts.clear();
    }
    shutdown() {
      this.taskGroupTracker.removeObjectListener(this);
      this.cleanupAll();
    }
  };

  // src/backend/bridge/batch_manager.js
  init_logic();
  var BatchManager = class {
    constructor(db) {
      logic.defineScope(this, "BatchManager");
      this._db = db;
      this._pendingProxies = new Set();
      this._timer = null;
      this._bound_timerFired = this._flushPending.bind(this, true, false);
      this._bound_dbFlush = this._flushPending.bind(this, false, false);
      this.flushDelayMillis = 5e3;
      this._db.on("cacheDrop", this._bound_dbFlush);
    }
    __cleanup() {
      this._db.removeListener("cacheDrop", this._bound_dbFlush);
    }
    _flushPending(timerFired, coherentSnapshot) {
      if (!timerFired) {
        globalThis.clearTimeout(this._timer);
      }
      this._timer = null;
      logic(this, "flushing", {
        proxyCount: this._pendingProxies.size,
        tocTypes: Array.from(this._pendingProxies).map((proxy) => {
          return proxy.toc.type;
        }),
        timerFired,
        coherentSnapshot
      });
      for (let proxy of this._pendingProxies) {
        if (!proxy.dirty && !coherentSnapshot) {
          continue;
        }
        const payload = proxy.flush();
        payload.coherentSnapshot &&= coherentSnapshot;
        proxy.ctx.sendMessage("update", payload);
        if (payload.coherentSnapshot) {
          proxy.needsCoherentFlush = false;
          this._pendingProxies.delete(proxy);
        }
      }
    }
    flushBecauseTaskGroupCompleted() {
      this._flushPending(false, true);
    }
    registerDirtyView(proxy, flushMode) {
      logic(this, "dirtying", {
        tocType: proxy.toc.type,
        ctxName: proxy.ctx.name,
        flushMode,
        alreadyDirty: this._pendingProxies.has(proxy)
      });
      this._pendingProxies.add(proxy);
      if (flushMode) {
        if (flushMode === "immediate") {
          this._flushPending(false);
        } else if (this._timer !== true) {
          if (this._timer) {
            globalThis.clearTimeout(this._timer);
          }
          Promise.resolve().then(() => {
            this._flushPending(false);
          });
          this._timer = true;
        }
      } else if (!this._timer) {
        this._timer = globalThis.setTimeout(this._bound_timerFired, this.flushDelayMillis);
      }
    }
  };

  // src/backend/bridge/entire_list_proxy.js
  init_logic();
  function EntireListProxy(toc, ctx) {
    logic.defineScope(this, "EntireListProxy", { tocType: toc.type });
    this.toc = toc;
    this.ctx = ctx;
    this.batchManager = ctx.batchManager;
    this.overlayResolver = ctx.dataOverlayManager.makeBoundResolver(toc.overlayNamespace, ctx);
    this._bound_onAdd = this.onAdd.bind(this);
    this._bound_onChange = this.onChange.bind(this);
    this._bound_onOverlayPush = this.onOverlayPush.bind(this);
    this._bound_onRemove = this.onRemove.bind(this);
    this._pendingChanges = [];
    this._idToChangeIndex = new Map();
    this.dirty = true;
    this.needsCoherentFlush = true;
    this._active = false;
  }
  EntireListProxy.prototype = {
    populateFromList() {
      let items = this.toc.getAllItems();
      for (let i = 0; i < items.length; i++) {
        this.onAdd(items[i], i);
      }
      this.batchManager.registerDirtyView(this, "immediate");
      this.toc.on("add", this._bound_onAdd);
      this.toc.on("change", this._bound_onChange);
      this.toc.on("remove", this._bound_onRemove);
      this.ctx.dataOverlayManager.on(this.toc.overlayNamespace, this._bound_onOverlayPush);
    },
    __acquire() {
      return Promise.resolve(this);
    },
    __release() {
      if (!this._active) {
        return;
      }
      this._active = false;
      this.toc.removeListener("add", this._bound_onAdd);
      this.toc.removeListener("change", this._bound_onChange);
      this.toc.removeListener("remove", this._bound_onRemove);
      this.ctx.dataOverlayManager.removeListener(this.toc.overlayNamespace, this._bound_onOverlayPush);
    },
    _dirty() {
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this);
    },
    onAdd(item, index) {
      this._dirty();
      this._idToChangeIndex.set(item.id, this._pendingChanges.length);
      this._pendingChanges.push({
        type: "add",
        index,
        state: item,
        overlays: this.overlayResolver(item.id)
      });
    },
    onChange(item, index) {
      if (this._idToChangeIndex.has(item.id)) {
        let changeIndex = this._idToChangeIndex.get(item.id);
        this._pendingChanges[changeIndex].state = item;
        return;
      }
      this._dirty();
      this._idToChangeIndex.set(item.id, this._pendingChanges.length);
      this._pendingChanges.push({
        type: "change",
        index,
        state: item,
        overlays: null
      });
    },
    onOverlayPush(itemId) {
      if (!this.toc.itemsById.has(itemId)) {
        return;
      }
      let overlays = this.overlayResolver(itemId);
      if (this._idToChangeIndex.has(itemId)) {
        let changeIndex = this._idToChangeIndex.get(itemId);
        this._pendingChanges[changeIndex].overlays = overlays;
        return;
      }
      this._dirty();
      this._idToChangeIndex.set(itemId, this._pendingChanges.length);
      this._pendingChanges.push({
        type: "change",
        index: this.toc.getItemIndexById(itemId),
        state: null,
        overlays
      });
    },
    onRemove(id, index) {
      this._dirty();
      this._pendingChanges.push({
        type: "remove",
        index
      });
      this._idToChangeIndex.delete(id);
    },
    flush() {
      let changes = this._pendingChanges;
      this._pendingChanges = [];
      this._idToChangeIndex.clear();
      this.dirty = false;
      return {
        changes,
        coherentSnapshot: true
      };
    }
  };

  // src/backend/bridge/windowed_list_proxy.js
  function WindowedListProxy(toc, ctx) {
    this.toc = toc;
    this.ctx = ctx;
    this.batchManager = ctx.batchManager;
    this.dirty = false;
    this.needsCoherentFlush = false;
    this.dirtyMeta = true;
    this.validDataSet = new Set();
    this.pendingBroadcastEvents = [];
    this.validOverlaySet = new Set();
    this._bound_onChange = this.onChange.bind(this);
    this._bound_onTOCMetaChange = this.onTOCMetaChange.bind(this);
    this._bound_onBroadcastEvent = this.onBroadcastEvent.bind(this);
    this._bound_onOverlayPush = this.onOverlayPush.bind(this);
  }
  WindowedListProxy.prototype = {
    __acquire() {
      this.toc.on("change", this._bound_onChange);
      this.toc.on("tocMetaChange", this._bound_onTOCMetaChange);
      this.toc.on("broadcastEvent", this._bound_onBroadcastEvent);
      this.ctx.dataOverlayManager.on(this.toc.overlayNamespace, this._bound_onOverlayPush);
      return Promise.resolve(this);
    },
    __release() {
      this.toc.removeListener("change", this._bound_onChange);
      this.toc.removeListener("tocMetaChange", this._bound_onTOCMetaChange);
      this.toc.removeListener("broadcastEvent", this._bound_onBroadcastEvent);
      this.ctx.dataOverlayManager.removeListener(this.toc.overlayNamespace, this._bound_onOverlayPush);
    },
    seek(req) {
      if (req.mode === "top") {
        this.mode = req.mode;
        this.focusKey = null;
        this.bufferAbove = 0;
        this.visibleAbove = 0;
        this.visibleBelow = req.visibleDesired;
        this.bufferBelow = req.bufferDesired;
      } else if (req.mode === "bottom") {
        this.mode = req.mode;
        this.focusKey = null;
        this.bufferAbove = req.bufferDesired;
        this.visibleAbove = req.visibleDesired;
        this.visibleBelow = 0;
        this.bufferBelow = 0;
      } else if (req.mode === "focus") {
        this.mode = req.mode;
        this.focusKey = req.focusKey;
        this.bufferAbove = req.bufferAbove;
        this.visibleAbove = req.visibleAbove;
        this.visibleBelow = req.visibleBelow;
        this.bufferBelow = req.bufferBelow;
      } else if (req.mode === "focusIndex") {
        this.mode = "focus";
        this.focusKey = this.toc.getOrderingKeyForIndex(req.index);
        this.bufferAbove = req.bufferAbove;
        this.visibleAbove = req.visibleAbove;
        this.visibleBelow = req.visibleBelow;
        this.bufferBelow = req.bufferBelow;
      } else if (req.mode === "coordinates") {
        if (this.toc.heightAware) {
          this.mode = req.mode;
          let focalOffset = req.offset + req.before;
          let { orderingKey, offset } = this.toc.getInfoForOffset(focalOffset);
          this.focusKey = orderingKey;
          let focusUnitsNotVisible = Math.max(0, focalOffset - offset);
          this.bufferAbove = req.before - focusUnitsNotVisible;
          this.visibleAbove = 0;
          this.visibleBelow = req.visible - (offset - focalOffset);
          this.bufferBelow = req.after;
        } else {
          this.mode = "focus";
          this.focusKey = this.toc.getOrderingKeyForIndex(req.offset);
          this.bufferAbove = req.before;
          this.visibleAbove = 0;
          this.visibleBelow = req.visible;
          this.bufferBelow = req.after;
        }
      } else {
        throw new Error("bogus seek mode: " + req.mode);
      }
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this, "immediate");
    },
    onChange(id, dataOnly) {
      if (id === true) {
        this.validDataSet.clear();
      } else if (id !== null) {
        if (!this.validDataSet.has(id) && dataOnly) {
          return;
        }
        this.validDataSet.delete(id);
      }
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this);
    },
    onOverlayPush(id) {
      if (!this.validOverlaySet.has(id)) {
        return;
      }
      this.validOverlaySet.delete(id);
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this);
    },
    onTOCMetaChange() {
      this.dirtyMeta = true;
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this);
    },
    onBroadcastEvent(eventName, eventData) {
      this.pendingBroadcastEvents.push({ name: eventName, data: eventData });
      this.dirty = true;
      this.needsCoherentFlush = true;
      this.batchManager.registerDirtyView(this, "soon");
    },
    flush() {
      if (this.dirty && this.toc.flush) {
        this.toc.flush();
      }
      let beginBufferedInclusive, beginVisibleInclusive, endVisibleExclusive, endBufferedExclusive, heightOffset;
      if (this.mode === "top") {
        beginBufferedInclusive = beginVisibleInclusive = 0;
        endVisibleExclusive = Math.min(this.toc.length, this.visibleBelow + 1);
        endBufferedExclusive = Math.min(this.toc.length, endVisibleExclusive + this.bufferBelow);
      } else if (this.mode === "bottom") {
        endBufferedExclusive = endVisibleExclusive = this.toc.length;
        beginVisibleInclusive = Math.max(0, endVisibleExclusive - this.visibleAbove);
        beginBufferedInclusive = Math.max(0, beginVisibleInclusive - this.bufferedAbove);
      } else if (this.mode === "focus") {
        let focusIndex = this.toc.findIndexForOrderingKey(this.focusKey);
        beginVisibleInclusive = Math.max(0, focusIndex - this.visibleAbove);
        beginBufferedInclusive = Math.max(0, beginVisibleInclusive - this.bufferAbove);
        endVisibleExclusive = Math.min(this.toc.length, focusIndex + this.visibleBelow + 1);
        endBufferedExclusive = Math.min(this.toc.length, endVisibleExclusive + this.bufferBelow);
      } else if (this.mode === "coordinates") {
        ({
          beginBufferedInclusive,
          beginVisibleInclusive,
          endVisibleExclusive,
          endBufferedExclusive,
          heightOffset
        } = this.toc.findIndicesFromCoordinateSoup({
          orderingKey: this.focusKey,
          bufferAbove: this.bufferAbove,
          visibleAbove: this.visibleAbove,
          visibleBelow: this.visibleBelow,
          bufferBelow: this.bufferBelow
        }));
      }
      this.dirty = false;
      let {
        ids,
        state,
        readPromise,
        newValidDataSet
      } = this.toc.getDataForSliceRange(beginBufferedInclusive, endBufferedExclusive, this.validDataSet, this.validOverlaySet);
      this.validDataSet = newValidDataSet;
      this.validOverlaySet = new Set(newValidDataSet);
      if (readPromise) {
        readPromise.then(() => {
          this.batchManager.registerDirtyView(this, "immediate");
        });
      }
      let sendMeta = null;
      if (this.dirtyMeta) {
        sendMeta = this.toc.tocMeta;
        this.dirtyMeta = false;
      }
      let sendEvents = null;
      if (this.pendingBroadcastEvents.length) {
        sendEvents = this.pendingBroadcastEvents;
        this.pendingBroadcastEvents = [];
      }
      return {
        offset: beginBufferedInclusive,
        heightOffset: heightOffset || beginBufferedInclusive,
        totalCount: this.toc.length,
        totalHeight: this.toc.totalHeight,
        tocMeta: sendMeta,
        ids,
        values: state,
        events: sendEvents,
        coherentSnapshot: !readPromise
      };
    }
  };

  // src/backend/mailbridge.js
  init_date();

  // src/backend/parsers/parsers.js
  init_feed_parser();
  init_feed_parser2();
  init_feed_parser3();
  async function TEST_parseFeed(parserType, code, url) {
    switch (parserType) {
      case "rss":
        return parseFeed(code);
      case "hfeed":
        return parseHFeed(code, url);
      case "jsonfeed":
        return parseJsonFeed(code, url);
    }
    return null;
  }

  // src/backend/mailbridge.js
  function MailBridge(universe2, db, name) {
    logic.defineScope(this, "MailBridge", { name });
    this.name = name;
    this.universe = universe2;
    this.universe.registerBridge(this);
    this.db = db;
    this.batchManager = new BatchManager(db);
    this.bridgeContext = new BridgeContext({
      bridge: this,
      batchManager: this.batchManager,
      taskGroupTracker: this.universe.taskGroupTracker,
      dataOverlayManager: this.universe.dataOverlayManager
    });
  }
  MailBridge.prototype = {
    shutdown() {
      this.bridgeContext.shutdown();
    },
    __sendMessage() {
      throw new Error("This is supposed to get hidden by an instance var.");
    },
    __receiveMessage(msg) {
      let replyFunc = void 0;
      let implCmdName;
      if (msg.type === "promised") {
        const promisedHandle = msg.handle;
        let repliedAlready = false;
        replyFunc = (data) => {
          if (repliedAlready) {
            return;
          }
          this.__sendMessage({
            type: "promisedResult",
            handle: promisedHandle,
            data
          });
          repliedAlready = true;
        };
        msg = msg.wrapped;
        implCmdName = `_promised_${msg.type}`;
      } else {
        implCmdName = `_cmd_${msg.type}`;
      }
      if (!(implCmdName in this)) {
        logic(this, "badMessageTypeError", { type: msg.type });
        return;
      }
      try {
        let namedContext = msg.handle && this.bridgeContext.maybeGetNamedContext(msg.handle);
        if (namedContext) {
          if (namedContext.pendingCommand) {
            namedContext.commandQueue.push([msg, implCmdName, replyFunc]);
          } else {
            let promise = namedContext.pendingCommand = this._processCommand(msg, implCmdName, replyFunc);
            if (promise) {
              this._trackCommandForNamedContext(namedContext, promise);
            }
          }
        } else {
          let promise = this._processCommand(msg, implCmdName, replyFunc);
          if (promise && msg.handle) {
            namedContext = this.bridgeContext.maybeGetNamedContext(msg.handle);
            if (namedContext) {
              namedContext.pendingCommand = promise;
              this._trackCommandForNamedContext(namedContext, promise);
            }
          }
        }
      } catch (ex) {
        logic(this, "cmdError", { type: msg.type, ex, stack: ex.stack });
      }
    },
    _trackCommandForNamedContext(namedContext, promise) {
      let successNext = () => {
        this._commandCompletedProcessNextCommandInQueue(namedContext);
      };
      let errorNext = (err) => {
        logic(this, "cmdAsyncError", { err, stack: err.stack });
        this._commandCompletedProcessNextCommandInQueue(namedContext);
      };
      promise.then(successNext, errorNext);
    },
    _commandCompletedProcessNextCommandInQueue(namedContext) {
      if (namedContext.commandQueue.length) {
        let promise = namedContext.pendingCommand = this._processCommand(...namedContext.commandQueue.shift());
        if (promise) {
          let runNext = () => {
            this._commandCompletedProcessNextCommandInQueue(namedContext);
          };
          promise.then(runNext, runNext);
        }
      } else {
        namedContext.pendingCommand = null;
      }
    },
    broadcast(name, data) {
      this.__sendMessage({
        type: "broadcast",
        payload: { name, data }
      });
    },
    _processCommand(msg, implCmdName, replyFunc) {
      logic(this, "cmd", {
        type: msg.type,
        msg
      });
      try {
        let result = this[implCmdName](msg, replyFunc);
        if (result && result.then) {
          logic.await(this, "asyncCommand", { type: msg.type }, result);
          return result;
        }
      } catch (ex) {
        console.error("problem processing", implCmdName, ex, ex.stack);
        logic.fail(ex);
        return null;
      }
      return null;
    },
    _cmd_ping(msg) {
      this.__sendMessage({
        type: "pong",
        handle: msg.handle
      });
    },
    _cmd_TEST_timeWarp(msg) {
      logic(this, "timeWarp", { fakeNow: msg.fakeNow });
      TEST_LetsDoTheTimewarpAgain(msg.fakeNow);
    },
    async _promised_TEST_parseFeed(msg, replyFunc) {
      logic(this, "parseFeed", {
        parserType: msg.parserType,
        code: `${msg.code.slice(0, 128)}...`
      });
      const data = await TEST_parseFeed(msg.parserType, msg.code, msg.url);
      replyFunc(data);
    },
    _cmd_setInteractive() {
      this.universe.setInteractive();
    },
    _cmd_localizedStrings(msg) {
      set(msg.strings);
    },
    _promised_learnAboutAccount(msg, replyFunc) {
      this.universe.learnAboutAccount(msg.details).then((info) => {
        replyFunc(info);
      }, () => {
        replyFunc({ result: "no-config-info", configInfo: null });
      });
    },
    _promised_tryToCreateAccount(msg, replyFunc) {
      this.universe.tryToCreateAccount(msg.userDetails, msg.domainInfo).then((result) => {
        replyFunc(result);
      });
    },
    async _promised_syncFolderList(msg, replyFunc) {
      await this.universe.syncFolderList(msg.accountId, "bridge");
      replyFunc(null);
    },
    async _promised_modifyFolder(msg, replyFunc) {
      await this.universe.modifyFolder(msg.accountId, msg.mods, "bridge");
      replyFunc(null);
    },
    async _cmd_clearAccountProblems(msg) {
      var account = this.universe.getAccountForAccountId(msg.accountId), self2 = this;
      let [incomingErr, outgoingErr] = await account.checkAccount();
      let canIgnoreError = function(err) {
        return !err || err !== "bad-user-or-pass" && err !== "bad-address" && err !== "needs-oauth-reauth" && err !== "imap-disabled";
      };
      if (canIgnoreError(incomingErr) && canIgnoreError(outgoingErr)) {
        self2.universe.clearAccountProblems(account);
      }
      self2.__sendMessage({
        type: "clearAccountProblems",
        handle: msg.handle
      });
    },
    async _promised_modifyConfig(msg, replyFunc) {
      await this.universe.modifyConfig(msg.mods, "bridge");
      replyFunc(null);
    },
    async _promised_modifyAccount(msg, replyFunc) {
      await this.universe.modifyAccount(msg.accountId, msg.mods, "bridge");
      replyFunc(null);
    },
    _cmd_recreateAccount(msg) {
      this.universe.recreateAccount(msg.accountId, "bridge");
    },
    async _promised_deleteAccount(msg, replyFunc) {
      await this.universe.deleteAccount(msg.accountId, "bridge");
      replyFunc(null);
    },
    async _promised_modifyIdentity(msg, replyFunc) {
      await this.universe.modifyIdentity(msg.identityId, msg.mods, "bridge");
      replyFunc(null);
    },
    notifyBadLogin(account, problem, whichSide) {
      this.__sendMessage({
        type: "badLogin",
        account: account.toBridgeWire(),
        problem,
        whichSide
      });
    },
    _cmd_requestBodies(msg) {
      var self2 = this;
      this.universe.downloadBodies(msg.messages, msg.options, function() {
        self2.__sendMessage({
          type: "requestBodiesComplete",
          handle: msg.handle,
          requestId: msg.requestId
        });
      });
    },
    async _cmd_viewAccounts(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "AccountsView");
      let toc = await this.universe.acquireAccountsTOC(ctx);
      ctx.proxy = new EntireListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
      ctx.proxy.populateFromList();
    },
    async _cmd_viewFolders(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "FoldersView");
      let toc = await this.universe.acquireAccountFoldersTOC(ctx, msg.accountId);
      ctx.proxy = new EntireListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
      ctx.proxy.populateFromList();
    },
    async _cmd_viewRawList(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "RawListView");
      ctx.viewing = {
        type: "raw",
        namespace: msg.namespace,
        name: msg.name
      };
      let toc = await this.universe.acquireExtensionTOC(ctx, msg.namespace, msg.name);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_viewFolderConversations(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "FolderConversationsView");
      ctx.viewing = {
        type: "folder",
        folderId: msg.folderId
      };
      let toc = await this.universe.acquireFolderConversationsTOC(ctx, msg.folderId);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
      this.universe.syncRefreshFolder(msg.folderId, "viewFolderConversations");
    },
    async _cmd_searchFolderConversations(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "FolderConversationsSearchView");
      ctx.viewing = {
        type: "folder",
        folderId: msg.spec.folderId
      };
      let spec = msg.spec;
      if (msg.viewDefsWithHandles) {
        let viewDefsWithContexts = msg.viewDefsWithHandles.map(({ handle, viewDef }) => {
          let viewCtx = this.bridgeContext.createNamedContext(handle, "DerivedView", ctx);
          viewCtx.viewing = {
            type: "derived"
          };
          return { ctx: viewCtx, viewDef };
        });
        spec = Object.assign({}, spec, { viewDefsWithContexts });
      }
      let toc = await this.universe.acquireSearchConversationsTOC(ctx, spec);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_viewFolderMessages(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "FolderMessagesView");
      ctx.viewing = {
        type: "folder",
        folderId: msg.folderId
      };
      let toc = await this.universe.acquireFolderMessagesTOC(ctx, msg.folderId);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
      this.universe.syncRefreshFolder(msg.folderId, "viewFolderMessages");
    },
    async _cmd_searchFolderMessages(msg) {
      const ctx = this.bridgeContext.createNamedContext(msg.handle, "FolderMessagesSearchView");
      ctx.viewing = {
        type: "folder",
        folderId: msg.spec.folderId
      };
      const toc = await this.universe.acquireSearchMessagesTOC(ctx, msg.spec);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_searchAccountMessages(msg) {
      const ctx = this.bridgeContext.createNamedContext(msg.handle, "AccountMessagesSearchView");
      ctx.viewing = {
        type: "account",
        accountId: msg.spec.accountId
      };
      const toc = await this.universe.acquireSearchAccountMessagesTOC(ctx, msg.spec);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_searchAllMessages(msg) {
      const ctx = this.bridgeContext.createNamedContext(msg.handle, "AllSearchView");
      const allAccountIds = msg.spec.accountIds = this.universe.getAllAccountIdsWithKind(msg.spec.kind);
      ctx.viewing = {
        type: "account",
        accountId: allAccountIds
      };
      const toc = await this.universe.acquireSearchAllAccountsMessagesTOC(ctx, msg.spec);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_viewConversationMessages(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "ConversationMessagesView");
      ctx.viewing = {
        type: "conversation",
        conversationId: msg.conversationId
      };
      let toc = await this.universe.acquireConversationTOC(ctx, msg.conversationId);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _cmd_searchConversationMessages(msg) {
      let ctx = this.bridgeContext.createNamedContext(msg.handle, "ConversationSearchView");
      ctx.viewing = {
        type: "conversation",
        conversationId: msg.conversationId
      };
      let toc = await this.universe.acquireSearchConversationMessagesTOC(ctx, msg.spec);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      await ctx.acquire(ctx.proxy);
    },
    async _promised_refreshView(msg, replyFunc) {
      let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
      await ctx.proxy?.toc?.refresh("refreshView");
      replyFunc(null);
    },
    _cmd_growView(msg) {
      let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
      if (ctx.viewing.type === "folder") {
        this.universe.syncGrowFolder(ctx.viewing.folderId, "growView");
      } else {
      }
    },
    _cmd_seekProxy(msg) {
      let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
      ctx.proxy.seek(msg);
    },
    async _cmd_getItemAndTrackUpdates(msg) {
      let requests = {};
      let idRequestMap = new Map();
      idRequestMap.set(msg.itemId, null);
      let rawToWireRep, eventArgsToRaw;
      let normId;
      let readKey;
      switch (msg.itemType) {
        case "conv":
          normId = msg.itemId;
          requests.conversations = idRequestMap;
          readKey = "conversations";
          rawToWireRep = (x) => x;
          eventArgsToRaw = (id, convInfo) => {
            return convInfo;
          };
          break;
        case "msg":
          normId = msg.itemId[0];
          requests.messages = idRequestMap;
          readKey = "messages";
          rawToWireRep = (x) => x;
          eventArgsToRaw = (id, messageInfo) => {
            return messageInfo;
          };
          break;
        default:
          throw new Error("unsupported item type: " + msg.itemType);
      }
      let eventId = msg.itemType + "!" + normId + "!change";
      let ctx = this.bridgeContext.createNamedContext(msg.handle, eventId);
      let fromDb = await this.db.read(ctx, requests);
      let dbWireRep = rawToWireRep(fromDb[readKey].get(normId));
      const dataOverlayManager = this.universe.dataOverlayManager;
      let boundOverlayResolver = dataOverlayManager.makeBoundResolver(readKey);
      let dataEventHandler = (arg1, arg2) => {
        let rep = eventArgsToRaw(arg1, arg2);
        if (rep) {
          rep = rawToWireRep(rep);
          ctx.sendMessage("updateItem", {
            state: rep,
            overlays: null
          });
        } else {
          ctx.sendMessage("updateItem", null);
        }
      };
      let overlayEventHandler = (modId) => {
        if (modId === normId) {
          ctx.sendMessage("updateItem", {
            state: null,
            overlays: boundOverlayResolver(normId)
          });
        }
      };
      this.db.on(eventId, dataEventHandler);
      dataOverlayManager.on(readKey, overlayEventHandler);
      ctx.runAtCleanup(() => {
        this.db.removeListener(eventId, dataEventHandler);
        dataOverlayManager.removeListener(readKey, overlayEventHandler);
      });
      ctx.sendMessage("gotItemNowTrackingUpdates", {
        state: dbWireRep,
        overlays: boundOverlayResolver(normId)
      });
    },
    _cmd_updateTrackedItemPriorityTags() {
    },
    _cmd_cleanupContext(msg) {
      this.bridgeContext.cleanupNamedContext(msg.handle);
      this.__sendMessage({
        type: "contextCleanedUp",
        handle: msg.handle
      });
    },
    _cmd_fetchSnippets(msg) {
      if (msg.convIds) {
        this.universe.fetchConversationSnippets(msg.convIds, "bridge");
      }
    },
    _cmd_downloadBodyReps(msg) {
      this.universe.fetchMessageBody(msg.id, msg.date, "bridge");
    },
    async _promised_downloadAttachments(msg, replyFunc) {
      await this.universe.downloadMessageAttachments(msg.downloadReq);
      replyFunc(null);
    },
    __accumulateUndoTasksAndReply(sourceMsg, promises, replyFunc) {
      Promise.all(promises).then((nestedUndoTasks) => {
        let undoTasks = [];
        undoTasks = undoTasks.concat.apply(undoTasks, nestedUndoTasks);
        replyFunc(undoTasks);
      });
    },
    _promised_store_labels(msg, replyFunc) {
      this.__accumulateUndoTasksAndReply(msg, msg.conversations.map((convInfo) => {
        return this.universe.storeLabels(convInfo.id, convInfo.messageIds, convInfo.messageSelector, msg.add, msg.remove);
      }), replyFunc);
    },
    _promised_store_flags(msg, replyFunc) {
      this.__accumulateUndoTasksAndReply(msg, msg.conversations.map((convInfo) => {
        return this.universe.storeFlags(convInfo.id, convInfo.messageIds, convInfo.messageSelector, msg.add, msg.remove);
      }), replyFunc);
    },
    async _promised_outboxSetPaused(msg, replyFunc) {
      await this.universe.outboxSetPaused(msg.accountId, msg.bePaused);
      replyFunc();
    },
    _cmd_undo(msg) {
      this.universe.undo(msg.undoTasks);
    },
    async _promised_createDraft(msg, replyFunc) {
      let { messageId, messageDate } = await this.universe.createDraft({
        draftType: msg.draftType,
        mode: msg.mode,
        refMessageId: msg.refMessageId,
        refMessageDate: msg.refMessageDate,
        folderId: msg.folderId
      });
      replyFunc({ messageId, messageDate });
    },
    _cmd_attachBlobToDraft(msg) {
      this.universe.attachBlobToDraft(msg.messageId, msg.attachmentDef);
    },
    _cmd_detachAttachmentFromDraft(msg) {
      this.universe.detachAttachmentFromDraft(msg.messageId, msg.attachmentRelId);
    },
    _promised_doneCompose(msg, replyFunc) {
      if (msg.command === "delete") {
        this.universe.deleteDraft(msg.messageId);
        return;
      }
      this.universe.saveDraft(msg.messageId, msg.draftFields);
      if (msg.command === "send") {
        this.universe.outboxSendDraft(msg.messageId).then((sendProblem) => {
          replyFunc(sendProblem);
        });
      }
    },
    _cmd_clearNewTrackingForAccount(msg) {
      this.universe.clearNewTrackingForAccount({
        accountId: msg.accountId,
        silent: msg.silent
      });
    },
    _cmd_flushNewAggregates() {
      this.universe.flushNewAggregates();
    },
    _cmd_debugForceCronSync(msg) {
      this.universe.cronSyncSupport.onAlarm(msg.accountIds, "fake-interval", "fake-wakelock", msg.notificationAccountIds);
    }
  };

  // src/backend/mailuniverse.js
  init_logic();

  // src/backend/maildb.js
  var import_evt3 = __toModule(require_evt());
  init_logic();
  init_id_conversions();
  var {
    indexedDB,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction,
    IDBRequest,
    IDBKeyRange
  } = globalThis;
  var CUR_VERSION = 124;
  var FRIENDLY_LAZY_DB_UPGRADE_VERSION = 124;
  var TBL_CONFIG = "config";
  var CONFIG_KEYPREFIX_ACCOUNT_DEF = "accountDef:";
  var TBL_SYNC_STATES = "syncStates";
  var TBL_TASKS = "tasks";
  var TBL_COMPLEX_TASKS = "complexTasks";
  var TBL_FOLDER_INFO = "folderInfo";
  var TBL_CONV_INFO = "convInfo";
  var TBL_CONV_IDS_BY_FOLDER = "convIdsByFolder";
  var TBL_MSG_IDS_BY_FOLDER = "msgIdsByFolder";
  var TBL_MESSAGES = "messages";
  var TBL_HEADER_ID_MAP = "headerIdMap";
  var TBL_UMID_LOCATION = "umidLocationMap";
  var TBL_UMID_NAME = "umidNameMap";
  var TBL_BOUNDED_LOGS = "logs";
  var BOUNDED_LOG_KEEP_TIME_MILLIS = 14 * 24 * 60 * 60 * 1e3;
  var TASK_MUTATION_STORES = [
    TBL_CONFIG,
    TBL_SYNC_STATES,
    TBL_TASKS,
    TBL_COMPLEX_TASKS,
    TBL_FOLDER_INFO,
    TBL_CONV_INFO,
    TBL_CONV_IDS_BY_FOLDER,
    TBL_MESSAGES,
    TBL_MSG_IDS_BY_FOLDER,
    TBL_HEADER_ID_MAP,
    TBL_UMID_LOCATION,
    TBL_UMID_NAME,
    TBL_BOUNDED_LOGS
  ];
  function analyzeAndLogErrorEvent(event) {
    function explainSource(source) {
      if (!source) {
        return "unknown source";
      }
      if (source instanceof IDBObjectStore) {
        return 'object store "' + source.name + '"';
      }
      if (source instanceof IDBIndex) {
        return 'index "' + source.name + '" on object store "' + source.objectStore.name + '"';
      }
      if (source instanceof IDBCursor) {
        return "cursor on " + explainSource(source.source);
      }
      return "unexpected source";
    }
    var explainedSource, target = event.target;
    if (target instanceof IDBTransaction) {
      explainedSource = "transaction (" + target.mode + ")";
    } else if (target instanceof IDBRequest) {
      explainedSource = "request as part of " + (target.transaction ? target.transaction.mode : "NO") + " transaction on " + explainSource(target.source);
    } else {
      explainedSource = target.toString();
    }
    var str = "indexedDB error:" + target.error.name + " from " + explainedSource;
    console.error(str);
    return str;
  }
  function analyzeAndRejectErrorEvent(rejectFunc, event) {
    rejectFunc(analyzeAndLogErrorEvent(event));
  }
  function computeSetDelta(before, after) {
    const added = new Set();
    const kept = new Set();
    const removed = new Set();
    for (const key of before) {
      if (after.has(key)) {
        kept.add(key);
      } else {
        removed.add(key);
      }
    }
    for (const key of after) {
      if (!before.has(key)) {
        added.add(key);
      }
    }
    return { added, kept, removed };
  }
  var applyDeltasToObj = function(deltas, obj) {
    for (var key of Object.keys(deltas)) {
      obj[key] += deltas[key];
    }
  };
  var applyClobbersToObj = function(clobbers, obj) {
    if (clobbers instanceof Map) {
      for (const [keyPath, value] of clobbers) {
        let effObj = obj;
        for (const keyPart of keyPath.slice(0, -1)) {
          effObj = effObj[keyPart];
        }
        effObj[keyPath.slice(-1)[0]] = value;
      }
    } else {
      for (const key of Object.keys(clobbers)) {
        obj[key] = clobbers[key];
      }
    }
  };
  function valueIterator(arrayOrMap) {
    if (Array.isArray(arrayOrMap)) {
      return arrayOrMap;
    }
    return arrayOrMap.values();
  }
  var convEventForFolderId = (folderId) => "fldr!" + folderId + "!convs!tocChange";
  var messageEventForFolderId = (folderId) => "fldr!" + folderId + "!messages!tocChange";
  function wrapReq(idbRequest) {
    return new Promise(function(resolve, reject) {
      idbRequest.onsuccess = function(event) {
        resolve(event.target.result);
      };
      idbRequest.onerror = function(event) {
        reject(analyzeAndLogErrorEvent(event));
      };
    });
  }
  function wrapTrans(idbTransaction) {
    return new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function(event) {
        reject(analyzeAndLogErrorEvent(event));
      };
    });
  }
  function genericUncachedLookups(store, requestMap) {
    let dbReqCount = 0;
    for (const unlatchedKey of requestMap.keys()) {
      const key = unlatchedKey;
      dbReqCount++;
      const req = store.get(key);
      const handler = (event) => {
        let value;
        if (req.error) {
          value = null;
          analyzeAndLogErrorEvent(event);
        } else {
          value = req.result;
        }
        requestMap.set(key, value);
      };
      req.onsuccess = handler;
      req.onerror = handler;
    }
    return dbReqCount;
  }
  function genericUncachedWrites(trans, tableName, writeMap) {
    if (writeMap) {
      const store = trans.objectStore(tableName);
      for (const [key, value] of writeMap) {
        if (value !== null) {
          store.put(value, key);
        } else {
          store.delete(key);
        }
      }
    }
  }
  function genericCachedLookups(store, requestMap, cache) {
    let dbReqCount = 0;
    for (const unlatchedKey of requestMap.keys()) {
      const key = unlatchedKey;
      if (cache.has(key)) {
        requestMap.set(key, cache.get(key));
        continue;
      }
      dbReqCount++;
      const req = store.get(key);
      const handler = (event) => {
        if (req.error) {
          analyzeAndLogErrorEvent(event);
        } else {
          const value = req.result;
          if (!cache.has(key)) {
            cache.set(key, value);
          }
          requestMap.set(key, value);
        }
      };
      req.onsuccess = handler;
      req.onerror = handler;
    }
    return dbReqCount;
  }
  var MailDB = class extends import_evt3.Emitter {
    constructor({ universe: universe2, testOptions }) {
      super();
      logic.defineScope(this, "MailDB");
      this.universe = universe2;
      this._db = null;
      this.triggerManager = null;
      this.accountManager = null;
      this._lazyConfigCarryover = null;
      this.convCache = new Map();
      this.messageCache = new Map();
      let dbVersion = CUR_VERSION;
      if (testOptions && testOptions.dbDelta) {
        dbVersion += testOptions.dbDelta;
      }
      if (testOptions && testOptions.dbVersion) {
        dbVersion = testOptions.dbVersion;
      }
      this._dbPromise = new Promise((resolve, reject) => {
        const openRequest = indexedDB.open("companion-workshop", dbVersion);
        openRequest.onsuccess = () => {
          this._db = openRequest.result;
          resolve();
        };
        openRequest.onupgradeneeded = (event) => {
          logic(this, "upgradeNeeded", {
            oldVersion: event.oldVersion,
            curVersion: dbVersion
          });
          const db = openRequest.result;
          if (event.oldVersion < FRIENDLY_LAZY_DB_UPGRADE_VERSION || testOptions && testOptions.nukeDb) {
            this._nukeDB(db);
          } else {
            const trans = openRequest.transaction;
            const objectStores = Array.from(db.objectStoreNames);
            if (objectStores.includes(TBL_CONFIG)) {
              this._getConfig(trans).then((carryover) => {
                if (carryover) {
                  carryover.oldVersion = event.oldVersion;
                  this._lazyConfigCarryover = carryover;
                }
              });
              this._nukeDB(db);
            } else {
              logic(this, "failsafeNuke", { objectStores });
              this._nukeDB(db);
            }
          }
        };
        openRequest.onerror = analyzeAndRejectErrorEvent.bind(null, reject);
      });
    }
    emit(eventName) {
      const listenerCount = this._events[eventName]?.length || 0;
      logic(this, "emit", { name: eventName, listenerCount });
      super.emit.apply(this, arguments);
    }
    on(eventName) {
      if (!eventName) {
        throw new Error("no event type provided!");
      }
      logic(this, "on", { name: eventName });
      super.on.apply(this, arguments);
    }
    removeListener(eventName) {
      if (!eventName) {
        throw new Error("no event type provided!");
      }
      logic(this, "removeListener", { name: eventName });
      super.removeListener.apply(this, arguments);
    }
    _nukeDB(db) {
      logic(this, "nukeDB", {});
      const existingNames = db.objectStoreNames;
      for (const existingName of existingNames) {
        db.deleteObjectStore(existingName);
      }
      db.createObjectStore(TBL_CONFIG);
      db.createObjectStore(TBL_SYNC_STATES);
      db.createObjectStore(TBL_TASKS);
      db.createObjectStore(TBL_COMPLEX_TASKS);
      db.createObjectStore(TBL_FOLDER_INFO);
      db.createObjectStore(TBL_CONV_INFO);
      db.createObjectStore(TBL_CONV_IDS_BY_FOLDER);
      db.createObjectStore(TBL_MESSAGES);
      db.createObjectStore(TBL_MSG_IDS_BY_FOLDER);
      db.createObjectStore(TBL_HEADER_ID_MAP);
      db.createObjectStore(TBL_UMID_NAME);
      db.createObjectStore(TBL_UMID_LOCATION);
      db.createObjectStore(TBL_BOUNDED_LOGS);
    }
    close() {
      if (this._db) {
        this._db.close();
        this._db = null;
      }
    }
    async getConfig() {
      await this._dbPromise;
      if (this._lazyConfigCarryover) {
        const carryover = this._lazyConfigCarryover;
        this._lazyConfigCarryover = null;
        return { config: null, accountDefs: null, carryover };
      }
      return this._getConfig();
    }
    async _getConfig(trans) {
      logic(this, "_getConfig", { trans: !!trans });
      const transaction = trans || this._db.transaction([TBL_CONFIG], "readonly");
      const configStore = transaction.objectStore(TBL_CONFIG);
      const configRows = await wrapReq(configStore.getAll());
      let config = null;
      const accountDefs = [];
      for (const obj of configRows) {
        if (obj.id === "config") {
          config = obj;
        } else {
          accountDefs.push(obj);
        }
      }
      return { config, accountDefs };
    }
    saveConfig(config) {
      return wrapTrans(this._db.transaction(TBL_CONFIG, "readwrite").objectStore(TBL_CONFIG).put(config, "config"));
    }
    saveAccountDef(config, accountDef, folderInfo, callback) {
      var trans = this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO], "readwrite");
      var configStore = trans.objectStore(TBL_CONFIG);
      configStore.put(config, "config");
      configStore.put(accountDef, CONFIG_KEYPREFIX_ACCOUNT_DEF + accountDef.id);
      if (folderInfo) {
        trans.objectStore(TBL_FOLDER_INFO).put(folderInfo, accountDef.id);
      }
      trans.onerror = analyzeAndLogErrorEvent;
      if (callback) {
        trans.oncomplete = function() {
          callback();
        };
      }
    }
    addBoundedLogs(entries) {
      const trans = this._db.transaction(TBL_BOUNDED_LOGS, "readwrite");
      const store = trans.objectStore(TBL_BOUNDED_LOGS);
      for (const entry of entries) {
        store.add(entry.entry, [entry.timestamp, entry.type, entry.id]);
      }
      return wrapTrans(trans);
    }
    updateBoundedLogs(entries) {
      const trans = this._db.transaction(TBL_BOUNDED_LOGS, "readwrite");
      const store = trans.objectStore(TBL_BOUNDED_LOGS);
      for (const entry of entries) {
        store.put(entry.entry, [entry.timestamp, entry.type, entry.id]);
      }
      return wrapTrans(trans);
    }
    reapOldBoundedLogs() {
      const trans = this._db.transaction(TBL_BOUNDED_LOGS, "readwrite");
      const store = trans.objectStore(TBL_BOUNDED_LOGS);
      const deleteRange = IDBKeyRange.bound([0], [Date.now() - BOUNDED_LOG_KEEP_TIME_MILLIS, []], true, true);
      store.delete(deleteRange);
      return wrapTrans(trans);
    }
    _considerCachePressure() {
      if (this._emptyingCache) {
        return;
      }
      this._emptyingCache = globalThis.setTimeout(() => {
        this._emptyingCache = null;
        this.emptyCache();
      }, 100);
    }
    emptyCache() {
      this.emit("cacheDrop");
      this.convCache.clear();
      this.messageCache.clear();
    }
    _bufferChangeEventsIdiom(eventId) {
      const bufferedEvents = [];
      const bufferFunc = (change) => {
        bufferedEvents.push(change);
      };
      const drainEvents = (changeHandler) => {
        this.removeListener(eventId, bufferFunc);
        for (const change of bufferedEvents) {
          changeHandler(change);
        }
      };
      this.on(eventId, bufferFunc);
      return {
        drainEvents,
        eventId
      };
    }
    read(ctx, requests) {
      return new Promise((resolve) => {
        logic(this, "read:begin", { ctxId: ctx.id });
        const trans = this._db.transaction(TASK_MUTATION_STORES, "readonly");
        let dbReqCount = 0;
        if (requests.config) {
          requests.config = this.universe.config;
        }
        if (requests.accounts) {
          const accountReqs = requests.accounts;
          for (const accountId of accountReqs.keys()) {
            accountReqs.set(accountId, this.accountManager.getAccountDefById(accountId));
          }
        }
        if (requests.folders) {
          const folderReqs = requests.folders;
          for (const folderId of folderReqs.keys()) {
            folderReqs.set(folderId, this.accountManager.getFolderById(folderId));
          }
        }
        if (requests.syncStates) {
          dbReqCount += genericUncachedLookups(trans.objectStore(TBL_SYNC_STATES), requests.syncStates);
        }
        if (requests.headerIdMaps) {
          dbReqCount += genericUncachedLookups(trans.objectStore(TBL_HEADER_ID_MAP), requests.headerIdMaps);
        }
        if (requests.umidNames) {
          dbReqCount += genericUncachedLookups(trans.objectStore(TBL_UMID_NAME), requests.umidNames);
        }
        if (requests.umidLocations) {
          dbReqCount += genericUncachedLookups(trans.objectStore(TBL_UMID_LOCATION), requests.umidLocations);
        }
        if (requests.complexTaskStates) {
          dbReqCount += genericUncachedLookups(trans.objectStore(TBL_COMPLEX_TASKS), requests.complexTaskStates);
        }
        if (requests.conversations) {
          dbReqCount += genericCachedLookups(trans.objectStore(TBL_CONV_INFO), requests.conversations, this.convCache);
        }
        if (requests.messagesByConversation) {
          const messageStore = trans.objectStore(TBL_MESSAGES);
          const messageCache = this.messageCache;
          const requestsMap = requests.messagesByConversation;
          for (const unlatchedConvId of requestsMap.keys()) {
            const convId = unlatchedConvId;
            const messageRange = IDBKeyRange.bound([convId], [convId, []], true, true);
            dbReqCount++;
            const req = messageStore.getAll(messageRange);
            const handler = (event) => {
              if (req.error) {
                analyzeAndLogErrorEvent(event);
              } else {
                const messages = req.result;
                for (const message of messages) {
                  if (!messageCache.has(message.id)) {
                    messageCache.set(message.id, message);
                  }
                }
                requestsMap.set(convId, messages);
              }
            };
            req.onsuccess = handler;
            req.onerror = handler;
          }
        }
        if (requests.messages) {
          const messageStore = trans.objectStore(TBL_MESSAGES);
          const messageCache = this.messageCache;
          const messageRequestsMap = requests.messages;
          const messageResultsMap = requests.messages = new Map();
          const flushedRead = requests.flushedMessageReads || false;
          for (const [unlatchedMessageId, date] of messageRequestsMap.keys()) {
            const messageId = unlatchedMessageId;
            if (!flushedRead && messageCache.has(messageId)) {
              messageResultsMap.set(messageId, messageCache.get(messageId));
              continue;
            }
            const key = [
              convIdFromMessageId(messageId),
              date,
              messageIdComponentFromMessageId(messageId)
            ];
            dbReqCount++;
            const req = messageStore.get(key);
            const handler = (event) => {
              if (req.error) {
                analyzeAndLogErrorEvent(event);
              } else {
                const message = req.result;
                if (flushedRead || !messageCache.has(messageId)) {
                  messageCache.set(messageId, message);
                }
                messageResultsMap.set(messageId, message);
              }
            };
            req.onsuccess = handler;
            req.onerror = handler;
          }
        }
        if (!dbReqCount) {
          resolve(requests);
        } else {
          trans.oncomplete = () => {
            logic(this, "read:end", {
              ctxId: ctx.id,
              dbReqCount,
              _requests: requests
            });
            resolve(requests);
            this._considerCachePressure("read", ctx);
          };
        }
      });
    }
    beginMutate(ctx, mutateRequests, options) {
      return this.read(ctx, mutateRequests, options).then(() => {
        const preMutateStates = ctx._preMutateStates = ctx._preMutateStates || {};
        if (mutateRequests.conversations) {
          const preConv = preMutateStates.conversations = new Map();
          for (const conv of mutateRequests.conversations.values()) {
            if (!conv) {
              continue;
            }
            preConv.set(conv.id, {
              date: conv.date,
              folderIds: new Set(conv.folderIds),
              hasUnread: conv.hasUnread,
              height: conv.height
            });
          }
        }
        if (mutateRequests.messagesByConversation || mutateRequests.messages) {
          const preMessages = preMutateStates.messages = new Map();
          if (mutateRequests.messagesByConversation) {
            for (const convMessages of mutateRequests.messagesByConversation.values()) {
              for (const message of convMessages) {
                preMessages.set(message.id, {
                  date: message.date,
                  folderIds: new Set(message.folderIds)
                });
              }
            }
          }
          if (mutateRequests.messages) {
            for (const message of mutateRequests.messages.values()) {
              preMessages.set(message.id, {
                date: message.date,
                folderIds: new Set(message.folderIds)
              });
            }
          }
        }
        return mutateRequests;
      });
    }
    async loadTasks() {
      const trans = this._db.transaction([TBL_TASKS, TBL_COMPLEX_TASKS], "readonly");
      const taskStore = trans.objectStore(TBL_TASKS);
      const complexTaskStore = trans.objectStore([TBL_COMPLEX_TASKS]);
      const [
        wrappedTasks,
        complexTaskStateKeys,
        complexTaskStateValues
      ] = await Promise.all([
        wrapReq(taskStore.getAll()),
        wrapReq(complexTaskStore.getAllKeys()),
        wrapReq(complexTaskStore.getAll())
      ]);
      return {
        wrappedTasks,
        complexTaskStates: [complexTaskStateKeys, complexTaskStateValues]
      };
    }
    loadFoldersByAccount(accountId) {
      const trans = this._db.transaction(TBL_FOLDER_INFO, "readonly");
      const store = trans.objectStore(TBL_FOLDER_INFO);
      const accountIdBounds = getAccountIdBounds(accountId);
      const accountStringPrefix = IDBKeyRange.bound(accountIdBounds.lower, accountIdBounds.upper, true, true);
      return wrapReq(store.getAll(accountStringPrefix));
    }
    async loadFolderConversationIdsAndListen(folderId) {
      const eventId = "fldr!" + folderId + "!convs!tocChange";
      const retval = this._bufferChangeEventsIdiom(eventId);
      const trans = this._db.transaction(TBL_CONV_IDS_BY_FOLDER, "readonly");
      const convIdsStore = trans.objectStore(TBL_CONV_IDS_BY_FOLDER);
      const folderRange = IDBKeyRange.bound([folderId], [folderId, []], true, true);
      const tuples = await wrapReq(convIdsStore.getAll(folderRange));
      logic(this, "loadFolderConversationIdsAndListen", {
        convCount: tuples.length,
        eventId: retval.eventId
      });
      tuples.reverse();
      retval.idsWithDates = tuples.map(function(x) {
        return { date: x[1], id: x[2], height: x[3] };
      });
      return retval;
    }
    _processConvAdditions(trans, convs) {
      const convStore = trans.objectStore(TBL_CONV_INFO);
      const convIdsStore = trans.objectStore(TBL_CONV_IDS_BY_FOLDER);
      for (const convInfo of valueIterator(convs)) {
        convStore.add(convInfo, convInfo.id);
        this.convCache.set(convInfo.id, convInfo);
        const eventDeltaInfo = {
          id: convInfo.id,
          item: convInfo,
          removeDate: null,
          addDate: convInfo.date,
          height: convInfo.height,
          oldHeight: 0
        };
        for (const folderId of convInfo.folderIds) {
          this.emit("conv!*!add", convInfo);
          this.emit(convEventForFolderId(folderId), eventDeltaInfo);
          convIdsStore.add([folderId, convInfo.date, convInfo.id, convInfo.height], [folderId, convInfo.date, convInfo.id]);
        }
      }
    }
    _processConvMutations(trans, preStates, convs) {
      const convStore = trans.objectStore(TBL_CONV_INFO);
      const convIdsStore = trans.objectStore(TBL_CONV_IDS_BY_FOLDER);
      for (const [convId, convInfo] of convs) {
        const preInfo = preStates.get(convId);
        let convFolderIds;
        if (convInfo === null) {
          convStore.delete(convId);
          this.convCache.delete(convId);
          convFolderIds = new Set();
          const messageRange = IDBKeyRange.bound([convId], [convId, []], true, true);
          trans.objectStore(TBL_MESSAGES).delete(messageRange);
        } else {
          convFolderIds = convInfo.folderIds;
          convStore.put(convInfo, convId);
          this.convCache.set(convId, convInfo);
        }
        this.emit("conv!" + convId + "!change", convId, convInfo);
        const { added, kept, removed } = computeSetDelta(preInfo.folderIds, convFolderIds);
        this.emit("conv!*!change", convId, preInfo, convInfo, added, kept, removed);
        for (const folderId of added) {
          this.emit(convEventForFolderId(folderId), {
            id: convId,
            item: convInfo,
            removeDate: null,
            addDate: convInfo.date,
            height: convInfo.height,
            oldHeight: 0
          });
        }
        for (const folderId of kept) {
          this.emit(convEventForFolderId(folderId), {
            id: convId,
            item: convInfo,
            removeDate: preInfo.date,
            addDate: convInfo.date,
            height: convInfo.height,
            oldHeight: preInfo.height
          });
        }
        for (const folderId of removed) {
          this.emit(convEventForFolderId(folderId), {
            id: convId,
            item: convInfo,
            removeDate: preInfo.date,
            addDate: null,
            height: 0,
            oldHeight: preInfo.height
          });
        }
        if (!convInfo || preInfo.date !== convInfo.date || preInfo.height !== convInfo.height) {
          for (const folderId of preInfo.folderIds) {
            convIdsStore.delete([folderId, preInfo.date, convId]);
          }
          if (convInfo) {
            for (const folderId of convFolderIds) {
              convIdsStore.add([folderId, convInfo.date, convId, convInfo.height], [folderId, convInfo.date, convId]);
            }
          }
        } else {
          for (const folderId of removed) {
            convIdsStore.delete([folderId, convInfo.date, convId]);
          }
          for (const folderId of added) {
            convIdsStore.add([folderId, convInfo.date, convId, convInfo.height], [folderId, convInfo.date, convId]);
          }
        }
      }
    }
    async loadFolderMessageIdsAndListen(folderId) {
      const eventId = "fldr!" + folderId + "!messages!tocChange";
      const retval = this._bufferChangeEventsIdiom(eventId);
      const trans = this._db.transaction(TBL_MSG_IDS_BY_FOLDER, "readonly");
      const msgIdsStore = trans.objectStore(TBL_MSG_IDS_BY_FOLDER);
      const folderRange = IDBKeyRange.bound([folderId], [folderId, []], true, true);
      const tuples = await wrapReq(msgIdsStore.getAll(folderRange));
      logic(this, "loadFolderMessageIdsAndListen", {
        msgCount: tuples.length,
        eventId: retval.eventId
      });
      tuples.reverse();
      retval.idsWithDates = tuples.map(function(x) {
        return { date: x[1], id: x[2] };
      });
      return retval;
    }
    async loadConversationMessageIdsAndListen(convId) {
      const tocEventId = "conv!" + convId + "!messages!tocChange";
      const convEventId = "conv!" + convId + "!change";
      const { drainEvents } = this._bufferChangeEventsIdiom(tocEventId);
      const trans = this._db.transaction(TBL_MESSAGES, "readonly");
      const messageStore = trans.objectStore(TBL_MESSAGES);
      const messageRange = IDBKeyRange.bound([convId], [convId, []], true, true);
      const messages = await wrapReq(messageStore.getAll(messageRange));
      const messageCache = this.messageCache;
      const idsWithDates = messages.map(function(message) {
        if (!messageCache.has(message.id)) {
          messageCache.set(message.id, message);
        }
        return { date: message.date, id: message.id };
      });
      return { tocEventId, convEventId, idsWithDates, drainEvents };
    }
    _processMessageAdditions(trans, messages) {
      const store = trans.objectStore(TBL_MESSAGES);
      const idsStore = trans.objectStore(TBL_MSG_IDS_BY_FOLDER);
      const messageCache = this.messageCache;
      for (const message of valueIterator(messages)) {
        const convId = convIdFromMessageId(message.id);
        const key = [
          convId,
          message.date,
          messageIdComponentFromMessageId(message.id)
        ];
        store.add(message, key);
        messageCache.set(message.id, message);
        this.emit("msg!*!add", message);
        const convTocEventId = "conv!" + convId + "!messages!tocChange";
        const eventDeltaInfo = {
          id: message.id,
          preDate: null,
          postDate: message.date,
          item: message,
          freshlyAdded: true,
          matchInfo: null
        };
        this.emit(convTocEventId, eventDeltaInfo);
        for (const folderId of message.folderIds) {
          this.emit(messageEventForFolderId(folderId), eventDeltaInfo);
          idsStore.add([folderId, message.date, message.id], [folderId, message.date, message.id]);
        }
      }
    }
    _processMessageMutations(trans, preStates, messages) {
      const store = trans.objectStore(TBL_MESSAGES);
      const idsStore = trans.objectStore(TBL_MSG_IDS_BY_FOLDER);
      const messageCache = this.messageCache;
      for (const [messageId, message] of messages) {
        const convId = convIdFromMessageId(messageId);
        const preInfo = preStates.get(messageId);
        const preDate = preInfo.date;
        const postDate = message && message.date;
        const preKey = [
          convId,
          preDate,
          messageIdComponentFromMessageId(messageId)
        ];
        if (message === null) {
          store.delete(preKey);
          messageCache.delete(messageId);
        } else if (preDate !== postDate) {
          store.delete(preKey);
          const postKey = [
            convId,
            postDate,
            messageIdComponentFromMessageId(messageId)
          ];
          store.put(message, postKey);
        } else {
          store.put(message, preKey);
          messageCache.set(messageId, message);
        }
        const { added, kept, removed } = computeSetDelta(preInfo.folderIds, message ? message.folderIds : new Set());
        const convEventId = "conv!" + convId + "!messages!tocChange";
        this.emit(convEventId, {
          id: messageId,
          preDate,
          postDate,
          item: message,
          freshlyAdded: false,
          matchInfo: null
        });
        const messageEventId = "msg!" + messageId + "!change";
        this.emit(messageEventId, messageId, message);
        for (const folderId of added) {
          this.emit(messageEventForFolderId(folderId), {
            id: messageId,
            preDate,
            postDate,
            item: message,
            freshlyAdded: true,
            matchInfo: null
          });
        }
        for (const folderId of kept) {
          this.emit(messageEventForFolderId(folderId), {
            id: messageId,
            preDate,
            postDate,
            item: message,
            freshlyAdded: false,
            matchInfo: null
          });
        }
        for (const folderId of removed) {
          this.emit(messageEventForFolderId(folderId), {
            id: messageId,
            preDate,
            postDate,
            item: message,
            freshlyAdded: false,
            matchInfo: null
          });
        }
        this.emit("msg!*!change", messageId, preInfo, message, added, kept, removed);
        if (!message) {
          this.emit("msg!" + messageId + "!remove", messageId);
          this.emit("msg!*!remove", messageId);
        }
        if (!message || preDate !== postDate) {
          for (const folderId of preInfo.folderIds) {
            idsStore.delete([folderId, preInfo.date, messageId]);
          }
          if (message) {
            for (const folderId of message.folderIds) {
              idsStore.add([folderId, message.date, message.id], [folderId, message.date, message.id]);
            }
          }
        } else {
          for (const folderId of removed) {
            idsStore.delete([folderId, message.date, messageId]);
          }
          for (const folderId of added) {
            idsStore.add([folderId, message.date, message.id], [folderId, message.date, message.id]);
          }
        }
      }
    }
    _applyAtomics(atomics, rootMutations) {
      const { atomicDeltas, atomicClobbers } = atomics;
      const accountManager = this.accountManager;
      if (atomicDeltas) {
        if (atomicDeltas.config) {
          if (!rootMutations.config) {
            rootMutations.config = this.universe.config;
          }
          applyDeltasToObj(atomicDeltas.config, rootMutations.config);
        }
        if (atomicDeltas.accounts) {
          if (!rootMutations.accounts) {
            rootMutations.accounts = new Map();
          }
          const accountMutations = rootMutations.accounts;
          for (const [accountId, deltas] of atomicDeltas.accounts) {
            const accountDef = accountManager.getAccountDefById(accountId);
            applyDeltasToObj(deltas, accountDef);
            accountMutations.set(accountId, accountDef);
          }
        }
        if (atomicDeltas.folders) {
          if (!rootMutations.folders) {
            rootMutations.folders = new Map();
          }
          const folderMutations = rootMutations.folders;
          for (const [folderId, deltas] of atomicDeltas.folders) {
            const folder = accountManager.getFolderById(folderId);
            applyDeltasToObj(deltas, folder);
            folderMutations.set(folderId, folder);
          }
        }
      }
      if (atomicClobbers) {
        if (atomicClobbers.config) {
          if (!rootMutations.config) {
            rootMutations.config = this.universe.config;
          }
          applyClobbersToObj(atomicClobbers.config, rootMutations.config);
        }
        if (atomicClobbers.accounts) {
          if (!rootMutations.accounts) {
            rootMutations.accounts = new Map();
          }
          const accountMutations = rootMutations.accounts;
          for (const [accountId, clobbers] of atomicClobbers.accounts) {
            const accountDef = accountManager.getAccountDefById(accountId);
            applyClobbersToObj(clobbers, accountDef);
            accountMutations.set(accountId, accountDef);
          }
        }
        if (atomicClobbers.folders) {
          if (!rootMutations.folders) {
            rootMutations.folders = new Map();
          }
          const folderMutations = rootMutations.folders;
          for (const [folderId, clobbers] of atomicClobbers.folders) {
            const folder = accountManager.getFolderById(folderId);
            applyClobbersToObj(clobbers, folder);
            folderMutations.set(folderId, folder);
          }
        }
      }
    }
    _processAccountDeletion(trans, accountId) {
      const accountIdBounds = getAccountIdBounds(accountId);
      const accountStringPrefix = IDBKeyRange.bound(accountIdBounds.lower, accountIdBounds.upper, true, true);
      const accountArrayItemPrefix = IDBKeyRange.bound([accountIdBounds.lower], [accountIdBounds.upper], true, true);
      const accountFirstElementArray = IDBKeyRange.bound([accountId], [accountId, []], true, true);
      trans.objectStore(TBL_CONFIG).delete(CONFIG_KEYPREFIX_ACCOUNT_DEF + accountId);
      trans.objectStore(TBL_SYNC_STATES).delete(accountId);
      trans.objectStore(TBL_SYNC_STATES).delete(accountStringPrefix);
      trans.objectStore(TBL_COMPLEX_TASKS).delete(accountFirstElementArray);
      trans.objectStore(TBL_FOLDER_INFO).delete(accountStringPrefix);
      trans.objectStore(TBL_CONV_INFO).delete(accountStringPrefix);
      trans.objectStore(TBL_CONV_IDS_BY_FOLDER).delete(accountArrayItemPrefix);
      trans.objectStore(TBL_MESSAGES).delete(accountArrayItemPrefix);
      trans.objectStore(TBL_MSG_IDS_BY_FOLDER).delete(accountArrayItemPrefix);
      trans.objectStore(TBL_HEADER_ID_MAP).delete(accountFirstElementArray);
      trans.objectStore(TBL_UMID_LOCATION).delete(accountStringPrefix);
      trans.objectStore(TBL_UMID_NAME).delete(accountStringPrefix);
    }
    _addRawTasks(trans, wrappedTasks) {
      const store = trans.objectStore(TBL_TASKS);
      wrappedTasks.forEach((wrappedTask) => {
        store.add(wrappedTask, wrappedTask.id);
      });
    }
    addTasks(wrappedTasks) {
      const trans = this._db.transaction([TBL_TASKS], "readwrite");
      this._addRawTasks(trans, wrappedTasks);
      return wrapTrans(trans);
    }
    dangerousIncrementalWrite(ctx, mutations) {
      logic(this, "dangerousIncrementalWrite:begin", { ctxId: ctx.id });
      const trans = this._db.transaction(TASK_MUTATION_STORES, "readwrite");
      if (mutations.messages) {
        this._processMessageMutations(trans, ctx._preMutateStates.messages, mutations.messages);
      }
      return wrapTrans(trans).then(() => {
        logic(this, "dangerousIncrementalWrite:end", { ctxId: ctx.id });
      });
    }
    finishMutate(ctx, data, taskData) {
      logic(this, "finishMutate:begin", { ctxId: ctx.id, _data: data });
      const trans = this._db.transaction(TASK_MUTATION_STORES, "readwrite");
      const derivedMutations = [];
      this.triggerManager.__setState(ctx, derivedMutations);
      const newData = data.newData;
      if (newData) {
        if (newData.accounts) {
          for (const accountDef of newData.accounts) {
            trans.objectStore(TBL_CONFIG).put(accountDef, CONFIG_KEYPREFIX_ACCOUNT_DEF + accountDef.id);
            this.emit("accounts!tocChange", accountDef.id, accountDef, true);
          }
        }
        if (newData.folders) {
          const store = trans.objectStore(TBL_FOLDER_INFO);
          for (const folderInfo of newData.folders) {
            const accountId = accountIdFromFolderId(folderInfo.id);
            store.put(folderInfo, folderInfo.id);
            this.emit(`acct!${accountId}!folders!tocChange`, folderInfo.id, folderInfo, true);
          }
        }
        if (newData.conversations) {
          this._processConvAdditions(trans, newData.conversations);
        }
        if (newData.messages) {
          this._processMessageAdditions(trans, newData.messages);
        }
      }
      let mutations = data.mutations;
      if (mutations) {
        genericUncachedWrites(trans, TBL_SYNC_STATES, mutations.syncStates);
        genericUncachedWrites(trans, TBL_HEADER_ID_MAP, mutations.headerIdMaps);
        genericUncachedWrites(trans, TBL_UMID_NAME, mutations.umidNames);
        genericUncachedWrites(trans, TBL_UMID_LOCATION, mutations.umidLocations);
        if (mutations.conversations) {
          this._processConvMutations(trans, ctx._preMutateStates.conversations, mutations.conversations);
        }
        if (mutations.messages) {
          this._processMessageMutations(trans, ctx._preMutateStates.messages, mutations.messages);
        }
      } else {
        mutations = {};
      }
      this.triggerManager.__clearState();
      this._applyAtomics(data, mutations);
      if (derivedMutations.length) {
        for (const derivedMut of derivedMutations) {
          this._applyAtomics(derivedMut, mutations);
          if (derivedMut.complexTaskStates) {
            if (!mutations.complexTaskStates) {
              mutations.complexTaskStates = new Map();
            }
            for (const [key, value] of derivedMut.complexTaskStates) {
              mutations.complexTaskStates.set(key, value);
            }
          }
          if (derivedMut.rootGroupDeferredTask) {
            ctx.ensureRootTaskGroupFollowOnTask(derivedMut.rootGroupDeferredTask);
          }
        }
      }
      if (mutations.complexTaskStates) {
        for (const [key, complexTaskState] of mutations.complexTaskStates) {
          trans.objectStore(TBL_COMPLEX_TASKS).put(complexTaskState, key);
        }
      }
      if (mutations.folders) {
        const store = trans.objectStore(TBL_FOLDER_INFO);
        for (const [folderId, folderInfo] of mutations.folders) {
          const accountId = accountIdFromFolderId(folderId);
          if (folderInfo !== null) {
            store.put(folderInfo, folderId);
          } else {
            store.delete(folderId);
          }
          this.emit(`fldr!${folderId}!change`, folderId, folderInfo);
          this.emit(`acct!${accountId}!folders!tocChange`, folderId, folderInfo, false);
        }
      }
      if (mutations.accounts) {
        for (const [accountId, accountDef] of mutations.accounts) {
          if (accountDef) {
            trans.objectStore(TBL_CONFIG).put(accountDef, CONFIG_KEYPREFIX_ACCOUNT_DEF + accountId);
          } else {
            this._processAccountDeletion(trans, accountId);
          }
          this.emit(`acct!${accountId}!change`, accountId, accountDef);
          this.emit("accounts!tocChange", accountId, accountDef, false);
        }
      }
      if (mutations.config) {
        trans.objectStore(TBL_CONFIG).put(mutations.config, "config");
        this.emit("config", mutations.config);
      }
      if (taskData.revisedTaskInfo) {
        const revisedTaskInfo = taskData.revisedTaskInfo;
        if (revisedTaskInfo.state) {
          trans.objectStore(TBL_TASKS).put(revisedTaskInfo.state, revisedTaskInfo.id);
        } else {
          trans.objectStore(TBL_TASKS).delete(revisedTaskInfo.id);
        }
      }
      if (taskData.wrappedTasks) {
        const taskStore = trans.objectStore(TBL_TASKS);
        for (const wrappedTask of taskData.wrappedTasks) {
          taskStore.put(wrappedTask, wrappedTask.id);
        }
      }
      return wrapTrans(trans).then(() => {
        logic(this, "finishMutate:end", { ctxId: ctx.id });
        this._considerCachePressure("mutate", ctx);
      });
    }
  };

  // src/backend/universe/account_manager.js
  init_logic();
  init_id_conversions();

  // src/backend/engine_glue.js
  var configuratorModules = new Map([
    [
      "feed",
      async function() {
        const mod = await Promise.resolve().then(() => (init_configurator(), configurator_exports));
        return mod.default;
      }
    ],
    [
      "gapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_configurator2(), configurator_exports2));
        return mod.default;
      }
    ],
    [
      "mapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_configurator3(), configurator_exports3));
        return mod.default;
      }
    ],
    [
      "ical",
      async function() {
        const mod = await Promise.resolve().then(() => (init_configurator4(), configurator_exports4));
        return mod.default;
      }
    ]
  ]);
  var validatorModules = new Map([
    [
      "feed",
      async function() {
        const mod = await Promise.resolve().then(() => (init_validator(), validator_exports));
        return mod.default;
      }
    ],
    [
      "gapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_validator2(), validator_exports2));
        return mod.default;
      }
    ],
    [
      "mapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_validator3(), validator_exports3));
        return mod.default;
      }
    ],
    [
      "ical",
      async function() {
        const mod = await Promise.resolve().then(() => (init_validator4(), validator_exports4));
        return mod.default;
      }
    ]
  ]);
  var accountModules = new Map([
    [
      "feed",
      async function() {
        const mod = await Promise.resolve().then(() => (init_account(), account_exports));
        return mod.default;
      }
    ],
    [
      "gapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_account2(), account_exports2));
        return mod.default;
      }
    ],
    [
      "mapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_account3(), account_exports3));
        return mod.default;
      }
    ],
    [
      "ical",
      async function() {
        const mod = await Promise.resolve().then(() => (init_account4(), account_exports4));
        return mod.default;
      }
    ]
  ]);
  var engineTaskMappings = new Map([
    [
      "feed",
      async function() {
        const mod = await Promise.resolve().then(() => (init_feed_tasks(), feed_tasks_exports));
        return mod.default;
      }
    ],
    [
      "gapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_gapi_tasks(), gapi_tasks_exports));
        return mod.default;
      }
    ],
    [
      "mapi",
      async function() {
        const mod = await Promise.resolve().then(() => (init_mapi_tasks(), mapi_tasks_exports));
        return mod.default;
      }
    ],
    [
      "ical",
      async function() {
        const mod = await Promise.resolve().then(() => (init_ical_tasks(), ical_tasks_exports));
        return mod.default;
      }
    ]
  ]);
  var engineHacks = new Map([
    [
      "feed",
      {
        unselectableFolderTypes: new Set()
      }
    ],
    [
      "gapi",
      {
        unselectableFolderTypes: new Set()
      }
    ],
    [
      "mapi",
      {
        unselectableFolderTypes: new Set()
      }
    ],
    [
      "ical",
      {
        unselectableFolderTypes: new Set()
      }
    ]
  ]);
  var engineBackEndFacts = new Map([
    [
      "feed",
      {
        syncGranularity: "account"
      }
    ],
    [
      "gapi",
      {
        syncGranularity: "folder"
      }
    ],
    [
      "mapi",
      {
        syncGranularity: "folder"
      }
    ],
    [
      "ical",
      {
        syncGranularity: "account"
      }
    ]
  ]);
  var engineFrontEndAccountMeta = new Map([
    [
      "feed",
      {
        engineFacts: {
          syncGranularity: "account"
        },
        usesArchiveMetaphor: false
      }
    ],
    [
      "gapi",
      {
        engineFacts: {
          syncGranularity: "folder",
          oauth: {
            scopes: [
              "https://www.googleapis.com/auth/gmail.readonly",
              "https://www.googleapis.com/auth/calendar.events.readonly",
              "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
              "https://www.googleapis.com/auth/documents.readonly"
            ]
          }
        },
        usesArchiveMetaphor: true
      }
    ],
    [
      "mapi",
      {
        engineFacts: {
          syncGranularity: "folder",
          oauth: {
            scopes: [
              "offline_access",
              "https://graph.microsoft.com/Calendars.Read",
              "https://graph.microsoft.com/Mail.Read",
              "https://graph.microsoft.com/User.Read"
            ]
          }
        },
        usesArchiveMetaphor: true
      }
    ],
    [
      "ical",
      {
        engineFacts: {
          syncGranularity: "account"
        },
        usesArchiveMetaphor: false
      }
    ]
  ]);
  var engineFrontEndFolderMeta = new Map([
    [
      "feed",
      {
        syncGranularity: "account"
      }
    ],
    [
      "gapi",
      {
        syncGranularity: "folder"
      }
    ],
    [
      "mapi",
      {
        syncGranularity: "folder"
      }
    ],
    [
      "ical",
      {
        syncGranularity: "account"
      }
    ]
  ]);

  // src/backend/db/accounts_toc.js
  var import_evt5 = __toModule(require_evt());
  init_logic();
  init_util();
  function accountDefComparator(a, b) {
    if (!a.name) {
      return -1;
    } else if (!b.name) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  }
  var AccountsTOC = class extends import_evt5.Emitter {
    constructor() {
      super();
      logic.defineScope(this, "AccountsTOC");
      this.type = "AccountsTOC";
      this.overlayNamespace = "accounts";
      this.accountDefs = this.items = [];
      this.accountDefsById = this.itemsById = new Map();
    }
    async __acquire() {
      return this;
    }
    __release() {
    }
    isKnownAccount(accountId) {
      return this.accountDefsById.has(accountId);
    }
    getAllItems() {
      return this.accountDefs.map(this.accountDefToWireRep);
    }
    getItemIndexById(id) {
      const item = this.itemsById.get(id);
      return this.items.indexOf(item);
    }
    __addAccount(accountDef) {
      const idx = bsearchForInsert(this.accountDefs, accountDef, accountDefComparator);
      this.accountDefs.splice(idx, 0, accountDef);
      this.accountDefsById.set(accountDef.id, accountDef);
      logic(this, "addAccount", { accountId: accountDef.id, index: idx });
      const wireRep = this.accountDefToWireRep(accountDef);
      this.emit("add", wireRep, idx);
    }
    __accountModified(accountDef) {
      const idx = this.accountDefs.indexOf(accountDef);
      if (idx === -1) {
        throw new Error("how do you have a different object?");
      }
      this.emit("change", this.accountDefToWireRep(accountDef), idx);
    }
    __removeAccountById(accountId) {
      const accountDef = this.accountDefsById.get(accountId);
      const idx = this.accountDefs.indexOf(accountDef);
      logic(this, "removeAccountById", { accountId, index: idx });
      this.accountDefsById.delete(accountId);
      this.accountDefs.splice(idx, 1);
      this.emit("remove", accountId, idx);
    }
    accountDefToWireRep(accountDef) {
      return Object.assign({
        id: accountDef.id,
        name: accountDef.name,
        type: accountDef.type,
        engine: accountDef.engine,
        defaultPriority: accountDef.defaultPriority,
        enabled: true,
        problems: [],
        kind: accountDef.kind,
        syncRange: accountDef.syncRange,
        syncInterval: accountDef.syncInterval,
        notifyOnNew: accountDef.notifyOnNew,
        playSoundOnSend: accountDef.playSoundOnSend,
        identities: accountDef.identities,
        credentials: {
          username: accountDef.credentials.username,
          outgoingUsername: accountDef.credentials.outgoingUsername,
          oauth2: accountDef.credentials.oauth2
        },
        servers: [
          {
            type: accountDef.receiveType,
            connInfo: accountDef.receiveConnInfo,
            activeConns: 0
          },
          {
            type: accountDef.sendType,
            connInfo: accountDef.sendConnInfo,
            activeConns: 0
          }
        ]
      }, engineFrontEndAccountMeta.get(accountDef.engine));
    }
  };

  // src/backend/db/folders_toc.js
  init_logic();
  init_util();
  var import_evt6 = __toModule(require_evt());
  init_id_conversions();
  init_folder_info_rep();
  var FOLDER_TYPE_TO_SORT_PRIORITY = {
    account: "a",
    inbox: "c",
    starred: "e",
    important: "f",
    drafts: "g",
    localdrafts: "h",
    outbox: "i",
    queue: "j",
    sent: "k",
    junk: "l",
    trash: "n",
    archive: "p",
    normal: "z",
    nomail: "z",
    calendar: "z"
  };
  function strcmp(a, b) {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    }
    return 0;
  }
  var FoldersTOC = class extends import_evt6.Emitter {
    constructor({ db, accountDef, folders, dataOverlayManager }) {
      super();
      logic.defineScope(this, "FoldersTOC");
      this.type = "FoldersTOC";
      this.overlayNamespace = "folders";
      this.accountDef = accountDef;
      this.engineFolderMeta = engineFrontEndFolderMeta.get(accountDef.engine);
      this.engineHacks = engineHacks.get(accountDef.engine);
      this.accountId = accountDef.id;
      this._dataOverlayManager = dataOverlayManager;
      this.foldersById = this.itemsById = new Map();
      this.foldersByPath = new Map();
      this.foldersByTag = new Map();
      this._pendingFoldersByPath = new Map();
      this._pendingTaskContextIdsToPendingPaths = new Map();
      this.items = this.folders = [];
      this.folderSortStrings = [];
      let nextFolderNum = 0;
      for (const folderInfo of folders) {
        this._addFolder(folderInfo);
        nextFolderNum = Math.max(nextFolderNum, decodeFolderIdComponentFromFolderId(folderInfo.id) + 1);
      }
      this._nextFolderNum = nextFolderNum;
      db.on(`acct!${accountDef.id}!change`, this._onAccountChange.bind(this));
      db.on(`acct!${accountDef.id}!folders!tocChange`, this._onTOCChange.bind(this));
      dataOverlayManager.on("accountCascadeToFolders", this._onAccountOverlayCascade.bind(this));
    }
    __acquire() {
      return Promise.resolve(this);
    }
    __release() {
    }
    issueFolderId() {
      return makeFolderId(this.accountId, this._nextFolderNum++);
    }
    ensureLocalVirtualFolder(taskContext, folderPath) {
      let folderInfo = this.foldersByPath.get(folderPath);
      if (folderInfo) {
        return folderInfo;
      }
      let taskPendingPaths = this._pendingTaskContextIdsToPendingPaths.get(taskContext.id);
      if (!taskPendingPaths) {
        taskPendingPaths = new Set();
        taskContext.__decorateFinish(this._onTaskFinishing.bind(this));
        this._pendingTaskContextIdsToPendingPaths.set(taskContext.id, taskPendingPaths);
      }
      taskPendingPaths.add(folderPath);
      folderInfo = this._pendingFoldersByPath.get(folderPath);
      if (folderInfo) {
        return folderInfo;
      }
      const pathParts = folderPath.split("/");
      folderInfo = makeFolderMeta({
        id: this.issueFolderId(),
        serverId: null,
        name: folderPath,
        type: "normal",
        path: folderPath,
        serverPath: null,
        delim: "/",
        depth: pathParts.length,
        syncGranularity: "local-only"
      });
      this._pendingFoldersByPath.set(folderPath, folderInfo);
      return folderInfo;
    }
    _isFolderPathPending(folderPath) {
      for (const taskPendingPaths of this._pendingTaskContextIdsToPendingPaths.values()) {
        if (taskPendingPaths.has(folderPath)) {
          return true;
        }
      }
      return false;
    }
    _onTaskFinishing(taskCtx, success, finishData) {
      const taskPendingPaths = this._pendingTaskContextIdsToPendingPaths.get(taskCtx.id);
      this._pendingTaskContextIdsToPendingPaths.delete(taskCtx.id);
      for (const folderPath of taskPendingPaths) {
        const folderInfo = this._pendingFoldersByPath.get(folderPath);
        if (!folderInfo) {
          continue;
        }
        if (!success) {
          if (this._isFolderPathPending(folderPath)) {
            continue;
          }
        }
        this._pendingFoldersByPath.delete(folderPath);
        if (!success) {
          continue;
        }
        if (!finishData.newData) {
          finishData.newData = {};
        }
        if (!finishData.newData.folders) {
          finishData.newData.folders = [];
        }
        finishData.newData.folders.push(folderInfo);
      }
    }
    getAllItems() {
      return this.items;
    }
    getItemIndexById(id) {
      return this.items.findIndex((item) => {
        return item.id === id;
      });
    }
    _makeFolderSortString(folderInfo) {
      if (!folderInfo) {
        return "";
      }
      var parentFolderInfo = this.foldersById.get(folderInfo.parentId);
      return this._makeFolderSortString(parentFolderInfo) + "!" + FOLDER_TYPE_TO_SORT_PRIORITY[folderInfo.type] + "!" + folderInfo.name.toLocaleLowerCase();
    }
    _onAccountOverlayCascade(accountId) {
      if (accountId === this.accountId) {
        for (const folder of this.items) {
          this._dataOverlayManager.announceUpdatedOverlayData(this.overlayNamespace, folder.id);
        }
      }
    }
    _onAccountChange() {
      this._fakeFolderDataChanges();
    }
    _fakeFolderDataChanges(filterFunc) {
      for (let i = 0; i < this.items.length; i++) {
        const folder = this.items[i];
        if (!filterFunc || filterFunc(folder)) {
          this.emit("change", this.folderInfoToWireRep(folder), i);
        }
      }
    }
    _onTOCChange(folderId, folderInfo, isNew) {
      if (isNew) {
        this._addFolder(folderInfo);
      } else if (folderInfo) {
        this._handleFolderTagChange(folderInfo);
        this.emit("change", this.folderInfoToWireRep(folderInfo), this.items.findIndex((info) => info.id === folderId));
      } else {
        this._removeFolderById(folderId);
      }
    }
    _handleFolderTagChange(folderInfo) {
      if (!folderInfo.tags) {
        return;
      }
      const folderId = folderInfo.id;
      const folderTags = new Set(folderInfo.tags);
      for (const [tag, folders] of this.foldersByTag) {
        const idx = folders.findIndex((info) => info.id === folderId);
        if (folderTags.has(tag)) {
          folderTags.delete(tag);
          if (idx === -1) {
            folders.push(folderInfo);
          }
        } else if (idx !== -1) {
          folders.splice(idx, 1);
        }
      }
      for (const tag of folderTags) {
        const folders = [];
        this.foldersByTag.set(tag, folders);
        folders.push(folderInfo);
      }
    }
    _addFolderTag(folderInfo) {
      const tags = folderInfo.tags || [];
      for (const tag of tags) {
        let folders = this.foldersByTag.get(tag);
        if (!folders) {
          folders = [];
          this.foldersByTag.set(tag, folders);
        }
        folders.push(folderInfo);
      }
    }
    _addFolder(folderInfo) {
      const sortString = this._makeFolderSortString(folderInfo);
      const idx = bsearchForInsert(this.folderSortStrings, sortString, strcmp);
      this.items.splice(idx, 0, folderInfo);
      logic(this, "addFolder", {
        id: folderInfo.id,
        index: idx,
        _folderInfo: folderInfo
      });
      this.folderSortStrings.splice(idx, 0, sortString);
      this.foldersById.set(folderInfo.id, folderInfo);
      this.foldersByPath.set(folderInfo.path, folderInfo);
      this._addFolderTag(folderInfo);
      this.emit("add", this.folderInfoToWireRep(folderInfo), idx);
    }
    _removeFolderTag(folderInfo) {
      const tags = folderInfo.tags || [];
      const folderId = folderInfo.id;
      for (const tag of tags) {
        const folders = this.foldersByTag.get(tag);
        if (folders) {
          const idx = folders.findIndex((info) => info.id === folderId);
          if (idx !== -1) {
            folders.splice(idx, 1);
          }
        }
      }
    }
    _removeFolderById(id) {
      const folderInfo = this.foldersById.get(id);
      const idx = this.items.indexOf(folderInfo);
      logic(this, "removeFolderById", { id, index: idx });
      if (!folderInfo || idx === -1) {
        throw new Error("the folder did not exist?");
      }
      this.foldersById.delete(id);
      this.foldersByPath.delete(folderInfo.path);
      this.items.splice(idx, 1);
      this.folderSortStrings.splice(idx, 1);
      this._removeFolderTag(folderInfo);
      this.emit("remove", id, idx);
    }
    getCanonicalFolderByType(type) {
      return this.items.find((folder) => folder.type === type) || null;
    }
    generatePersistenceInfo() {
      return this._foldersDbState;
    }
    folderInfoToWireRep(folder) {
      let mixFromAccount;
      if (this.engineFolderMeta.syncGranularity === "account" && this.accountDef.syncInfo) {
        const syncInfo = this.accountDef.syncInfo;
        mixFromAccount = {
          lastSuccessfulSyncAt: syncInfo.lastSuccessfulSyncAt,
          lastAttemptedSyncAt: syncInfo.lastAttemptedSyncAt,
          failedSyncsSinceLastSuccessfulSync: syncInfo.failedSyncsSinceLastSuccessfulSync
        };
      }
      return Object.assign({}, folder, this.engineFolderMeta, {
        engineSaysUnselectable: this.engineHacks.unselectableFolderTypes.has(folder.type)
      }, mixFromAccount);
    }
  };

  // src/backend/universe/account_manager.js
  function prereqify(mapPropName, func, forgetOnResolve) {
    return function(id) {
      const map = this[mapPropName];
      let promise = map.get(id);
      if (promise) {
        return promise;
      }
      try {
        promise = func.apply(this, arguments);
      } catch (ex) {
        return Promise.reject(ex);
      }
      map.set(id, promise);
      if (forgetOnResolve) {
        promise.then(() => {
          map.delete(id);
        });
      }
      return promise;
    };
  }
  var AccountManager = class {
    constructor({ db, universe: universe2, taskRegistry, taskResources }) {
      logic.defineScope(this, "AccountManager");
      this.db = db;
      db.accountManager = this;
      this.universe = universe2;
      this.taskRegistry = taskRegistry;
      this.taskResources = taskResources;
      this._immediateAccountDefsById = new Map();
      this.accountsTOC = new AccountsTOC();
      this._taskTypeLoads = new Map();
      this._accountFoldersTOCLoads = new Map();
      this._accountLoads = new Map();
      this._stashedConnectionsByAccountId = new Map();
      this.accountFoldersTOCs = new Map();
      this.accounts = new Map();
      this.db.on("accounts!tocChange", this._onTOCChange.bind(this));
      this._ensureTasksLoaded = prereqify("_taskTypeLoads", async (engineId) => {
        const tasks = await engineTaskMappings.get(engineId)();
        this.taskRegistry.registerPerAccountTypeTasks(engineId, tasks);
        return true;
      });
      this._ensureAccountFoldersTOC = prereqify("_accountFoldersTOCLoads", (accountId) => {
        return this.db.loadFoldersByAccount(accountId).then((folders) => {
          const accountDef = this.getAccountDefById(accountId);
          const foldersTOC = new FoldersTOC({
            db: this.db,
            accountDef,
            folders,
            dataOverlayManager: this.universe.dataOverlayManager
          });
          this.accountFoldersTOCs.set(accountId, foldersTOC);
          return foldersTOC;
        });
      }, true);
      this._ensureAccount = prereqify("_accountLoads", (accountId) => {
        return this._ensureAccountFoldersTOC(accountId).then((foldersTOC) => {
          const accountDef = this.getAccountDefById(accountId);
          return accountModules.get(accountDef.type)().then((accountConstructor) => {
            const stashedConn = this._stashedConnectionsByAccountId.get(accountId);
            this._stashedConnectionsByAccountId.delete(accountId);
            const account = new accountConstructor(this.universe, accountDef, foldersTOC, this.db, stashedConn);
            this.accounts.set(accountId, account);
            if (this.universe.online) {
              this.universe.syncFolderList(accountId, "loadAccount");
            }
            return account;
          });
        });
      }, true);
    }
    initFromDB(accountDefs) {
      const waitFor = [];
      for (const accountDef of accountDefs) {
        waitFor.push(this._accountAdded(accountDef));
      }
      return Promise.all(waitFor);
    }
    stashAccountConnection(accountId, conn) {
      this._stashedConnectionsByAccountId.set(accountId, conn);
    }
    acquireAccountsTOC(ctx) {
      return ctx.acquire(this.accountsTOC);
    }
    acquireAccount(ctx, accountId) {
      const account = this.accounts.get(accountId);
      if (account) {
        return ctx.acquire(account);
      }
      return this._ensureAccount(accountId).then((_account) => {
        return ctx.acquire(_account);
      });
    }
    acquireAccountFoldersTOC(ctx, accountId) {
      const foldersTOC = this.accountFoldersTOCs.get(accountId);
      if (foldersTOC) {
        return ctx.acquire(foldersTOC);
      }
      return this._ensureAccountFoldersTOC(accountId).then((_foldersTOC) => {
        return ctx.acquire(_foldersTOC);
      });
    }
    getAccountDefById(accountId) {
      return this._immediateAccountDefsById.get(accountId);
    }
    getAccountEngineBackEndFacts(accountId) {
      const accountDef = this._immediateAccountDefsById.get(accountId);
      return engineBackEndFacts.get(accountDef.engine);
    }
    getAllAccountDefs() {
      return this._immediateAccountDefsById.values();
    }
    getAllAccountIdsWithKind(kind) {
      const ids = [];
      for (const accountDef of this.getAllAccountDefs()) {
        if (!kind || accountDef.kind === kind) {
          ids.push(accountDef.id);
        }
      }
      return ids;
    }
    getFolderById(folderId) {
      const accountId = accountIdFromFolderId(folderId);
      const foldersTOC = this.accountFoldersTOCs.get(accountId);
      return foldersTOC.foldersById.get(folderId);
    }
    getFolderIdsByTag(accountId, tag) {
      const foldersTOC = this.accountFoldersTOCs.get(accountId);
      const foldersInfo = tag && foldersTOC.foldersByTag.get(tag) || foldersTOC.getAllItems();
      return foldersInfo.map((info) => info.id);
    }
    _onTOCChange(accountId, accountDef, isNew) {
      if (isNew) {
        this._accountAdded(accountDef);
      } else if (!accountDef) {
        this._accountRemoved(accountId);
      } else if (this.accountFoldersTOCs.has(accountId)) {
        this.accountsTOC.__accountModified(accountDef);
      }
    }
    _accountAdded(accountDef) {
      logic(this, "accountExists", { accountId: accountDef.id });
      this.taskResources.resourceAvailable(`credentials!${accountDef.id}`);
      this.taskResources.resourceAvailable(`happy!${accountDef.id}`);
      this._immediateAccountDefsById.set(accountDef.id, accountDef);
      const waitFor = [
        this._ensureTasksLoaded(accountDef.engine),
        this._ensureAccountFoldersTOC(accountDef.id)
      ];
      return Promise.all(waitFor).then(() => {
        if (this._stashedConnectionsByAccountId.has(accountDef.id)) {
          this._ensureAccount(accountDef.id);
        }
        this.accountsTOC.__addAccount(accountDef);
      });
    }
    _accountRemoved(accountId) {
      this._immediateAccountDefsById.delete(accountId);
      const doAccountCleanup = () => {
        const account = this.accounts.get(accountId);
        this.accounts.delete(accountId);
        this._accountLoads.delete(accountId);
        if (account) {
          account.shutdown();
        }
      };
      if (this.accounts.has(accountId)) {
        doAccountCleanup();
      } else if (this._accountLoads.has(accountId)) {
        this._accountLoads.get(accountId).then(doAccountCleanup);
      }
      const doFolderCleanup = () => {
        this.accountFoldersTOCs.delete(accountId);
        this._accountFoldersTOCLoads.delete(accountId);
        this.accountsTOC.__removeAccountById(accountId);
      };
      if (this.accountFoldersTOCs.has(accountId)) {
        doFolderCleanup();
      } else if (this._accountFoldersTOCLoads.has(accountId)) {
        this._accountFoldersTOCLoads.then(doFolderCleanup);
      }
    }
  };

  // src/backend/universe/cronsync_support.js
  init_logic();
  init_worker_router();
  init_syncbase();

  // src/backend/wakelocks.js
  init_logic();
  init_worker_router();
  var sendWakeLockMessage = registerCallbackType("wakelocks");
  function SmartWakeLock(opts) {
    logic.defineScope(this, "SmartWakeLock", { types: opts.locks });
    var locks = this.locks = {};
    this.timeoutMs = opts.timeout || SmartWakeLock.DEFAULT_TIMEOUT_MS;
    this._timeout = null;
    this.imminentDoomHandler = opts.imminentDoomHandler || null;
    if (opts.__existingLockId) {
      this.locks[opts.locks[0]] = opts.__existingLockId;
      logic(this, "reusedMainthreadLock");
      this._readyPromise = Promise.resolve();
      this.renew();
      return;
    }
    logic(this, "requestLock", { durationMs: this.timeoutMs });
    this._readyPromise = Promise.all(opts.locks.map((type) => {
      return sendWakeLockMessage("requestWakeLock", [type]).then((lockId) => {
        locks[type] = lockId;
      });
    })).then(() => {
      logic(this, "locked", {});
      this.renew();
    });
  }
  SmartWakeLock.DEFAULT_TIMEOUT_MS = 45e3;
  SmartWakeLock.prototype = {
    renew(reason) {
      return this._readyPromise.then(() => {
        if (this._timeout) {
          clearTimeout(this._timeout);
          logic(this, "renew", {
            reason,
            renewDurationMs: this.timeoutMs,
            durationLeftMs: this.timeoutMs - (Date.now() - this._timeLastRenewed)
          });
        }
        this._timeLastRenewed = Date.now();
        this._timeout = setTimeout(() => {
          logic(this, "timeoutUnlock");
          if (this.imminentDoomHandler) {
            try {
              this.imminentDoomHandler();
            } catch (ex) {
            }
          }
          this.unlock("timeout");
        }, this.timeoutMs);
      });
    },
    unlock(reason) {
      return this._readyPromise.then(() => {
        var locks = this.locks;
        this.locks = {};
        clearTimeout(this._timeout);
        this._timeout = null;
        logic(this, "unlock", { reason });
        return Promise.all(Object.keys(locks).map((type) => {
          return sendWakeLockMessage("unlock", [locks[type]], () => {
            return type;
          });
        })).then(() => {
          logic(this, "unlocked", { reason });
        });
      });
    },
    toString() {
      return Object.keys(this.locks).join("+") || "(no locks)";
    }
  };
  function wrapMainThreadAcquiredWakelock({
    wakelockId,
    timeout,
    imminentDoomHandler
  }) {
    return new SmartWakeLock({
      locks: ["mainthread-acquired"],
      timeout,
      imminentDoomHandler,
      __existingLockId: wakelockId
    });
  }

  // src/backend/universe/cronsync_support.js
  init_date();
  function CronSyncSupport({ universe: universe2, db, accountManager }) {
    this._universe = universe2;
    this._db = db;
    this._accountManager = accountManager;
    logic.defineScope(this, "CronSync");
    this._ensureSyncPromise = null;
    this._ensureSyncResolve = null;
    this._activeWakeLock = null;
    this._activeCronSyncLogConclusion = null;
    this._activelyCronSyncingAccounts = new Set();
    this.sendCronSync = registerSimple("cronsync", (data) => {
      var args = data.args;
      logic(this, "message", { cmd: data.cmd });
      switch (data.cmd) {
        case "alarm":
          this.onAlarm.apply(this, args);
          break;
        case "syncEnsured":
          this.onSyncEnsured.apply(this, args);
          break;
        default:
          break;
      }
    });
    this._bound_cronsyncSuccess = this._cronsyncVictoriousCompletion.bind(this);
    this._bound_cronsyncImminentDoom = this._cronsyncImminentDoom.bind(this);
  }
  CronSyncSupport.prototype = {
    systemReady() {
      this.sendCronSync("hello");
    },
    ensureSync(why) {
      if (this._ensureSyncPromise) {
        logic(this, "ensureSyncConsolidated", { why });
        return this._ensureSyncPromise;
      }
      logic(this, "ensureSync:begin", { why });
      this._ensureSyncPromise = new Promise((resolve) => {
        this._ensureSyncResolve = resolve;
      });
      let syncData = {};
      for (let accountDef of this._accountManager.getAllAccountDefs()) {
        let interval = accountDef.syncInterval, intervalKey = "interval" + interval;
        if (!syncData.hasOwnProperty(intervalKey)) {
          syncData[intervalKey] = [];
        }
        syncData[intervalKey].push(accountDef.id);
      }
      this.sendCronSync("ensureSync", [syncData]);
      return null;
    },
    onSyncEnsured() {
      logic(this, "ensureSync:end");
      this._ensureSyncResolve();
      this._ensureSyncPromise = null;
      this._ensureSyncResolve = null;
    },
    cronsyncAccount({ accountId, logTimestamp }) {
      let cronsyncLogEntry = {
        accountId,
        startTS: null,
        endTS: null,
        status: null
      };
      let cronsyncLogWrapped = {
        type: "cronsync",
        timestamp: logTimestamp,
        id: accountId,
        entry: cronsyncLogEntry
      };
      if (this._activelyCronSyncingAccounts.has(accountId)) {
        cronsyncLogEntry.status = "already-active";
        this._db.addBoundedLogs([cronsyncLogWrapped]);
        return false;
      }
      let foldersTOC = this._accountManager.accountFoldersTOCs.get(accountId);
      if (!foldersTOC) {
        cronsyncLogEntry.status = "account-dead";
        this._db.addBoundedLogs([cronsyncLogWrapped]);
        return false;
      }
      let inboxFolderId = foldersTOC.getCanonicalFolderByType("inbox").id;
      this._universe.syncRefreshFolder(inboxFolderId, "cronsync").then(() => {
        this._activelyCronSyncingAccounts.delete(accountId);
        cronsyncLogEntry.endTS = NOW();
        cronsyncLogEntry.status = "completed...somehow";
        this._db.updateBoundedLogs([cronsyncLogWrapped]);
      });
      this._activelyCronSyncingAccounts.add(accountId);
      cronsyncLogEntry.startTS = logTimestamp;
      cronsyncLogEntry.status = "issued";
      this._db.addBoundedLogs([cronsyncLogWrapped]);
      return true;
    },
    onAlarm(syncAccountIds, interval, wakelockId, accountIdsWithNotifications) {
      logic(this, "alarmFired", { syncAccountIds, interval, wakelockId });
      let logTimestamp = NOW();
      let wakelock = wrapMainThreadAcquiredWakelock({
        wakelockId,
        timeout: CRONSYNC_MAX_DURATION_MS
      });
      let cronsyncLogEntry = {
        startTS: logTimestamp,
        startOnline: this._universe.online,
        accountIds: syncAccountIds,
        endTS: null,
        endOnline: null,
        result: null
      };
      let cronsyncLogWrapped = {
        type: "cronsync",
        timestamp: logTimestamp,
        id: "cronsync",
        entry: cronsyncLogEntry
      };
      this._db.addBoundedLogs([cronsyncLogWrapped]);
      this.ensureSync("alarm");
      for (let accountDef of this._accountManager.getAllAccountDefs()) {
        if (accountIdsWithNotifications(accountDef.id)) {
          this._universe.clearNewTrackingForAccount({
            accountId: accountDef.id,
            silent: true
          });
        }
      }
      let cronsyncsIssued = 0;
      for (let accountId of syncAccountIds) {
        if (this.cronsyncAccount({ accountId, logTimestamp })) {
          cronsyncsIssued++;
        }
      }
      let logConclusion = (result) => {
        cronsyncLogEntry.endTS = NOW();
        cronsyncLogEntry.endOnline = this._universe.online;
        cronsyncLogEntry.result = result;
        this._db.updateBoundedLogs([cronsyncLogWrapped]);
      };
      if (this._activeWakeLock) {
        if (cronsyncsIssued) {
          logic(this, "cronSync:handoff");
          this._activeWakeLock.unlock();
          this._activeWakeLock = wakelock;
          this._activeWakeLock.imminentDoomHandler = this._bound_cronsyncImminentDoom;
          this._activeCronSyncLogConclusion("superseded");
          this._activeCronSyncLogConclusion = logConclusion;
        } else {
          logic(this, "cronSync:no-sync-no-handoff");
          wakelock.unlock();
          logConclusion("ignored-ineffective");
        }
      } else {
        logic(this, "cronSync:begin");
        this._activeWakeLock = wakelock;
        this._activeWakeLock.imminentDoomHandler = this._bound_cronsyncImminentDoom;
        this._activeCronSyncLogConclusion = logConclusion;
        this._universe.taskManager.once("taskQueueEmpty", this._bound_cronsyncSuccess);
      }
    },
    _cronsyncVictoriousCompletion() {
      let wakelockOnEntry = this._activeWakeLock;
      let logConclusionOnEntry = this._activeCronSyncLogConclusion;
      this._activeWakeLock = null;
      this._activeCronSyncLogConclusion = null;
      let realCompletion = () => {
        if (this._activeWakeLock) {
          logic(this, "cronSync:last-minute-handoff");
          logConclusionOnEntry("success-left-open");
          wakelockOnEntry.unlock();
          return;
        }
        logic(this, "cronSync:end");
        this._universe.broadcastOverBridges("cronSyncComplete", {});
        logConclusionOnEntry("success");
        wakelockOnEntry.unlock();
      };
      if (this._ensureSyncPromise) {
        this._ensureSyncPromise.then(realCompletion);
      } else {
        realCompletion();
      }
    },
    _cronsyncImminentDoom() {
      logic(this, "cronSyncEpicFail");
      this._universe.broadcastOverBridges("cronSyncEpicFail", {
        epicnessLevel: "so epic"
      });
    },
    shutdown() {
      unregister("cronsync");
    }
  };

  // src/backend/universe/extension_manager.js
  init_logic();
  function ExtensionManager({ derivedViewManager, tocManager }) {
    logic.defineScope(this, "ExtensionManager");
    this._extensionDefs = [];
    this._derivedViewManager = derivedViewManager;
    this._tocManager = tocManager;
  }
  ExtensionManager.prototype = {
    registerExtension(extDef, source) {
      logic(this, "registerExtension", { name: extDef.name, source });
      this._extensionDefs.push(extDef);
      if (extDef.derivedViews) {
        for (let namespace of Object.keys(extDef.derivedViews)) {
          extDef.derivedViews[namespace]().then((provider) => {
            this._derivedViewManager.registerDerivedViewProvider(namespace, provider);
          }, (ex) => {
            logic(this, "extensionRequireError", {
              name: extDef.name,
              entryPoint: "derivedView",
              ex,
              stack: ex.stack
            });
          });
        }
      }
      if (extDef.tocs) {
        for (let namespace of Object.keys(extDef.tocs)) {
          extDef.tocs[namespace]().then((provider) => {
            this._tocManager.registerNamespaceProvider(namespace, provider);
          }, (ex) => {
            logic(this, "extensionRequireError", {
              name: extDef.name,
              entryPoint: "tocs",
              ex,
              stack: ex.stack
            });
          });
        }
      }
    },
    registerExtensions(extensionDefs, source) {
      logic(this, "registerExtensions", { source });
      for (let extDef of extensionDefs) {
        this.registerExtension(extDef, source);
      }
    }
  };

  // src/backend/db/static_toc.js
  init_logic();

  // src/backend/db/base_toc.js
  var import_evt7 = __toModule(require_evt());
  init_logic();

  // src/backend/refed_resource.js
  function RefedResource(onForgotten) {
    this._activatePromise = null;
    this._valid = false;
    this._activeConsumers = [];
    this._onForgotten = onForgotten;
  }
  RefedResource.prototype = {
    async __acquire(ctx) {
      if (this._activeConsumers.includes(ctx)) {
        throw new Error("context already refs this resource!");
      }
      this._activeConsumers.push(ctx);
      if (!this._valid && this._activeConsumers.length === 1) {
        this._activatePromise = this.__activate();
        await this._activatePromise;
        this._valid = true;
        this._activatePromise = null;
      } else if (this._activatePromise) {
        await this._activatePromise;
      }
      return this;
    },
    async __release(ctx) {
      const idx = this._activeConsumers.indexOf(ctx);
      if (idx === -1) {
        throw new Error("context does not ref this resource!");
      }
      this._activeConsumers.splice(idx, 1);
      if (this._activeConsumers.length === 0) {
        this.__deactivate();
        if (this._onForgotten) {
          this._onForgotten(this, this.convId);
        }
        this._onForgotten = null;
      }
    }
  };
  RefedResource.mix = function(obj) {
    Object.keys(RefedResource.prototype).forEach(function(prop) {
      if (obj.hasOwnProperty(prop)) {
        throw new Error('Object already has a property "' + prop + '"');
      }
      obj[prop] = RefedResource.prototype[prop];
    });
    return obj;
  };

  // src/backend/db/base_toc.js
  var BaseTOC = class extends import_evt7.Emitter {
    constructor({ metaHelpers = [], refreshHelpers = [], onForgotten }) {
      super();
      RefedResource.call(this, onForgotten);
      this._metaHelpers = metaHelpers;
      this._refreshHelpers = refreshHelpers;
      this.tocMeta = {};
      this._everActivated = false;
      this.flush = null;
    }
    static checkProtoValidity(obj) {
      Object.keys(BaseTOC.prototype).forEach(function(prop) {
        if (!obj.hasOwnProperty(prop)) {
          obj[prop] = BaseTOC.prototype[prop];
        } else if (BaseTOC.prototype[prop]) {
          throw new Error("object and base both have truthy property: " + prop);
        }
      });
      return obj;
    }
    __activate() {
      this._everActivated = true;
      for (const metaHelper of this._metaHelpers) {
        logic(this, "activatingMetaHelper", {
          name: metaHelper.constructor && metaHelper.constructor.name
        });
        metaHelper.activate(this);
      }
      return this.__activateTOC.apply(this, arguments);
    }
    __deactivate() {
      if (this._everActivated) {
        for (const metaHelper of this._metaHelpers) {
          metaHelper.deactivate(this);
        }
      }
      return this.__deactivateTOC.apply(this, arguments);
    }
    applyTOCMetaChanges(changes) {
      const tocMeta = this.tocMeta;
      let somethingChanged = false;
      for (const key of Object.keys(changes)) {
        const value = changes[key];
        if (tocMeta[key] !== value) {
          tocMeta[key] = value;
          somethingChanged = true;
        }
      }
      if (somethingChanged) {
        this.emit("tocMetaChange", tocMeta);
      }
    }
    broadcastEvent(eventName, eventData) {
      this.emit("broadcastEvent", eventName, eventData);
    }
    refresh(why) {
      const refreshPromises = this._refreshHelpers.map((x) => x(why));
      return Promise.all(refreshPromises);
    }
  };
  RefedResource.mix(BaseTOC.prototype);

  // src/backend/db/static_toc.js
  var StaticTOC = class extends BaseTOC {
    constructor({ items, metaHelpers, onForgotten }) {
      super({ metaHelpers, onForgotten });
      logic.defineScope(this, "StaticTOC");
      this.type = "StaticTOC";
      this.overlayNamespace = null;
      this.heightAware = false;
      this.items = items;
      this.__deactivate(true);
    }
    async __activateTOC() {
      return this;
    }
    __deactivateTOC() {
    }
    get length() {
      return this.items.length;
    }
    get totalHeight() {
      return this.items.length;
    }
    getTopOrderingKey() {
      return 0;
    }
    getOrderingKeyForIndex(index) {
      return index;
    }
    findIndexForOrderingKey(key) {
      return key;
    }
    getDataForSliceRange(beginInclusive, endExclusive, alreadyKnownData) {
      beginInclusive = Math.max(0, beginInclusive);
      endExclusive = Math.min(endExclusive, this.items.length);
      const sendState = new Map();
      const newKnownSet = new Set();
      const items = this.items;
      const ids = [];
      for (let i = beginInclusive; i < endExclusive; i++) {
        const id = i;
        ids.push(id);
        const haveData = alreadyKnownData.has(id);
        if (haveData) {
          newKnownSet.add(id);
          continue;
        }
        newKnownSet.add(id);
        sendState.set(id, [items[i], null, null]);
      }
      return {
        ids,
        state: sendState,
        pendingReads: null,
        readPromise: null,
        newValidDataSet: newKnownSet
      };
    }
  };

  // src/backend/universe/static_toc_namespace_provider.js
  function makeStaticTOCNamespaceProvider(staticMap) {
    const tocCache = new Map();
    return function(args) {
      const { name } = args;
      const entry = staticMap[name];
      if (!entry) {
        throw new Error("bad namespace key name: " + name);
      }
      if (typeof entry === "function") {
        return entry(args);
      }
      if (!Array.isArray(entry)) {
        throw new Error("namespace entry data not an array");
      }
      let toc = tocCache.get(name);
      if (!toc) {
        toc = new StaticTOC({
          items: entry,
          onForgotten: () => {
            tocCache.delete(name);
          }
        });
        tocCache.set(name, toc);
      }
      return args.ctx.acquire(toc);
    };
  }

  // src/backend/universe/toc_manager.js
  function TOCManager() {
    this._namespaceProviders = new Map();
  }
  TOCManager.prototype = {
    registerNamespaceProvider(namespace, provider) {
      switch (typeof provider) {
        case "object":
          provider = makeStaticTOCNamespaceProvider(provider);
          break;
        case "function":
          break;
        default:
          throw new Error("Bad provider!");
      }
      this._namespaceProviders.set(namespace, provider);
    },
    acquireExtensionTOC(ctx, namespace, name) {
      const provider = this._namespaceProviders.get(namespace);
      if (!provider) {
        throw new Error("No such namespace:" + namespace);
      }
      return provider({ ctx, name });
    }
  };

  // src/backend/universe/derived_view_manager.js
  init_logic();
  function DerivedViewManager() {
    logic.defineScope(this, "DerivedViewManager");
    this._providersByName = new Map();
  }
  DerivedViewManager.prototype = {
    registerDerivedViewProvider(name, provider) {
      logic(this, "registerDerivedViewProvider", { name });
      this._providersByName.set(name, provider);
    },
    createDerivedView({ viewDef, ctx }) {
      const viewMaker = this._providersByName.get(viewDef.provider);
      if (!viewMaker) {
        console.warn("ViewMaker requested for", viewDef.provider, "but not found");
        return null;
      }
      const { toc, derivedView } = viewMaker(viewDef);
      ctx.proxy = new WindowedListProxy(toc, ctx);
      ctx.acquire(ctx.proxy).catch((err) => {
        logic(this, "derivedViewAcquireError", { name: viewDef.provider, err });
      });
      return derivedView;
    }
  };

  // src/backend/db/data_overlay_manager.js
  var import_evt8 = __toModule(require_evt());
  init_logic();
  var DataOverlayManager = class extends import_evt8.Emitter {
    constructor() {
      super();
      logic.defineScope(this, "DataOverlayManager");
      this.registeredProvidersByNamespace = new Map([
        ["accounts", new Map()],
        ["folders", new Map()],
        ["conversations", new Map()],
        ["messages", new Map()]
      ]);
    }
    registerProvider(namespace, name, func) {
      const providersForNamespace = this.registeredProvidersByNamespace.get(namespace);
      if (!providersForNamespace) {
        logic(this, "badNamespace", { namespace });
      }
      let funcs = providersForNamespace.get(name);
      if (!funcs) {
        funcs = [];
        providersForNamespace.set(name, funcs);
      }
      funcs.push(func);
    }
    announceUpdatedOverlayData(namespace, id) {
      logic(this, "announceUpdatedOverlayData", { namespace, id });
      this.emit(namespace, id);
    }
    makeBoundResolver(namespace) {
      return this._resolveOverlays.bind(this, this.registeredProvidersByNamespace.get(namespace));
    }
    _resolveOverlays(providersForNamespace, itemId) {
      const overlays = {};
      for (const [name, funcs] of providersForNamespace) {
        for (const func of funcs) {
          const contrib = func(itemId);
          if (contrib != null) {
            overlays[name] = contrib;
            break;
          }
        }
      }
      return overlays;
    }
  };

  // src/backend/db/folder_convs_toc.js
  init_logic();
  init_util();
  init_comparators();
  var FolderConversationsTOC = class extends BaseTOC {
    constructor({ db, query, dataOverlayManager, metaHelpers, onForgotten }) {
      super({ metaHelpers, onForgotten });
      logic.defineScope(this, "FolderConversationsTOC");
      this.type = "FolderConversationsTOC";
      this.overlayNamespace = "conversations";
      this.heightAware = true;
      this._db = db;
      this.query = query;
      this._overlayResolver = dataOverlayManager.makeBoundResolver(this.overlayNamespace, null);
      this._bound_onTOCChange = this.onTOCChange.bind(this);
      this.__deactivate(true);
    }
    async __activateTOC() {
      const idsWithDates = await this.query.execute();
      this.idsWithDates = idsWithDates;
      let totalHeight = 0;
      for (const info of idsWithDates) {
        totalHeight += info.height;
      }
      this.totalHeight = totalHeight;
      this.query.bind(this, this.onTOCChange);
    }
    __deactivateTOC(firstTime) {
      this.idsWithDates = [];
      this.totalHeight = 0;
      if (!firstTime) {
        this.query.destroy(this);
      }
    }
    get length() {
      return this.idsWithDates.length;
    }
    onTOCChange(change) {
      let dataOnly = change.removeDate === change.addDate;
      if (!dataOnly) {
        let oldIndex = -1;
        if (change.removeDate) {
          const oldKey = { date: change.removeDate, id: change.id };
          oldIndex = bsearchMaybeExists(this.idsWithDates, oldKey, folderConversationComparator);
          if (oldIndex !== -1) {
            this.totalHeight -= change.oldHeight;
            this.idsWithDates.splice(oldIndex, 1);
          } else {
            throw new Error("freakout! item should exist");
          }
        }
        let newIndex = -1;
        if (change.addDate) {
          const newKey = {
            date: change.addDate,
            id: change.id,
            height: change.height,
            matchInfo: change.matchInfo
          };
          newIndex = bsearchForInsert(this.idsWithDates, newKey, folderConversationComparator);
          this.totalHeight += change.height;
          this.idsWithDates.splice(newIndex, 0, newKey);
        }
        this.emit("_indexChange", oldIndex, newIndex);
        if (oldIndex === newIndex) {
          dataOnly = true;
        }
      } else {
        this.totalHeight += change.height - change.oldHeight;
      }
      this.emit("change", change.id, dataOnly);
    }
    sliceIds(begin, end) {
      const ids = [];
      const idsWithDates = this.idsWithDates;
      for (let i = begin; i < end; i++) {
        ids.push(idsWithDates[i].id);
      }
      return ids;
    }
    getOrderingKeyForIndex(index) {
      if (this.idsWithDates.length === 0) {
        return this.getTopOrderingKey();
      } else if (index < 0) {
        index = 0;
      } else if (index >= this.idsWithDates.length) {
        index = this.idsWithDates.length - 1;
      }
      return this.idsWithDates[index];
    }
    getTopOrderingKey() {
      return {
        date: new Date(2200, 0),
        id: "",
        height: 0
      };
    }
    findIndexForOrderingKey(key) {
      return bsearchForInsert(this.idsWithDates, key, folderConversationComparator);
    }
    getInfoForOffset(desiredOffset) {
      var actualOffset = 0;
      var idsWithDates = this.idsWithDates;
      var len = idsWithDates.length;
      var meta;
      for (var i = 0; i < len; i++) {
        meta = idsWithDates[i];
        if (desiredOffset < actualOffset + meta.height) {
          break;
        }
        actualOffset += meta.height;
      }
      if (!len) {
        meta = this.getTopOrderingKey();
      }
      return {
        orderingKey: meta,
        offset: actualOffset,
        cumulativeHeight: actualOffset + meta.height
      };
    }
    getHeightOffsetForIndex(desiredIndex) {
      let height = 0;
      const idsWithDates = this.idsWithDates;
      desiredIndex = Math.min(desiredIndex, idsWithDates.length);
      for (let i = 0; i < desiredIndex; i++) {
        height += idsWithDates[i].height;
      }
      return height;
    }
    _walkToCoverHeight(startIndex, delta, heightToConsume) {
      let index = startIndex;
      const idsWithDates = this.idsWithDates;
      let info = index < idsWithDates.length && idsWithDates[index];
      const tooHigh = idsWithDates.length - 1;
      while (heightToConsume > 0 && index < tooHigh && index + delta >= 0) {
        index += delta;
        info = this.idsWithDates[index];
        heightToConsume -= info.height;
      }
      return {
        index,
        overconsumed: Math.abs(heightToConsume)
      };
    }
    findIndicesFromCoordinateSoup(req) {
      let focusIndex = this.findIndexForOrderingKey(req.orderingKey);
      if (focusIndex >= this.idsWithDates.length && this.idsWithDates.length) {
        focusIndex--;
      }
      const {
        index: beginVisibleInclusive,
        overconsumed: beforeOverconsumed
      } = this._walkToCoverHeight(focusIndex, -1, req.visibleAbove);
      const { index: beginBufferedInclusive } = this._walkToCoverHeight(beginVisibleInclusive, -1, req.bufferAbove - beforeOverconsumed);
      const {
        index: endVisibleInclusive,
        overconsumed: afterOverconsumed
      } = this._walkToCoverHeight(focusIndex, 1, req.visibleBelow);
      const { index: endBufferedInclusive } = this._walkToCoverHeight(endVisibleInclusive, 1, req.bufferBelow - afterOverconsumed);
      const rval = {
        beginBufferedInclusive,
        beginVisibleInclusive,
        endVisibleExclusive: endVisibleInclusive + 1,
        endBufferedExclusive: endBufferedInclusive + 1,
        heightOffset: this.getHeightOffsetForIndex(beginBufferedInclusive)
      };
      return rval;
    }
    getDataForSliceRange(beginInclusive, endExclusive, alreadyKnownData, alreadyKnownOverlays) {
      beginInclusive = Math.max(0, beginInclusive);
      endExclusive = Math.min(endExclusive, this.idsWithDates.length);
      const overlayResolver = this._overlayResolver;
      const sendState = new Map();
      let needData = new Map();
      const newKnownSet = new Set();
      const idsWithDates = this.idsWithDates;
      const convCache = this._db.convCache;
      const ids = [];
      for (let i = beginInclusive; i < endExclusive; i++) {
        const id = idsWithDates[i].id;
        ids.push(id);
        const haveData = alreadyKnownData.has(id);
        const haveOverlays = alreadyKnownOverlays.has(id);
        if (haveData && haveOverlays) {
          newKnownSet.add(id);
          continue;
        }
        if (haveData) {
          sendState.set(id, [null, overlayResolver(id)], null);
        } else if (convCache.has(id)) {
          newKnownSet.add(id);
          sendState.set(id, [
            convCache.get(id),
            overlayResolver(id),
            idsWithDates[i].matchInfo
          ]);
        } else {
          needData.set(id, null);
        }
      }
      let readPromise = null;
      if (needData.size) {
        readPromise = this._db.read(this, {
          conversations: needData
        });
      } else {
        needData = null;
      }
      return {
        ids,
        state: sendState,
        pendingReads: needData,
        readPromise,
        newValidDataSet: newKnownSet
      };
    }
  };

  // src/backend/db/conv_toc.js
  init_logic();
  init_util();
  init_comparators();
  var ConversationTOC = class extends BaseTOC {
    constructor({
      db,
      query,
      dataOverlayManager,
      metaHelpers,
      refreshHelpers = null,
      onForgotten
    }) {
      super({ metaHelpers, refreshHelpers, onForgotten });
      logic.defineScope(this, "ConversationTOC");
      this.type = "ConversationTOC";
      this.overlayNamespace = "messages";
      this.heightAware = false;
      this._db = db;
      this.query = query;
      this._overlayResolver = dataOverlayManager.makeBoundResolver(this.overlayNamespace, null);
      this.__deactivate(true);
    }
    async __activateTOC() {
      const idsWithDates = await this.query.execute();
      idsWithDates.sort(conversationMessageComparator);
      this.idsWithDates = idsWithDates;
      this.query.bind(this, this.onTOCChange, this.onConvChange);
    }
    __deactivateTOC(firstTime) {
      this.idsWithDates = [];
      if (!firstTime) {
        this.query.destroy(this);
      }
    }
    get length() {
      return this.idsWithDates.length;
    }
    get totalHeight() {
      return this.idsWithDates.length;
    }
    onTOCChange({ id, preDate, postDate, item, freshlyAdded, matchInfo }) {
      let metadataOnly = item && !freshlyAdded;
      if (freshlyAdded) {
        const newKey = { date: postDate, id, matchInfo };
        const newIndex = bsearchForInsert(this.idsWithDates, newKey, conversationMessageComparator);
        this.idsWithDates.splice(newIndex, 0, newKey);
      } else if (!item) {
        const oldKey = { date: preDate, id };
        const oldIndex = bsearchMaybeExists(this.idsWithDates, oldKey, conversationMessageComparator);
        this.idsWithDates.splice(oldIndex, 1);
      } else if (preDate !== postDate) {
        const oldKey = { date: preDate, id };
        const oldIndex = bsearchMaybeExists(this.idsWithDates, oldKey, conversationMessageComparator);
        this.idsWithDates.splice(oldIndex, 1);
        const newKey = { date: postDate, id, matchInfo };
        const newIndex = bsearchForInsert(this.idsWithDates, newKey, conversationMessageComparator);
        this.idsWithDates.splice(newIndex, 0, newKey);
        metadataOnly = false;
      }
      this.emit("change", id, metadataOnly);
    }
    onConvChange(convId, convInfo) {
      if (convInfo === null) {
        this.idsWithDates.splice(0, this.idsWithDates.length);
        this.emit("change", null);
      }
    }
    sliceIds(begin, end) {
      const ids = [];
      const idsWithDates = this.idsWithDates;
      for (let i = begin; i < end; i++) {
        ids.push(idsWithDates[i].id);
      }
      return ids;
    }
    getTopOrderingKey() {
      return {
        date: new Date(2200, 0),
        id: ""
      };
    }
    getOrderingKeyForIndex(index) {
      if (this.idsWithDates.length === 0) {
        return this.getTopOrderingKey();
      } else if (index < 0) {
        index = 0;
      } else if (index >= this.idsWithDates.length) {
        index = this.idsWithDates.length - 1;
      }
      return this.idsWithDates[index];
    }
    findIndexForOrderingKey(key) {
      const index = bsearchForInsert(this.idsWithDates, key, conversationMessageComparator);
      return index;
    }
    getDataForSliceRange(beginInclusive, endExclusive, alreadyKnownData, alreadyKnownOverlays) {
      beginInclusive = Math.max(0, beginInclusive);
      endExclusive = Math.min(endExclusive, this.idsWithDates.length);
      const overlayResolver = this._overlayResolver;
      const sendState = new Map();
      let needData = new Map();
      const newKnownSet = new Set();
      const idsWithDates = this.idsWithDates;
      const messageCache = this._db.messageCache;
      const ids = [];
      for (let i = beginInclusive; i < endExclusive; i++) {
        const id = idsWithDates[i].id;
        ids.push(id);
        const haveData = alreadyKnownData.has(id);
        const haveOverlays = alreadyKnownOverlays.has(id);
        if (haveData && haveOverlays) {
          newKnownSet.add(id);
          continue;
        }
        if (haveData) {
          sendState.set(id, [null, overlayResolver(id)]);
        } else if (messageCache.has(id)) {
          newKnownSet.add(id);
          sendState.set(id, [
            messageCache.get(id),
            overlayResolver(id),
            idsWithDates[i].matchInfo
          ]);
        } else {
          const date = idsWithDates[i].date;
          needData.set([id, date], null);
        }
      }
      let readPromise = null;
      if (needData.size) {
        readPromise = this._db.read(this, {
          messages: needData
        });
      } else {
        needData = null;
      }
      return {
        ids,
        state: sendState,
        pendingReads: needData,
        readPromise,
        newValidDataSet: newKnownSet
      };
    }
  };

  // src/backend/db/toc_meta/sync_lifecycle.js
  function SyncLifecycle({
    folderId,
    syncStampSource,
    dataOverlayManager
  }) {
    this.folderId = folderId;
    this.syncStampSource = syncStampSource;
    this.newishIndexExclusive = 0;
    this.toc = null;
    this.firstTime = true;
    this.syncActive = false;
    this.dataOverlayManager = dataOverlayManager;
    this.resolveFolderOverlay = dataOverlayManager.makeBoundResolver("folders");
    this._bound_onIndexChange = this.onIndexChange.bind(this);
    this._bound_onOverlayChange = this.onOverlayChange.bind(this);
  }
  SyncLifecycle.prototype = {
    constructor: SyncLifecycle,
    activate(toc) {
      this.toc = toc;
      this.newIndex = 0;
      this.toc.on("_indexChange", this._bound_onIndexChange);
      this.dataOverlayManager.on("folders", this._bound_onOverlayChange);
      this.firstTime = true;
      this.syncActive = false;
      this.onOverlayChange(this.folderId);
    },
    deactivate() {
      this.toc.removeListener("_indexChange", this._bound_onIndexChange);
      this.dataOverlayManager.removeListener("folders", this._bound_onOverlayChange);
    },
    onIndexChange(oldIndex, newIndex) {
      if (newIndex === -1) {
        if (oldIndex < this.newishIndexExclusive) {
          this.newishIndexExclusive--;
        }
      } else if (newIndex <= this.newishIndexExclusive) {
        if (oldIndex === -1 || oldIndex >= this.newishIndexExclusive) {
          this.newishIndexExclusive++;
        }
      }
    },
    onOverlayChange(changedFolderId) {
      if (changedFolderId !== this.folderId) {
        return;
      }
      let overlays = this.resolveFolderOverlay(changedFolderId);
      let syncOverlay = overlays ? overlays.sync_refresh || overlays.sync_grow || {} : {};
      const reviseMeta = {};
      reviseMeta.syncStatus = syncOverlay.status || null;
      reviseMeta.syncBlocked = syncOverlay.blocked || null;
      let newSyncActive = !!syncOverlay.status;
      let syncFinished = this.syncActive && !newSyncActive;
      if (syncFinished || this.firstTime) {
        this.firstTime = false;
        const syncStampSource = this.syncStampSource.syncInfo || this.syncStampSource;
        reviseMeta.lastSuccessfulSyncAt = syncStampSource.lastSuccessfulSyncAt;
        reviseMeta.lastAttemptedSyncAt = syncStampSource.lastAttemptedSyncAt;
        this.toc.applyTOCMetaChanges(reviseMeta);
        if (syncFinished) {
          this.toc.broadcastEvent("syncComplete", {
            newishCount: this.newishIndexExclusive
          });
          this.newishIndexExclusive = 0;
        }
      } else {
        this.toc.applyTOCMetaChanges(reviseMeta);
      }
      this.syncActive = newSyncActive;
    }
  };

  // src/backend/task_infra/task_manager.js
  var import_evt9 = __toModule(require_evt());
  init_logic();

  // src/backend/task_infra/task_context.js
  init_logic();
  function TaskContext(taskThing, universe2) {
    this.id = taskThing.id;
    this._taskThing = taskThing;
    this.__taskInstance = null;
    this.isMarker = !!taskThing.type;
    this.isPlanning = this.isMarker ? false : taskThing.state === null;
    this.universe = universe2;
    logic.defineScope(this, "Task", {
      id: taskThing.id,
      taskType: this.taskType,
      accountId: this.accountId
    });
    this._stuffToRelease = [];
    this._preMutateStates = null;
    this._subtaskCounter = 0;
    this._decoratorCallbacks = [];
    this.state = "prep";
  }
  TaskContext.prototype = {
    get taskMode() {
      if (this.isPlannning) {
        return "planning";
      }
      return "executing";
    },
    get taskType() {
      if (this.isMarker) {
        return this._taskThing.type;
      }
      if (this.isPlanning) {
        return this._taskThing.rawTask.type;
      }
      return this._taskThing.plannedTask.type;
    },
    get accountId() {
      if (this.isMarker) {
        return this._taskThing.accountId || null;
      }
      if (this.isPlanning) {
        return this._taskThing.rawTask.accountId || null;
      }
      return this._taskThing.plannedTask.accountId || null;
    },
    get deviceOnline() {
      return this.universe.online;
    },
    get accountProblem() {
      return false;
    },
    get _taskManager() {
      return this.universe.taskManager;
    },
    get _taskRegistry() {
      return this.universe.taskRegistry;
    },
    get _taskGroupTracker() {
      return this.universe.taskGroupTracker;
    },
    acquire(acquireable) {
      this._stuffToRelease.push(acquireable);
      return acquireable.__acquire(this);
    },
    acquireAccountsTOC() {
      return this.universe.acquireAccountsTOC(this);
    },
    _releaseEverything() {
      for (let acquireable of this._stuffToRelease) {
        try {
          acquireable.__release(this);
        } catch (ex) {
          logic(this, "problemReleasing", {
            what: acquireable,
            ex,
            stack: ex && ex.stack
          });
        }
      }
    },
    synchronouslyConsultOtherTask(consultWhat, argDict) {
      return this._taskRegistry.__synchronouslyConsultOtherTask(this, consultWhat, argDict);
    },
    trackMeInTaskGroup(groupName) {
      return this._taskGroupTracker.ensureNamedTaskGroup(groupName, this.id);
    },
    get rootTaskGroupId() {
      let rootTaskGroup = this._taskGroupTracker.getRootTaskGroupForTask(this.id);
      if (rootTaskGroup) {
        return rootTaskGroup.groupId;
      }
      return null;
    },
    ensureRootTaskGroupFollowOnTask(taskToPlan) {
      this._taskGroupTracker.ensureRootTaskGroupFollowOnTask(this.id, taskToPlan);
    },
    setFailureTasks() {
    },
    heartbeat() {
      this._taskManager.__renewWakeLock();
    },
    broadcastOverBridges(name, data) {
      return this.universe.broadcastOverBridges(name, data);
    },
    announceUpdatedOverlayData(namespace, id) {
      this.universe.dataOverlayManager.announceUpdatedOverlayData(namespace, id);
    },
    read(what) {
      return this.universe.db.read(this, what);
    },
    readSingle(namespace, reqId, readbackId) {
      let readMap = new Map();
      readMap.set(reqId, null);
      let req = {
        [namespace]: readMap
      };
      return this.universe.db.read(this, req).then((results) => {
        return results[namespace].get(readbackId || reqId);
      });
    },
    mutateSingle(namespace, reqId, readbackId) {
      let readMap = new Map();
      readMap.set(reqId, null);
      let req = {
        [namespace]: readMap
      };
      return this.universe.db.beginMutate(this, req).then((results) => {
        return results[namespace].get(readbackId || reqId);
      });
    },
    beginMutate(what) {
      if (this.state !== "prep") {
        throw new Error("Cannot switch to mutate state from state: " + this.state);
      }
      this.state = "mutate";
      return this.universe.db.beginMutate(this, what);
    },
    spawnSubtask(subtaskFunc, argObj) {
      let subId = "sub:" + this.id + ":" + this._subtaskCounter++;
      let subThing = {
        id: subId,
        type: "subtask"
      };
      let subContext = new TaskContext(subThing, this.universe);
      return this._taskManager.__trackAndWrapSubtask(this, subContext, subtaskFunc, argObj);
    },
    spawnSimpleMutationSubtask({ namespace, id }, mutateFunc) {
      return this.spawnSubtask(this._simpleMutationSubtask, {
        mutateFunc,
        namespace,
        id
      });
    },
    async _simpleMutationSubtask(subctx, { mutateFunc, namespace, id }) {
      let obj = await subctx.mutateSingle(namespace, id);
      let writeObj = mutateFunc.call(this, obj);
      await subctx.finishTask({
        mutations: {
          [namespace]: new Map([[id, writeObj]])
        }
      });
      return writeObj;
    },
    flushedWriteRetainingLock() {
      throw new Error();
    },
    mutateMore(what) {
      if (this.state !== "mutate") {
        throw new Error("You should already be mutating, not in state: " + this.state);
      }
      return this.universe.db.beginMutate(this, what);
    },
    dangerousIncrementalWrite(mutations) {
      return this.universe.db.dangerousIncrementalWrite(this, mutations);
    },
    finishTask(finishData) {
      if (this.state === "finishing") {
        throw new Error("already finishing! did you put finishTask in a loop?");
      }
      this.state = "finishing";
      const taskManager = this.universe.taskManager;
      let revisedTaskInfo;
      if (!this.isMarker) {
        if (finishData.taskState) {
          this._taskThing.state = "planned";
          this._taskThing.plannedTask = finishData.taskState;
          revisedTaskInfo = {
            id: this.id,
            value: this._taskThing
          };
          taskManager.__queueTasksOrMarkers([this._taskThing], this.id, true);
        } else {
          revisedTaskInfo = {
            id: this.id,
            value: null
          };
        }
        if (this._taskThing.nonpersistent) {
          revisedTaskInfo = null;
        }
      }
      if (finishData.complexTaskState) {
        if (!finishData.mutations) {
          finishData.mutations = {};
        }
        finishData.mutations.complexTaskStates = new Map([
          [[this.accountId, this.taskType], finishData.complexTaskState]
        ]);
      }
      if (finishData.taskMarkers) {
        for (let [markerId, taskMarker] of finishData.taskMarkers) {
          if (taskMarker) {
            taskManager.__queueTasksOrMarkers([taskMarker], this.id, true);
          } else {
            taskManager.__removeTaskOrMarker(markerId, this.id);
          }
        }
      }
      let wrappedTasks = null;
      if (finishData.newData && finishData.newData.tasks) {
        wrappedTasks = taskManager.__wrapTasks(finishData.newData.tasks);
      }
      if (finishData.undoTasks) {
        taskManager.emit(`undoTasks:${this.id}`, finishData.undoTasks);
      }
      for (const decoratorCallback of this._decoratorCallbacks) {
        decoratorCallback(this, true, finishData);
      }
      return this.universe.db.finishMutate(this, finishData, {
        revisedTaskInfo,
        wrappedTasks
      }).then(() => {
        if (wrappedTasks) {
          taskManager.__enqueuePersistedTasksForPlanning(wrappedTasks, this.id);
        }
      });
    },
    returnValue(value) {
      return { wrappedResult: value };
    },
    __failsafeFinalize(err) {
      if (this.state === "finishing") {
        return;
      }
      logic(this, "failsafeFinalize", { err });
      for (const decoratorCallback of this._decoratorCallbacks) {
        try {
          decoratorCallback(this, false, null);
        } catch (ex) {
          logic(this, "decoratorFailsafeFail", { ex });
        }
      }
      this._decoratorCallbacks = [];
      this.finishTask({});
    },
    __decorateFinish(callback) {
      this._decoratorCallbacks.push(callback);
    }
  };

  // src/backend/task_infra/task_manager.js
  var TaskManager = class extends import_evt9.Emitter {
    constructor({
      universe: universe2,
      db,
      taskRegistry,
      taskResources,
      taskPriorities,
      accountManager
    }) {
      super();
      logic.defineScope(this, "TaskManager");
      this._universe = universe2;
      this._db = db;
      this._registry = taskRegistry;
      this._resources = taskResources;
      this._priorities = taskPriorities;
      this._accountManager = accountManager;
      this._accountsTOC = accountManager.accountsTOC;
      const idBase = Date.now() - 14e11;
      if (idBase < 0) {
        throw new Error("clock is bad, correctness compromised, giving up.");
      }
      this._nextId = idBase * 100;
      this._tasksToPlan = [];
      this._pendingPlanWrites = 0;
      this._activePromise = Promise.resolve(null);
      this._activeWakeLock = null;
    }
    async __restoreFromDB() {
      const { wrappedTasks, complexTaskStates } = await this._db.loadTasks();
      logic(this, "restoreFromDB", { count: wrappedTasks.length });
      for (const wrappedTask of wrappedTasks) {
        if (wrappedTask.state === null) {
          this._tasksToPlan.push(wrappedTask);
        } else {
          this.__queueTasksOrMarkers([wrappedTask], "restored:simple", true);
        }
      }
      const pendingInitPromises = [];
      this._registry.initializeFromDatabaseState(complexTaskStates);
      pendingInitPromises.push(this._registry.initGlobalTasks().then((markers) => {
        this.__queueTasksOrMarkers(markers, "restored:complex", true);
      }));
      this._accountsTOC.getAllItems().forEach((accountInfo) => {
        const foldersTOC = this._accountManager.accountFoldersTOCs.get(accountInfo.id);
        pendingInitPromises.push(this._registry.accountExistsInitTasks(accountInfo.id, accountInfo.engine, accountInfo, foldersTOC).then((markers) => {
          this.__queueTasksOrMarkers(markers, "restored:complex", true);
        }));
      });
      this._accountsTOC.on("add", (accountInfo) => {
        const foldersTOC = this._accountManager.accountFoldersTOCs.get(accountInfo.id);
        this._registry.accountExistsInitTasks(accountInfo.id, accountInfo.engine, accountInfo, foldersTOC).then((markers) => {
          this.__queueTasksOrMarkers(markers, "restored:complex", true);
        });
      });
      this._accountsTOC.on("remove", (accountInfo) => {
        this._registry.accountRemoved(accountInfo.id);
      });
      Promise.all(pendingInitPromises).then(() => {
        this._activePromise = null;
        logic(this, "starting", {
          numTasksToPlan: this._tasksToPlan.length,
          numPrioritizedTasks: this._priorities.numTasksToExecute
        });
        this._maybeDoStuff();
      });
    }
    _ensureWakeLock(why) {
      if (!this._activeWakeLock) {
        logic(this, "ensureWakeLock", { why });
        this._activeWakeLock = new SmartWakeLock({ locks: ["cpu"] });
      } else {
        this._activeWakeLock.renew("TaskManager:ensure");
      }
    }
    __renewWakeLock() {
      if (this._activeWakeLock) {
        this._activeWakeLock.renew("TaskManager:explicit");
      } else {
        logic.fail("explicit renew propagated without a wakelock?");
      }
    }
    _releaseWakeLock() {
      if (this._activeWakeLock) {
        this._activeWakeLock.unlock("TaskManager:release");
        this._activeWakeLock = null;
      }
    }
    async scheduleTasks(rawTasks, why) {
      this._ensureWakeLock(why);
      const wrappedTasks = this.__wrapTasks(rawTasks);
      logic(this, "schedulePersistent", { why, tasks: wrappedTasks });
      this._pendingPlanWrites++;
      await this._db.addTasks(wrappedTasks);
      this._pendingPlanWrites--;
      this.__enqueuePersistedTasksForPlanning(wrappedTasks);
      return wrappedTasks.map((x) => x.id);
    }
    async waitForTasksToBePlanned(taskIds, flattenSingleResult = false) {
      let results = await Promise.all(taskIds.map((taskId) => {
        return this.promisedOnce("planned:" + taskId);
      }));
      if (flattenSingleResult && results.length === 1) {
        results = results[0];
      }
      return results;
    }
    async scheduleTaskAndWaitForPlannedResult(rawTask, why) {
      const taskIds = await this.scheduleTasks([rawTask], why);
      return this.waitForTasksToBePlanned(taskIds, true);
    }
    scheduleTaskAndWaitForPlannedUndoTasks(rawTask, why) {
      return this.scheduleTasks([rawTask], why).then(([taskId]) => {
        return new Promise((resolve) => {
          const undoHandler = (undoTasks) => {
            resolve(undoTasks);
          };
          const ensureCleanup = () => {
            this.removeListener(`undoTasks:${taskId}`, undoHandler);
            resolve([]);
          };
          this.on(`undoTasks:${taskId}`, undoHandler);
          this.once(`planned:${taskId}`, ensureCleanup);
        });
      });
    }
    async scheduleTaskAndWaitForExecutedResult(rawTask, why) {
      const taskIds = await this.scheduleTasks([rawTask], why);
      return this.waitForTasksToBeExecuted(taskIds, true);
    }
    async waitForTasksToBeExecuted(taskIds, flattenSingleResult = false) {
      let results = await Promise.all(taskIds.map((taskId) => {
        return this.promisedOnce("executed:" + taskId);
      }));
      if (flattenSingleResult && results.length === 1) {
        results = results[0];
      }
      return results;
    }
    scheduleNonPersistentTasks(rawTasks, why) {
      this._ensureWakeLock(why);
      const wrappedTasks = this.__wrapTasks(rawTasks);
      logic(this, "scheduleNonPersistent", { why, tasks: wrappedTasks });
      wrappedTasks.forEach((wrapped) => {
        wrapped.nonpersistent = true;
      });
      this.__enqueuePersistedTasksForPlanning(wrappedTasks);
      return Promise.resolve(wrappedTasks.map((x) => x.id));
    }
    async scheduleNonPersistentTaskAndWaitForPlannedResult(rawTask, why) {
      const taskIds = await this.scheduleNonPersistentTasks([rawTask], why);
      return this.waitForTasksToBePlanned(taskIds, true);
    }
    async scheduleNonPersistentTaskAndWaitForExecutedResult(rawTask, why) {
      const taskIds = await this.scheduleNonPersistentTasks([rawTask], why);
      return this.waitForTasksToBeExecuted(taskIds, true);
    }
    __wrapTasks(rawTasks) {
      return rawTasks.map((rawTask) => {
        return {
          id: this._nextId++,
          rawTask,
          state: null
        };
      });
    }
    __enqueuePersistedTasksForPlanning(wrappedTasks, sourceId) {
      this._ensureWakeLock();
      for (const wrappedTask of wrappedTasks) {
        this.emit("willPlan", wrappedTask, sourceId);
      }
      this._tasksToPlan.splice(this._tasksToPlan.length, 0, ...wrappedTasks);
      this._maybeDoStuff();
    }
    __queueTasksOrMarkers(taskThings, sourceId, noTrigger) {
      let prioritized = 0;
      for (const taskThing of taskThings) {
        logic(this, "queueing", { taskThing, sourceId });
        this.emit("willExecute", taskThing, sourceId);
        if (this._resources.ownOrRelayTaskThing(taskThing)) {
          prioritized++;
        }
      }
      if (prioritized && !noTrigger && !this._activePromise) {
        Promise.resolve().then(() => {
          this._maybeDoStuff();
        });
      }
    }
    __removeTaskOrMarker(taskId) {
      logic(this, "removing", { taskId });
      this._resources.removeTaskThing(taskId);
    }
    _maybeDoStuff() {
      if (this._activePromise) {
        return;
      }
      if (this._tasksToPlan.length) {
        this._activePromise = this._planNextTask();
      } else if (!this._priorities.hasTasksToExecute()) {
        this._activePromise = this._executeNextTask();
      } else {
        logic(this, "nothingToDo");
        if (this._pendingPlanWrites === 0) {
          this.emit("taskQueueEmpty");
        }
        this._releaseWakeLock();
        return;
      }
      if (!this._activePromise) {
        if (this._tasksToPlan.length || !this._priorities.hasTasksToExecute()) {
          setTimeout(() => {
            this._maybeDoStuff();
          }, 0);
        }
        return;
      }
      this._activePromise.then(() => {
        this._activePromise = null;
        this._maybeDoStuff();
      }, (error) => {
        this._activePromise = null;
        logic(this, "taskError", { error, stack: error.stack });
        this._maybeDoStuff();
      });
    }
    _planNextTask() {
      const wrappedTask = this._tasksToPlan.shift();
      logic(this, "planning:begin", { task: wrappedTask });
      const ctx = new TaskContext(wrappedTask, this._universe);
      const planResult = this._registry.planTask(ctx, wrappedTask);
      if (planResult) {
        planResult.then((maybeResult) => {
          const result = maybeResult && maybeResult.wrappedResult || void 0;
          logic(this, "planning:end", {
            success: true,
            task: wrappedTask,
            _result: result
          });
          this.emit("planned:" + wrappedTask.id, result);
          this.emit("planned", wrappedTask.id, result);
        }, (err) => {
          logic(this, "planning:end", {
            success: false,
            err,
            task: wrappedTask
          });
          this.emit("planned:" + wrappedTask.id, null);
          this.emit("planned", wrappedTask.id, null);
        });
      } else {
        logic(this, "planning:end", { moot: true, task: wrappedTask });
        this.emit("planned:" + wrappedTask.id, void 0);
        this.emit("planned", wrappedTask.id, void 0);
      }
      return planResult;
    }
    _executeNextTask() {
      const taskThing = this._priorities.popNextAvailableTask();
      logic(this, "executing:begin", { task: taskThing });
      const ctx = new TaskContext(taskThing, this._universe);
      const execResult = this._registry.executeTask(ctx, taskThing);
      if (execResult) {
        execResult.then((maybeResult) => {
          const result = maybeResult && maybeResult.wrappedResult || void 0;
          logic(this, "executing:end", {
            success: true,
            task: taskThing,
            _result: result
          });
          this.emit("executed:" + taskThing.id, result);
          this.emit("executed", taskThing.id, result);
        }, (err) => {
          logic(this, "executing:end", {
            success: false,
            err,
            task: taskThing
          });
          this.emit("executed:" + taskThing.id, null);
          this.emit("executed", taskThing.id, null);
        });
      } else {
        logic(this, "executing:end", { moot: true, task: taskThing });
        this.emit("executed:" + taskThing.id, void 0);
        this.emit("executed", taskThing.id, void 0);
      }
      return execResult;
    }
    __trackAndWrapSubtask(ctx, subctx, subtaskFunc, subtaskArg) {
      logic(this, "subtask:begin", { taskId: ctx.id, subtaskId: subctx.id });
      const subtaskResult = subtaskFunc.call(subctx.__taskInstance, subctx, subtaskArg);
      return subtaskResult.then((result) => {
        logic(this, "subtask:end", { taskId: ctx.id, subtaskId: subctx.id });
        return result;
      });
    }
  };

  // src/backend/task_infra/task_registry.js
  init_logic();
  function TaskRegistry({
    dataOverlayManager,
    triggerManager,
    taskResources
  }) {
    logic.defineScope(this, "TaskRegistry");
    this._dataOverlayManager = dataOverlayManager;
    this._triggerManager = triggerManager;
    this._taskResources = taskResources;
    this._globalTasks = new Map();
    this._globalTaskRegistry = new Map();
    this._perAccountTypeTasks = new Map();
    this._perAccountIdTaskRegistry = new Map();
    this._perAccountTypeTasks.set(null, this._globalTasks);
    this._perAccountIdTaskRegistry.set(null, this._globalTaskRegistry);
    this._dbDataByAccount = new Map();
  }
  TaskRegistry.prototype = {
    registerGlobalTasks(taskImpls) {
      for (let taskImpl of taskImpls) {
        this._globalTasks.set(taskImpl.name, taskImpl);
      }
    },
    isAccountTypeKnown(accountType) {
      return this._perAccountTypeTasks.has(accountType);
    },
    registerPerAccountTypeTasks(accountType, taskImpls) {
      let perTypeTasks = this._perAccountTypeTasks.get(accountType);
      if (!perTypeTasks) {
        perTypeTasks = new Map();
        this._perAccountTypeTasks.set(accountType, perTypeTasks);
      }
      for (let taskImpl of taskImpls) {
        perTypeTasks.set(taskImpl.name, taskImpl);
      }
    },
    initializeFromDatabaseState([stateKeys, stateValues]) {
      if (stateKeys.length !== stateValues.length) {
        throw new Error("impossible complex state inconsistency issue");
      }
      for (let i = 0; i < stateKeys.length; i++) {
        let [accountId, taskType, taskKey] = stateKeys[i];
        let value = stateValues[i];
        let dataByTaskType = this._dbDataByAccount.get(accountId);
        if (!dataByTaskType) {
          dataByTaskType = new Map();
          this._dbDataByAccount.set(accountId, dataByTaskType);
        }
        if (taskKey !== void 0) {
          let map = dataByTaskType.get(taskType);
          if (!map) {
            map = new Map();
            dataByTaskType.set(taskType, map);
          }
          map.set(taskKey, value);
        } else {
          dataByTaskType.set(taskType, value);
        }
      }
    },
    _registerComplexTaskImplWithEventSources(accountId, meta) {
      let taskImpl = meta.impl;
      let blockedTaskChecker = this._taskResources.whatIsTaskBlockedBy.bind(this._taskResources);
      for (let key of Object.keys(taskImpl)) {
        let overlayMatch = /^overlay_(.+)$/.exec(key);
        if (overlayMatch) {
          logic(this, "registerOverlayProvider", {
            accountId,
            taskName: taskImpl.name,
            overlayType: overlayMatch[1]
          });
          this._dataOverlayManager.registerProvider(overlayMatch[1], taskImpl.name, taskImpl[key].bind(taskImpl, meta.persistentState, meta.memoryState, blockedTaskChecker));
        }
        let triggerMatch = /^trigger_(.+$)$/.exec(key);
        if (triggerMatch) {
          logic(this, "registerTriggerHandler", {
            accountId,
            taskName: taskImpl.name,
            trigger: triggerMatch[1]
          });
          this._triggerManager.registerTriggerFunc(triggerMatch[1], taskImpl.name, taskImpl[key].bind(taskImpl, meta.persistentState, meta.memoryState));
        }
      }
    },
    initGlobalTasks() {
      return this.accountExistsInitTasks(null, null, null, null);
    },
    accountExistsInitTasks(accountId, accountType, accountInfo, foldersTOC) {
      logic(this, "accountExistsInitTasks:begin", { accountId, accountType });
      let taskImpls = this._perAccountTypeTasks.get(accountType);
      if (!taskImpls) {
        logic(this, "noPerAccountTypeTasks", { accountId, accountType });
      }
      let accountMarkers = [];
      let pendingPromises = [];
      let dataByTaskType = this._dbDataByAccount.get(accountId);
      if (!dataByTaskType) {
        dataByTaskType = new Map();
      }
      let taskMetas = this._perAccountIdTaskRegistry.get(accountId);
      if (!taskMetas) {
        taskMetas = new Map();
        this._perAccountIdTaskRegistry.set(accountId, taskMetas);
      }
      let simpleCount = 0;
      let complexCount = 0;
      for (let unlatchedTaskImpl of taskImpls.values()) {
        let taskImpl = unlatchedTaskImpl;
        let taskType = taskImpl.name;
        let meta = {
          impl: taskImpl,
          persistentState: dataByTaskType.get(taskType),
          memoryState: null
        };
        if (taskImpl.isComplex) {
          complexCount++;
          logic(this, "initializingComplexTask", {
            accountId,
            taskType,
            hasPersistentState: !!meta.persistentState
          });
          if (!meta.persistentState) {
            meta.persistentState = taskImpl.initPersistentState();
          }
          let maybePromise = taskImpl.deriveMemoryStateFromPersistentState(meta.persistentState, accountId, accountInfo, foldersTOC);
          let saveOffMemoryState = ({ memoryState, markers }) => {
            meta.memoryState = memoryState;
            if (markers) {
              accountMarkers.push(...markers);
            }
            this._registerComplexTaskImplWithEventSources(accountId, meta);
          };
          if (maybePromise.then) {
            pendingPromises.push(maybePromise.then(saveOffMemoryState));
          } else {
            saveOffMemoryState(maybePromise);
          }
        } else {
          simpleCount++;
        }
        taskMetas.set(taskType, meta);
      }
      return Promise.all(pendingPromises).then(() => {
        logic(this, "accountExistsInitTasks:end", {
          accountId,
          accountType,
          simpleCount,
          complexCount,
          markerCount: accountMarkers.length
        });
        return accountMarkers;
      });
    },
    accountRemoved() {
    },
    _forceFinalize(ctx, maybePromiseResult) {
      if (maybePromiseResult.then) {
        const successFinalize = () => {
          ctx.__failsafeFinalize();
        };
        const failureFinalize = (err) => {
          ctx.__failsafeFinalize(err);
        };
        maybePromiseResult.then(successFinalize, failureFinalize);
      } else {
        ctx.__failsafeFinalize();
      }
    },
    planTask(ctx, wrappedTask) {
      let rawTask = wrappedTask.rawTask;
      let taskType = rawTask.type;
      let taskMeta;
      if (this._globalTaskRegistry.has(taskType)) {
        taskMeta = this._globalTaskRegistry.get(taskType);
      } else {
        let accountId = rawTask.accountId;
        let perAccountTasks = this._perAccountIdTaskRegistry.get(accountId);
        if (!perAccountTasks) {
          logic(this, "noSuchAccount", {
            taskType,
            accountId,
            knownAccounts: Array.from(this._perAccountIdTaskRegistry.keys())
          });
          return null;
        }
        taskMeta = perAccountTasks.get(taskType);
        if (!taskMeta) {
          logic(this, "noSuchTaskProvider", { taskType, accountId });
          return null;
        }
      }
      ctx.__taskInstance = taskMeta.impl;
      let maybePromiseResult;
      try {
        if (taskMeta.impl.isComplex) {
          maybePromiseResult = taskMeta.impl.plan(ctx, taskMeta.persistentState, taskMeta.memoryState, rawTask);
        } else {
          return taskMeta.impl.plan(ctx, rawTask);
        }
      } catch (ex) {
        logic.fail(ex);
      }
      this._forceFinalize(ctx, maybePromiseResult);
      return maybePromiseResult;
    },
    executeTask(ctx, taskThing) {
      let isMarker = !!taskThing.type;
      let taskType = isMarker ? taskThing.type : taskThing.plannedTask.type;
      let taskMeta;
      if (this._globalTaskRegistry.has(taskType)) {
        taskMeta = this._globalTaskRegistry.get(taskType);
      } else {
        let accountId = isMarker ? taskThing.accountId : taskThing.plannedTask.accountId;
        taskMeta = this._perAccountIdTaskRegistry.get(accountId).get(taskType);
      }
      if (!taskMeta.impl.execute) {
        return Promise.resolve();
      }
      if (isMarker !== taskMeta.impl.isComplex) {
        throw new Error("Trying to exec " + taskType + " but isComplex:" + taskMeta.impl.isComplex);
      }
      ctx.__taskInstance = taskMeta.impl;
      let maybePromiseResult;
      if (isMarker) {
        maybePromiseResult = taskMeta.impl.execute(ctx, taskMeta.persistentState, taskMeta.memoryState, taskThing);
      } else {
        maybePromiseResult = taskMeta.impl.execute(ctx, taskThing.plannedTask);
      }
      this._forceFinalize(ctx, maybePromiseResult);
      return maybePromiseResult;
    },
    __synchronouslyConsultOtherTask(ctx, consultWhat, argDict) {
      let taskType = consultWhat.name;
      let taskMeta;
      if (this._globalTaskRegistry.has(taskType)) {
        taskMeta = this._globalTaskRegistry.get(taskType);
      } else {
        let accountId = consultWhat.accountId;
        taskMeta = this._perAccountIdTaskRegistry.get(accountId).get(taskType);
      }
      if (!taskMeta.impl.consult) {
        throw new Error("implementation has no consult method");
      }
      return taskMeta.impl.consult(ctx, taskMeta.persistentState, taskMeta.memoryState, argDict);
    }
  };

  // src/backend/task_infra/task_priorities.js
  init_logic();
  var import_fibonacci_heap = __toModule(require_fibonacci_heap());
  function TaskPriorities() {
    logic.defineScope(this, "TaskPriorities");
    this._prioritizedTasks = new import_fibonacci_heap.default();
    this._taskIdToHeapNode = new Map();
    this._priorityTagToHeapNodes = new Map();
    this._priorityTagsByOwner = new Map();
    this._summedPriorityTags = new Map();
  }
  TaskPriorities.prototype = {
    hasTasksToExecute() {
      return this._prioritizedTasks.isEmpty();
    },
    get numTasksToExecute() {
      return this._prioritizedTasks.nodeCount;
    },
    popNextAvailableTask() {
      let priorityNode = this._prioritizedTasks.extractMinimum();
      if (!priorityNode) {
        return null;
      }
      let taskThing = priorityNode.value;
      this._taskIdToHeapNode.delete(taskThing.id);
      this._cleanupTaskPriorityTracking(taskThing, priorityNode);
      return taskThing;
    },
    _computePriorityForTags(priorityTags) {
      let summedPriorityTags = this._summedPriorityTags;
      let priority = 0;
      if (priorityTags) {
        for (let priorityTag of priorityTags) {
          priority += summedPriorityTags.get(priorityTag) || 0;
        }
      }
      return priority;
    },
    setPriorityBoostTags(owningId, tagsWithValues) {
      let existingValues = this._priorityTagsByOwner.get(owningId) || new Map();
      let newValues = tagsWithValues || new Map();
      let perThingDeltas = new Map();
      let summedPriorityTags = this._summedPriorityTags;
      let priorityTagToHeapNodes = this._priorityTagToHeapNodes;
      if (tagsWithValues) {
        this._priorityTagsByOwner.set(owningId, tagsWithValues);
      } else {
        this._priorityTagsByOwner.delete(owningId);
      }
      let applyDelta = (priorityTag, delta) => {
        let newSum = (summedPriorityTags.get(priorityTag) || 0) + delta;
        if (newSum) {
          summedPriorityTags.set(priorityTag, newSum);
        } else {
          summedPriorityTags.delete(priorityTag);
        }
        let nodes = priorityTagToHeapNodes.get(priorityTag);
        if (nodes) {
          for (let node of nodes) {
            let aggregateDelta = (perThingDeltas.get(node) || 0) + delta;
            perThingDeltas.set(node, aggregateDelta);
          }
        }
      };
      for (let [priorityTag, newPriority] of newValues.entries()) {
        let oldPriority = existingValues.get(priorityTag) || 0;
        let priorityDelta = newPriority - oldPriority;
        applyDelta(priorityTag, priorityDelta);
      }
      for (let [priorityTag, oldPriority] of existingValues.entries()) {
        if (newValues.has(priorityTag)) {
          continue;
        }
        applyDelta(priorityTag, -oldPriority);
      }
      for (let [node, aggregateDelta] of perThingDeltas.values()) {
        let newKey = node.key - aggregateDelta;
        this._reprioritizeHeapNode(node, newKey);
      }
    },
    _reprioritizeHeapNode(node, newKey) {
      let prioritizedTasks = this._prioritizedTasks;
      if (newKey < node.key) {
        prioritizedTasks.decreaseKey(node, newKey);
      } else if (newKey > node.key) {
        let taskThing = node.value;
        prioritizedTasks.delete(node);
        prioritizedTasks.insert(newKey, taskThing);
      }
    },
    prioritizeTaskThing(taskThing) {
      let isMarker = !!taskThing.type;
      let priorityTags = isMarker ? taskThing.priorityTags : taskThing.plannedTask.priorityTags;
      let relPriority = (isMarker ? taskThing.relPriority : taskThing.plannedTask.relPriority) || 0;
      let priority = relPriority + this._computePriorityForTags(priorityTags);
      let nodeKey = -priority;
      let priorityNode = this._taskIdToHeapNode.get(taskThing.id);
      if (priorityNode) {
        this._reprioritizeHeapNode(priorityNode, nodeKey);
        let oldTaskThing = priorityNode.value;
        this._cleanupTaskPriorityTracking(oldTaskThing);
        priorityNode.value = taskThing;
      } else {
        priorityNode = this._prioritizedTasks.insert(nodeKey, taskThing);
        this._taskIdToHeapNode.set(taskThing.id, priorityNode);
      }
      this._setupTaskPriorityTracking(taskThing, priorityNode);
    },
    _setupTaskPriorityTracking(taskThing, priorityNode) {
      let isTask = !taskThing.type;
      let priorityTags = isTask ? taskThing.plannedTask.priorityTags : taskThing.priorityTags;
      let priorityTagToHeapNodes = this._priorityTagToHeapNodes;
      if (priorityTags) {
        for (let priorityTag of priorityTags) {
          let nodes = priorityTagToHeapNodes.get(priorityTag);
          if (nodes) {
            nodes.push(priorityNode);
          } else {
            priorityTagToHeapNodes.set(priorityTag, [priorityNode]);
          }
        }
      }
    },
    _cleanupTaskPriorityTracking(taskThing, priorityNode) {
      let isTask = !taskThing.type;
      let priorityTags = isTask ? taskThing.plannedTask.priorityTags : taskThing.priorityTags;
      let priorityTagToHeapNodes = this._priorityTagToHeapNodes;
      if (priorityTags) {
        for (let priorityTag of priorityTags) {
          let nodes = priorityTagToHeapNodes.get(priorityTag);
          if (nodes) {
            let idx = nodes.indexOf(priorityNode);
            if (idx !== -1) {
              nodes.splice(idx, 1);
            }
            if (nodes.length === 0) {
              priorityTagToHeapNodes.delete(priorityTag);
            }
          }
        }
      }
    },
    removeTaskThing(taskId, priorityNode) {
      if (!priorityNode) {
        priorityNode = this._taskIdToHeapNode.get(taskId);
      }
      if (priorityNode) {
        let taskThing = priorityNode.value;
        this._prioritizedTasks.delete(priorityNode);
        this._taskIdToHeapNode.delete(taskId);
        this._cleanupTaskPriorityTracking(taskThing, priorityNode);
      }
    },
    removeTasksUsingFilter(shouldRemove) {
      for (let priorityNode of this._taskIdToHeapNode.values()) {
        const taskThing = priorityNode.value;
        if (shouldRemove(taskThing)) {
          this.removeTaskThing(taskThing.id, priorityNode);
        }
      }
    }
  };

  // src/backend/task_infra/task_resources.js
  init_logic();
  function TaskResources(priorities) {
    logic.defineScope(this, "TaskResources");
    this._priorities = priorities;
    this._availableResources = new Set();
    this._blockedTasksByResource = new Map();
    this._blockedTasksById = new Map();
    this._resourceTimeouts = new Map();
  }
  TaskResources.prototype = {
    resourceAvailable(resourceId) {
      if (this._availableResources.has(resourceId)) {
        logic(this, "resourceAlreadyAvailable", { resourceId });
        return 0;
      }
      logic(this, "resourceAvailable", { resourceId });
      this._availableResources.add(resourceId);
      this._clearResourceTimeouts(resourceId);
      if (!this._blockedTasksByResource.has(resourceId)) {
        return 0;
      }
      let taskThings = this._blockedTasksByResource.get(resourceId);
      this._blockedTasksByResource.delete(resourceId);
      let prioritized = 0;
      for (let taskThing of taskThings) {
        this._blockedTasksById.delete(taskThing.id);
        if (this.ownOrRelayTaskThing(taskThing)) {
          prioritized++;
        }
      }
      return prioritized;
    },
    resourcesNoLongerAvailable(removedResourceIds) {
      let removedCount = 0;
      for (let removedResourceId of removedResourceIds) {
        if (this._availableResources.has(removedResourceId)) {
          this._availableResources.delete(removedResourceId);
          removedCount++;
        }
      }
      if (removedCount === 0) {
        logic(this, "resourcesAlreadyUnavailable", { removedResourceIds });
        return;
      }
      logic(this, "resourcesNoLongerAvailable", { removedResourceIds });
      const nowBlocked = [];
      this._priorities.removeTasksUsingFilter((taskThing) => {
        if (taskThing.resources) {
          for (let resourceId of taskThing.resources) {
            if (removedResourceIds.includes(resourceId)) {
              nowBlocked.push(taskThing);
              return true;
            }
          }
        }
        return false;
      });
      for (let taskThing of nowBlocked) {
        this.ownOrRelayTaskThing(taskThing);
      }
    },
    _clearResourceTimeouts(resourceId) {
      if (this._resourceTimeouts.has(resourceId)) {
        clearTimeout(this._resourceTimeouts.get(resourceId));
        this._resourceTimeouts.delete(resourceId);
      }
    },
    restoreResourceAfterTimeout(resourceId, timeoutMillis) {
      this._clearResourceTimeouts();
      let timeoutId = setTimeout(() => {
        this.resourceAvailable(resourceId);
      }, timeoutMillis);
      this._resourceTimeouts.set(resourceId, timeoutId);
    },
    whatIsTaskBlockedBy(taskId) {
      const taskThing = this._blockedTasksById.get(taskId);
      if (!taskThing) {
        return null;
      }
      const blockedBy = [];
      for (let resource of taskThing.resources) {
        if (!this._availableResources.has(resource)) {
          blockedBy.push(resource);
        }
      }
      return blockedBy;
    },
    ownOrRelayTaskThing(taskThing) {
      if (this._blockedTasksById.has(taskThing.id)) {
        this.removeTaskThing(taskThing.id);
      }
      if (taskThing.resources) {
        for (let resourceId of taskThing.resources) {
          if (!this._availableResources.has(resourceId)) {
            this._priorities.removeTaskThing(taskThing.id);
            logic(this, "taskBlockedOnResource", {
              taskId: taskThing.id,
              resourceId
            });
            this._blockedTasksById.set(taskThing.id, taskThing);
            if (this._blockedTasksByResource.has(resourceId)) {
              this._blockedTasksByResource.get(resourceId).push(taskThing);
            } else {
              this._blockedTasksByResource.set(resourceId, [taskThing]);
            }
            return false;
          }
        }
      }
      this._priorities.prioritizeTaskThing(taskThing);
      return true;
    },
    removeTaskThing(taskId) {
      if (!this._blockedTasksById.has(taskId)) {
        this._priorities.removeTaskThing(taskId);
        return;
      }
      let taskThing = this._blockedTasksById.get(taskId);
      this._blockedTasksById.delete(taskId);
      for (let [resourceId, blockedThings] of this._blockedTasksByResource) {
        let idx = blockedThings.indexOf(taskThing);
        if (idx === -1) {
          continue;
        }
        blockedThings.splice(idx, 1);
        if (blockedThings.length === 0) {
          this._blockedTasksByResource.delete(resourceId);
        }
        break;
      }
    }
  };

  // src/backend/task_infra/task_group_tracker.js
  var import_evt10 = __toModule(require_evt());
  init_logic();
  var TaskGroupTracker = class extends import_evt10.Emitter {
    constructor(taskManager) {
      super();
      logic.defineScope(this, "TaskGroupTracker");
      this.taskManager = taskManager;
      this._nextGroupId = 1;
      this._groupsByName = new Map();
      this._taskIdsToGroups = new Map();
      this._pendingTaskIdReuses = new Set();
      this.__registerListeners(taskManager);
    }
    __registerListeners(emitter) {
      emitter.on("willPlan", this, this._onWillPlan);
      emitter.on("willExecute", this, this._onWillExecute);
      emitter.on("planned", this, this._onPlanned);
      emitter.on("executed", this, this._onExecuted);
    }
    _ensureNamedTaskGroup(groupName, taskId) {
      let group = this._groupsByName.get(groupName);
      if (!group) {
        group = this._makeTaskGroup(groupName);
        logic(this, "createGroup", { groupName, taskId });
      } else {
        logic(this, "reuseGroup", { groupName, taskId });
      }
      let existingOwningGroup = this._taskIdsToGroups.get(taskId) || null;
      if (existingOwningGroup !== group) {
        group.parentGroup = existingOwningGroup;
      }
      group.pendingCount++;
      group.totalCount++;
      this._taskIdsToGroups.set(taskId, group);
      return group;
    }
    ensureNamedTaskGroup(groupName, taskId) {
      let group = this._ensureNamedTaskGroup(groupName, taskId);
      return group.promise;
    }
    getRootTaskGroupForTask(taskId) {
      let taskGroup = this._taskIdsToGroups.get(taskId);
      if (!taskGroup) {
        return taskGroup;
      }
      while (taskGroup.parentGroup !== null) {
        taskGroup = taskGroup.parentGroup;
      }
      return taskGroup;
    }
    ensureRootTaskGroupFollowOnTask(taskId, taskToPlan) {
      let rootTaskGroup = this.getRootTaskGroupForTask(taskId);
      if (!rootTaskGroup) {
        rootTaskGroup = this._ensureNamedTaskGroup("ensured:" + this._nextGroupId, taskId);
      }
      if (!rootTaskGroup.tasksToScheduleOnCompletion) {
        rootTaskGroup.tasksToScheduleOnCompletion = new Set();
      }
      rootTaskGroup.tasksToScheduleOnCompletion.add(taskToPlan);
    }
    _makeTaskGroup(groupName) {
      let group = {
        groupName,
        groupId: this._nextGroupId++,
        pendingCount: 0,
        totalCount: 0,
        parentGroup: null,
        promise: null,
        resolve: null,
        tasksToScheduleOnCompletion: null
      };
      group.promise = new Promise((resolve) => {
        group.resolve = resolve;
      });
      this._groupsByName.set(groupName, group);
      return group;
    }
    _onWillPlan(taskThing, sourceId) {
      if (!sourceId) {
        return;
      }
      let sourceGroup = this._taskIdsToGroups.get(sourceId);
      if (sourceGroup) {
        sourceGroup.pendingCount++;
        sourceGroup.totalCount++;
        this._taskIdsToGroups.set(taskThing.id, sourceGroup);
      }
    }
    _onWillExecute(taskThing, sourceId) {
      if (!sourceId) {
        return;
      }
      let sourceGroup = this._taskIdsToGroups.get(sourceId);
      if (sourceGroup) {
        if (sourceId === taskThing.id) {
          this._pendingTaskIdReuses.add(sourceId);
        } else {
          sourceGroup.pendingCount++;
        }
        sourceGroup.totalCount++;
        this._taskIdsToGroups.set(taskThing.id, sourceGroup);
      }
    }
    _decrementGroupPendingCount(group) {
      if (--group.pendingCount === 0) {
        logic(this, "resolveGroup", {
          groupName: group.groupName,
          totalCount: group.totalCount
        });
        group.resolve();
        this._groupsByName.delete(group.groupName);
        if (group.tasksToScheduleOnCompletion) {
          this.taskManager.scheduleTasks(Array.from(group.tasksToScheduleOnCompletion), "deferred-group:" + group.groupName);
        }
        if (group.parentGroup) {
          this._decrementGroupPendingCount(group.parentGroup);
        } else {
          this.emit("rootTaskGroupCompleted", { group });
        }
      }
    }
    _onPlanned(taskId) {
      if (this._pendingTaskIdReuses.has(taskId)) {
        this._pendingTaskIdReuses.delete(taskId);
        return;
      }
      let group = this._taskIdsToGroups.get(taskId);
      if (group) {
        this._taskIdsToGroups.delete(taskId);
        this._decrementGroupPendingCount(group);
      }
    }
    _onExecuted(taskId) {
      let group = this._taskIdsToGroups.get(taskId);
      if (group) {
        this._taskIdsToGroups.delete(taskId);
        this._decrementGroupPendingCount(group);
      } else {
        this.emit("rootTaskGroupCompleted", { taskId });
      }
    }
  };

  // src/backend/search/query_manager.js
  init_logic();

  // src/backend/search/query/direct_folder_conv_query.js
  function DirectFolderConversationsQuery({ db, folderId }) {
    this._db = db;
    this.folderId = folderId;
    this._eventId = null;
    this._drainEvents = null;
    this._boundListener = null;
  }
  DirectFolderConversationsQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        eventId: this._eventId
      } = await this._db.loadFolderConversationIdsAndListen(this.folderId));
      return idsWithDates;
    },
    bind(listenerObj, listenerMethod) {
      let boundListener = this._boundListener = listenerMethod.bind(listenerObj);
      this._db.on(this._eventId, boundListener);
      this._drainEvents(boundListener);
      this._drainEvents = null;
    },
    destroy() {
      this._db.removeListener(this._eventId, this._boundListener);
    }
  };

  // src/backend/search/filtering_stream.js
  init_logic();
  var import_streams = __toModule(require_streams());
  init_util();
  function FilteringStream({
    ctx,
    filterRunner,
    rootGatherer,
    preDerivers,
    postDerivers,
    isDeletion,
    inputToGatherInto,
    mutateChangeToResembleAdd,
    mutateChangeToResembleDeletion,
    onFilteredUpdate
  }) {
    const queuedSet = new Set();
    const knownFilteredSet = new Set();
    const notifyAdded = (deriverList, gathered) => {
      for (let deriver of deriverList) {
        deriver.itemAdded(gathered);
      }
    };
    const notifyRemoved = (deriverList, id) => {
      for (let deriver of deriverList) {
        deriver.itemRemoved(id);
      }
    };
    const gatherStream = new import_streams.TransformStream({
      flush(enqueue, close) {
        close();
      },
      transform(change, enqueue, done) {
        if (isDeletion(change)) {
          enqueue({ change, gather: null });
        } else if (queuedSet.has(change.id)) {
          logic(ctx, "gathering", { id: change.id });
          let gatherInto = inputToGatherInto(change);
          enqueue({ change, gather: rootGatherer.gather(gatherInto) });
        }
        done();
      },
      writableStrategy: new import_streams.CountQueuingStrategy({ highWaterMark: 1 }),
      readableStrategy: new import_streams.CountQueuingStrategy({ highWaterMark: 1 })
    });
    const consider = (change) => {
      if (!isDeletion(change)) {
        queuedSet.add(change.id);
        gatherStream.writable.write(change);
      } else {
        queuedSet.delete(change.id);
        if (knownFilteredSet.has(change.id)) {
          gatherStream.writable.write(change);
        } else {
          notifyRemoved(preDerivers, change.id);
        }
      }
    };
    const timeoutIds = new Set();
    const filterStream = new import_streams.TransformStream({
      flush(enqueue, close) {
        close();
      },
      transform({ change, gather }, enqueue, done) {
        if (!gather) {
          enqueue(change);
          notifyRemoved(preDerivers, change.id);
          if (knownFilteredSet.delete(change.id)) {
            notifyRemoved(postDerivers, change.id);
          }
          done();
        } else {
          logic(ctx, "gatherWait", { id: change.id });
          gather.then((gathered) => {
            logic(ctx, "gathered", { id: change.id });
            if (!queuedSet.has(change.id)) {
              logic(ctx, "notInQueuedSet");
              done();
              return;
            }
            queuedSet.delete(change.id);
            notifyAdded(preDerivers, gathered);
            let matchInfo = filterRunner.filter(gathered);
            logic(ctx, "maybeMatch", { matched: !!matchInfo });
            if (matchInfo) {
              if (matchInfo?.event.durationBeforeToBeValid) {
                const newChange = shallowClone2(change);
                const id = setTimeout(() => {
                  timeoutIds.delete(id);
                  consider(newChange);
                }, matchInfo.event.durationBeforeToBeValid);
                timeoutIds.add(id);
                done();
                return;
              }
              if (matchInfo?.event.durationBeforeToBeInvalid) {
                const newChange = shallowClone2(change);
                const id = setTimeout(() => {
                  timeoutIds.delete(id);
                  consider(newChange);
                }, matchInfo.event.durationBeforeToBeInvalid);
                timeoutIds.add(id);
              }
              change = shallowClone2(change);
              if (!knownFilteredSet.has(change.id)) {
                mutateChangeToResembleAdd(change);
                knownFilteredSet.add(change.id);
                notifyAdded(postDerivers, gathered);
              }
              change.matchInfo = matchInfo;
              enqueue(change);
            } else if (knownFilteredSet.delete(change.id)) {
              change = shallowClone2(change);
              mutateChangeToResembleDeletion(change);
              enqueue(change);
              notifyRemoved(postDerivers, change.id);
            }
            done();
          });
        }
      },
      writableStrategy: new import_streams.CountQueuingStrategy({ highWaterMark: 1 }),
      readableStrategy: new import_streams.CountQueuingStrategy({ highWaterMark: 1 })
    });
    gatherStream.readable.pipeThrough(filterStream).pipeTo(new import_streams.WritableStream({
      start() {
      },
      write(change) {
        onFilteredUpdate(change);
      },
      close() {
      },
      abort(ex) {
        logic(ctx, "filteringStreamAbortError", { ex, stack: ex.stack });
      }
    }, new import_streams.CountQueuingStrategy({ highWaterMark: 1 })));
    return {
      consider,
      destroy: () => {
        for (const id of timeoutIds) {
          clearTimeout(id);
        }
        gatherStream.writable.close();
      }
    };
  }

  // src/backend/search/query/filtering_account_messages_query.js
  function FilteringAccountMessagesQuery({
    ctx,
    db,
    folderIds,
    filterRunner,
    rootGatherer,
    preDerivers,
    postDerivers
  }) {
    this._db = db;
    this.folderIds = folderIds;
    this._eventId = null;
    this._drainEvents = null;
    this._boundListener = null;
    this._filteringStream = new FilteringStream({
      ctx,
      filterRunner,
      rootGatherer,
      preDerivers,
      postDerivers,
      isDeletion: (change) => {
        return !change.postDate;
      },
      inputToGatherInto: (change) => {
        return {
          messageId: change.id,
          date: change.postDate
        };
      },
      mutateChangeToResembleAdd: (change) => {
        change.preDate = null;
        change.freshlyAdded = true;
      },
      mutateChangeToResembleDeletion: (change) => {
        change.preDate = change.postDate;
        change.postDate = 0;
        change.item = null;
        change.freshlyAdded = false;
      },
      onFilteredUpdate: (change) => {
        this._boundListener(change);
      }
    });
    this._bound_filteringTOCChange = this._filteringTOCChange.bind(this);
  }
  FilteringAccountMessagesQuery.prototype = {
    async execute() {
      this._drainEvents = [];
      this._eventId = [];
      const data = await Promise.all(this.folderIds.map((folderId) => this._db.loadFolderMessageIdsAndListen(folderId)));
      for (const { idsWithDates, drainEvents, eventId } of data) {
        this._drainEvents.push(drainEvents);
        this._eventId.push(eventId);
        for (const { id, date } of idsWithDates) {
          this._filteringStream.consider({
            id,
            preDate: null,
            postDate: date,
            item: null,
            freshlyAdded: true,
            matchInfo: null
          });
        }
      }
      return [];
    },
    bind(listenerObj, listenerMethod) {
      this._boundListener = listenerMethod.bind(listenerObj);
      for (const eventId of this._eventId) {
        this._db.on(eventId, this._bound_filteringTOCChange);
      }
      for (const drainEvents of this._drainEvents) {
        drainEvents(this._bound_filteringTOCChange);
      }
      this._drainEvents = null;
    },
    _filteringTOCChange(change) {
      this._filteringStream.consider(change);
    },
    destroy() {
      for (const eventId of this._eventId) {
        this._db.removeListener(eventId, this._bound_filteringTOCChange);
      }
      this._filteringStream.destroy();
    }
  };

  // src/backend/search/query/filtering_folder_query.js
  function FilteringFolderQuery({
    ctx,
    db,
    folderId,
    filterRunner,
    rootGatherer,
    preDerivers,
    postDerivers
  }) {
    this._db = db;
    this.folderId = folderId;
    this._eventId = null;
    this._drainEvents = null;
    this._boundListener = null;
    this._filteringStream = new FilteringStream({
      ctx,
      filterRunner,
      rootGatherer,
      preDerivers,
      postDerivers,
      isDeletion: (change) => {
        return !change.addDate;
      },
      inputToGatherInto: (change) => {
        return {
          convId: change.id
        };
      },
      mutateChangeToResembleAdd: (change) => {
        change.removeDate = null;
      },
      mutateChangeToResembleDeletion: (change) => {
        change.item = null;
        change.addDate = null;
        change.height = 0;
      },
      onFilteredUpdate: (change) => {
        this._boundListener(change);
      }
    });
    this._bound_filteringTOCChange = this._filteringTOCChange.bind(this);
  }
  FilteringFolderQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        eventId: this._eventId
      } = await this._db.loadFolderConversationIdsAndListen(this.folderId));
      for (let idWithDate of idsWithDates) {
        this._filteringStream.consider({
          id: idWithDate.id,
          item: null,
          removeDate: null,
          addDate: idWithDate.date,
          height: idWithDate.height,
          oldHeight: 0,
          matchInfo: null
        });
      }
      return [];
    },
    bind(listenerObj, listenerMethod) {
      this._boundListener = listenerMethod.bind(listenerObj);
      this._db.on(this._eventId, this._bound_filteringTOCChange);
      this._drainEvents(this._bound_filteringTOCChange);
      this._drainEvents = null;
    },
    _filteringTOCChange(change) {
      this._filteringStream.consider(change);
    },
    destroy() {
      this._db.removeListener(this._eventId, this._bound_filteringTOCChange);
      this._filteringStream.destroy();
    }
  };

  // src/backend/search/query/filtering_folder_messages_query.js
  function FilteringFolderMessagesQuery({
    ctx,
    db,
    folderId,
    filterRunner,
    rootGatherer,
    preDerivers,
    postDerivers
  }) {
    this._db = db;
    this.folderId = folderId;
    this._eventId = null;
    this._drainEvents = null;
    this._boundListener = null;
    this._filteringStream = new FilteringStream({
      ctx,
      filterRunner,
      rootGatherer,
      preDerivers,
      postDerivers,
      isDeletion: (change) => {
        return !change.postDate;
      },
      inputToGatherInto: (change) => {
        return {
          messageId: change.id,
          date: change.postDate
        };
      },
      mutateChangeToResembleAdd: (change) => {
        change.preDate = null;
        change.freshlyAdded = true;
      },
      mutateChangeToResembleDeletion: (change) => {
        change.preDate = change.postDate;
        change.postDate = 0;
        change.item = null;
        change.freshlyAdded = false;
      },
      onFilteredUpdate: (change) => {
        this._boundListener(change);
      }
    });
    this._bound_filteringTOCChange = this._filteringTOCChange.bind(this);
  }
  FilteringFolderMessagesQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        eventId: this._eventId
      } = await this._db.loadFolderMessageIdsAndListen(this.folderId));
      for (const { id, date } of idsWithDates) {
        this._filteringStream.consider({
          id,
          preDate: null,
          postDate: date,
          item: null,
          freshlyAdded: true,
          matchInfo: null
        });
      }
      return [];
    },
    bind(listenerObj, listenerMethod) {
      this._boundListener = listenerMethod.bind(listenerObj);
      this._db.on(this._eventId, this._bound_filteringTOCChange);
      this._drainEvents(this._bound_filteringTOCChange);
      this._drainEvents = null;
    },
    _filteringTOCChange(change) {
      this._filteringStream.consider(change);
    },
    destroy() {
      this._db.removeListener(this._eventId, this._bound_filteringTOCChange);
      this._filteringStream.destroy();
    }
  };

  // src/backend/search/query/direct_folder_messages_query.js
  function DirectFolderMessagesQuery({ db, folderId }) {
    this._db = db;
    this.folderId = folderId;
    this._eventId = null;
    this._drainEvents = null;
    this._boundListener = null;
  }
  DirectFolderMessagesQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        eventId: this._eventId
      } = await this._db.loadFolderMessageIdsAndListen(this.folderId));
      return idsWithDates;
    },
    bind(listenerObj, listenerMethod) {
      let boundListener = this._boundListener = listenerMethod.bind(listenerObj);
      this._db.on(this._eventId, boundListener);
      this._drainEvents(boundListener);
      this._drainEvents = null;
    },
    destroy() {
      this._db.removeListener(this._eventId, this._boundListener);
    }
  };

  // src/backend/search/query/direct_conv_messages_query.js
  function DirectConversationMessagesQuery({
    db,
    conversationId
  }) {
    this._db = db;
    this.conversationId = conversationId;
    this._tocEventId = null;
    this._convEventId = null;
    this._drainEvents = null;
    this._boundTOCListener = null;
    this._boundConvListener = null;
  }
  DirectConversationMessagesQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        tocEventId: this._tocEventId,
        convEventId: this._convEventId
      } = await this._db.loadConversationMessageIdsAndListen(this.conversationId));
      return idsWithDates;
    },
    bind(listenerObj, tocListenerMethod, convListenerMethod) {
      this._boundTOCListener = tocListenerMethod.bind(listenerObj);
      this._boundConvListener = convListenerMethod.bind(listenerObj);
      this._db.on(this._tocEventId, this._boundTOCListener);
      this._db.on(this._convEventId, this._boundConvListener);
      this._drainEvents(this._boundTOCListener);
      this._drainEvents = null;
    },
    destroy() {
      this._db.removeListener(this._tocEventId, this._boundTOCListener);
      this._db.removeListener(this._convEventId, this._boundConvListener);
    }
  };

  // src/backend/search/query/filtering_conv_query.js
  function FilteringConversationMessagesQuery({
    ctx,
    db,
    conversationId,
    filterRunner,
    rootGatherer
  }) {
    this._db = db;
    this.conversationId = conversationId;
    this._tocEventId = null;
    this._convEventId = null;
    this._drainEvents = null;
    this._boundTOCListener = null;
    this._boundConvListener = null;
    this._filteringStream = new FilteringStream({
      ctx,
      filterRunner,
      rootGatherer,
      isDeletion: (change) => {
        return !change.postDate;
      },
      inputToGatherInto: (change) => {
        return {
          messageId: change.id,
          date: change.postDate
        };
      },
      mutateChangeToResembleAdd: (change) => {
        change.preDate = null;
        change.freshlyAdded = true;
      },
      mutateChangeToResembleDeletion: (change) => {
        change.item = null;
        change.postDate = null;
      },
      onFilteredUpdate: (change) => {
        this._boundTOCListener(change);
      }
    });
    this._bound_filteringTOCChange = this._filteringTOCChange.bind(this);
  }
  FilteringConversationMessagesQuery.prototype = {
    async execute() {
      let idsWithDates;
      ({
        idsWithDates,
        drainEvents: this._drainEvents,
        tocEventId: this._tocEventId,
        convEventId: this._convEventId
      } = await this._db.loadConversationMessageIdsAndListen(this.conversationId));
      for (let idWithDate of idsWithDates) {
        this._filteringStream.consider({
          id: idWithDate.id,
          preDate: null,
          postDate: idWithDate.date,
          item: null,
          freshlyAdded: true,
          matchInfo: null
        });
      }
      return [];
    },
    bind(listenerObj, tocListenerMethod, convListenerMethod) {
      this._boundTOCListener = tocListenerMethod.bind(listenerObj);
      this._boundConvListener = convListenerMethod.bind(listenerObj);
      this._db.on(this._tocEventId, this._bound_filteringTOCChange);
      this._db.on(this._convEventId, this._boundConvListener);
      this._drainEvents(this._boundTOCListener);
      this._drainEvents = null;
    },
    _filteringTOCChange(change) {
      this._filteringStream.consider(change);
    },
    destroy() {
      this._db.removeListener(this._tocEventId, this._bound_filteringTOCChange);
      this._db.removeListener(this._convEventId, this._boundConvListener);
      this._filteringStream.destroy();
    }
  };

  // src/backend/search/filter_runner.js
  function FilterRunner({ filters }) {
    this.filters = filters.concat();
    this.filters.sort((a, b) => {
      return a.cost - b.cost;
    });
  }
  FilterRunner.prototype = {
    filter(gathered) {
      let matchInfo = {};
      let matched = this.filters.length === 0;
      for (let filter of this.filters) {
        let matchDetails = null;
        if (!matched || filter.alwaysRun) {
          matchDetails = filter.test(gathered);
          if (matchDetails) {
            matched = true;
          }
        }
        matchInfo[filter.resultKey] = matchDetails;
      }
      if (matched) {
        return matchInfo;
      }
      return null;
    }
  };

  // src/backend/search/nested_gatherer.js
  function NestedGatherer(rootKey, rootGatherer) {
    this.rootKey = rootKey;
    this.rootGatherer = rootGatherer;
    this.gatherers = new Map();
  }
  NestedGatherer.prototype = {
    nested: true,
    hasGatherer(key) {
      return this.gatherers.has(key) || key === this.rootKey;
    },
    getGatherer(key) {
      return this.gatherers.get(key);
    },
    addGatherer(key, gatherer) {
      this.gatherers.set(key, gatherer);
    },
    makeNestedGatherer(key, rootKey, rootGatherer) {
      let nestedGatherer = new NestedGatherer(rootKey, rootGatherer);
      this.gatherers.set(key, nestedGatherer);
      return nestedGatherer;
    },
    _gatherChildren(gatherInto) {
      let allPromises = [];
      for (let [ukey, ugatherer] of this.gatherers.entries()) {
        let key = ukey;
        let gatherer = ugatherer;
        if (gatherInto[key] && !gatherer.nested) {
          continue;
        }
        let promise = gatherer.gather(gatherInto);
        allPromises.push(promise.then((value) => {
          gatherInto[key] = value;
        }));
      }
      return Promise.all(allPromises).then(() => {
        return gatherInto;
      });
    },
    gather(gathered) {
      if (this.rootGatherer) {
        let rootGather;
        if (gathered[this.rootKey]) {
          rootGather = Promise.resolve(gathered[this.rootKey]);
        } else {
          rootGather = this.rootGatherer.gather(gathered);
        }
        return rootGather.then((rootResult) => {
          if (this.rootGatherer.plural) {
            let childPromises = [];
            let pluralGathers = rootResult.map((item) => {
              let childGather = {
                [this.rootKey]: item
              };
              childPromises.push(this._gatherChildren(childGather));
              return childGather;
            });
            return Promise.all(childPromises).then(() => {
              return pluralGathers;
            });
          }
          let subGather = {
            [this.rootKey]: rootResult
          };
          return this._gatherChildren(subGather);
        });
      }
      return this._gatherChildren(gathered);
    }
  };

  // src/backend/search/msg_filters.js
  init_syncbase();

  // src/backend/search/filters/search_pattern_from_args.js
  function regExpEscape(str) {
    return str.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  }
  function searchPatternFromArgs(args, opts) {
    let phrase;
    if (!opts) {
      opts = {};
    }
    if (typeof args === "string" || args instanceof RegExp) {
      phrase = args;
    } else if (args && args.phrase) {
      phrase = args.phrase;
    } else {
      throw new Error("unable to figure out a search pattern from the args");
    }
    if (typeof phrase === "string") {
      let pattern = regExpEscape(phrase);
      if (opts.exact) {
        pattern = "^" + pattern + "$";
      }
      return new RegExp(pattern, "i");
    }
    return phrase;
  }

  // src/backend/search/match_regexp_or_string.js
  function matchRegexpOrString(phrase, input, fromIndex) {
    if (!input) {
      return null;
    }
    if (phrase instanceof RegExp) {
      return phrase.exec(fromIndex ? input.slice(fromIndex) : input);
    }
    var idx = input.indexOf(phrase, fromIndex);
    if (idx === -1) {
      return null;
    }
    var ret = [phrase];
    ret.index = idx - fromIndex;
    return ret;
  }

  // src/backend/search/match_verbatim_highlight.js
  function matchVerbatimHighlight(searchPattern, value, path) {
    var match = matchRegexpOrString(searchPattern, value, 0);
    if (!match) {
      return null;
    }
    return {
      text: value,
      offset: 0,
      matchRuns: [{ start: match.index, length: match[0].length }],
      path: path || null
    };
  }

  // src/backend/search/filters/message/author_filter.js
  function AuthorFilter(params, args) {
    this.searchPattern = searchPatternFromArgs(args);
  }
  AuthorFilter.prototype = {
    gather: {},
    cost: 10,
    alwaysRun: true,
    test(gathered) {
      let searchPattern = this.searchPattern;
      function checkList(addressPairs) {
        if (!addressPairs) {
          return null;
        }
        for (let addressPair of addressPairs) {
          if (addressPair.name) {
            let matchInfo2 = matchVerbatimHighlight(searchPattern, addressPair.name);
            if (matchInfo2) {
              return matchInfo2;
            }
          }
          let matchInfo = matchVerbatimHighlight(searchPattern, addressPair.address);
          if (matchInfo) {
            return matchInfo;
          }
        }
        return null;
      }
      let message = gathered.message;
      return checkList([message.author]) || checkList(message.replyTo);
    }
  };

  // src/backend/search/filters/message/author_address_filter.js
  function AuthorAddressFilter(params, args) {
    this.searchPattern = searchPatternFromArgs(args, { exact: true });
  }
  AuthorAddressFilter.prototype = {
    gather: {},
    cost: 10,
    alwaysRun: true,
    test(gathered) {
      let searchPattern = this.searchPattern;
      function checkList(addressPairs) {
        if (!addressPairs) {
          return null;
        }
        for (let addressPair of addressPairs) {
          let matchInfo = matchVerbatimHighlight(searchPattern, addressPair.address);
          if (matchInfo) {
            return matchInfo;
          }
        }
        return null;
      }
      let message = gathered.message;
      return checkList([message.author]) || checkList(message.replyTo);
    }
  };

  // src/backend/search/filters/message/event_filter.js
  function EventFilter(params, args) {
    this.durationBeforeInMillis = (args.durationBeforeInMinutes ?? -1) * 60 * 1e3;
    this.type = args.type;
  }
  EventFilter.prototype = {
    gather: {},
    cost: 10,
    alwaysRun: true,
    test(gathered) {
      if (this.durationBeforeInMillis < 0) {
        return true;
      }
      const message = gathered?.message;
      if (!message || !("startDate" in message)) {
        return true;
      }
      const { startDate, endDate } = message;
      const now = new Date().valueOf();
      const dayInMillis = 24 * 60 * 60 * 1e3;
      if (startDate > now + dayInMillis) {
        return false;
      }
      if (endDate <= now) {
        return false;
      }
      if (this.type === "now") {
        const shiftedStartDate = startDate - this.durationBeforeInMillis;
        if (now < shiftedStartDate) {
          return {
            durationBeforeToBeValid: shiftedStartDate - now
          };
        }
        return {
          durationBeforeToBeInvalid: endDate - now
        };
      }
      const tomorrow = dayInMillis * Math.floor(1 + now / dayInMillis);
      if (startDate >= tomorrow) {
        return false;
      }
      return {
        durationBeforeToBeInvalid: endDate - now
      };
    }
  };

  // src/backend/search/filters/message/recipients_filter.js
  function RecipientsFilter(params, args) {
    this.searchPattern = searchPatternFromArgs(args);
  }
  RecipientsFilter.prototype = {
    gather: {},
    cost: 20,
    alwaysRun: true,
    test(gathered) {
      let searchPattern = this.searchPattern;
      function checkList(recipients) {
        if (!recipients) {
          return null;
        }
        for (let recipient of recipients) {
          if (recipient.name) {
            let matchInfo2 = matchVerbatimHighlight(searchPattern, recipient.name);
            if (matchInfo2) {
              return matchInfo2;
            }
          }
          let matchInfo = matchVerbatimHighlight(searchPattern, recipient.address);
          if (matchInfo) {
            return matchInfo;
          }
        }
        return null;
      }
      let message = gathered.message;
      return checkList(message.to) || checkList(message.cc) || checkList(message.bcc);
    }
  };

  // src/backend/search/match_excerpt_highlight.js
  function matchExcerptHighlight(searchPattern, value, path, excerptSettings) {
    var match = matchRegexpOrString(searchPattern, value, 0);
    if (!match) {
      return null;
    }
    let {
      charsBefore: contextBefore,
      charsAfter: contextAfter
    } = excerptSettings;
    let start = match.index;
    let length = match[0].length;
    if (contextBefore > start) {
      contextBefore = start;
    }
    let offset = value.indexOf(" ", start - contextBefore);
    if (offset === -1 || offset >= start - 1) {
      offset = start - contextBefore;
    } else {
      offset++;
    }
    var endIdx;
    if (start + length + contextAfter >= value.length) {
      endIdx = value.length;
    } else {
      endIdx = value.lastIndexOf(" ", start + length + contextAfter - 1);
      if (endIdx <= start + length) {
        endIdx = start + length + contextAfter;
      }
    }
    var snippet = value.substring(offset, endIdx);
    return {
      text: snippet,
      offset,
      matchRuns: [{ start: start - offset, length }],
      path
    };
  }

  // src/backend/search/filters/message/subject_filter.js
  function SubjectFilter(params, args) {
    this.excerptSettings = params.excerptSettings;
    this.searchPattern = searchPatternFromArgs(args);
  }
  SubjectFilter.prototype = {
    gather: {},
    cost: 10,
    alwaysRun: true,
    test(gathered) {
      return matchExcerptHighlight(this.searchPattern, gathered.message.subject, null, this.excerptSettings);
    }
  };

  // src/backend/search/filters/message/body_filter.js
  var CT_AUTHORED_CONTENT2 = 1;
  function BodyFilter(params, args) {
    this.includeQuotes = params.includeQuotes;
    this.excerptSettings = params.excerptSettings;
    this.searchPattern = searchPatternFromArgs(args);
    this.gather = {
      bodyContents: { includeQuotes: this.includeQuotes }
    };
  }
  BodyFilter.prototype = {
    cost: 100,
    alwaysRun: true,
    test(gathered) {
      let { searchPattern, excerptSettings, includeQuotes } = this;
      for (let bodyContent of gathered.bodyContents) {
        if (bodyContent.type === "html") {
          let match = matchExcerptHighlight(searchPattern, bodyContent.textBody, null, excerptSettings);
          if (match) {
            return match;
          }
        } else if (bodyContent.type === "plain") {
          let bodyRep = bodyContent.rep;
          for (var iRep = 0; iRep < bodyRep.length; iRep += 2) {
            var etype = bodyRep[iRep] & 15, block = bodyRep[iRep + 1];
            if (!includeQuotes && etype !== CT_AUTHORED_CONTENT2) {
              continue;
            }
            let match = matchExcerptHighlight(searchPattern, block, null, excerptSettings);
            if (match) {
              return match;
            }
          }
        }
      }
      return null;
    }
  };

  // src/backend/search/msg_filters.js
  var msg_filters_default = {
    author: {
      constructor: AuthorFilter,
      params: null
    },
    authorAddress: {
      constructor: AuthorAddressFilter,
      params: null
    },
    recipients: {
      constructor: RecipientsFilter,
      params: null
    },
    subject: {
      constructor: SubjectFilter,
      params: {
        excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS
      }
    },
    body: {
      constructor: BodyFilter,
      params: {
        excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS,
        includeQuotes: false
      }
    },
    bodyAndQuotes: {
      constructor: BodyFilter,
      params: {
        excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS,
        includeQuotes: true
      }
    },
    event: {
      constructor: EventFilter,
      params: null
    }
  };

  // src/backend/search/filters/conversation/participants_filter.js
  function ParticipantsFilter(params, args) {
    this.searchPattern = searchPatternFromArgs(args);
  }
  ParticipantsFilter.prototype = {
    gather: {
      conversation: true
    },
    cost: 10,
    alwaysRun: true,
    test(gathered) {
      let searchPattern = this.searchPattern;
      for (let author of gathered.conversation.authors) {
        if (author.name) {
          let matchInfo2 = matchVerbatimHighlight(searchPattern, author.name);
          if (matchInfo2) {
            return matchInfo2;
          }
        }
        let matchInfo = matchVerbatimHighlight(searchPattern, author.address);
        if (matchInfo) {
          return matchInfo;
        }
      }
      return null;
    }
  };

  // src/backend/search/filters/conversation/message_spread_filter.js
  function MessageSpreadFilter({ wrappedFilterDef }, args) {
    this.wrappedFilter = new wrappedFilterDef.constructor(wrappedFilterDef.params, args);
    this.gather = {
      messages: this.wrappedFilter.gather
    };
    this.cost = this.wrappedFilter.cost * 20;
    this.alwaysRun = this.wrappedFilter.alwaysRun;
  }
  MessageSpreadFilter.prototype = {
    test(gathered) {
      let wrappedFilter = this.wrappedFilter;
      for (let messageContext of gathered.messages) {
        let matchInfo = wrappedFilter.test(messageContext);
        if (matchInfo) {
          return matchInfo;
        }
      }
      return null;
    }
  };

  // src/backend/search/conv_filters.js
  var convFilters = {
    participants: {
      constructor: ParticipantsFilter,
      params: null
    }
  };
  for (let key of Object.keys(msg_filters_default)) {
    let msgFilterDef = msg_filters_default[key];
    convFilters[key] = {
      constructor: MessageSpreadFilter,
      params: { wrappedFilterDef: msgFilterDef }
    };
  }
  var conv_filters_default = convFilters;

  // src/backend/search/gatherers/conv.js
  function GatherConversation({ db, ctx }) {
    this._db = db;
    this._ctx = ctx;
  }
  GatherConversation.prototype = {
    gather(gathered) {
      return this._db.read(this._ctx, {
        conversations: new Map([[gathered.convId, null]])
      }).then(({ conversations }) => {
        return conversations.get(gathered.convId);
      });
    }
  };

  // src/backend/search/gatherers/conv_messages.js
  function GatherConversationMessages({ db, ctx }) {
    this._db = db;
    this._ctx = ctx;
  }
  GatherConversationMessages.prototype = {
    plural: true,
    gather(gathered) {
      return this._db.read(this._ctx, {
        messagesByConversation: new Map([[gathered.convId, null]])
      }).then(({ messagesByConversation }) => {
        return messagesByConversation.get(gathered.convId);
      });
    }
  };

  // src/backend/search/gatherers/message.js
  function GatherMessage({ db, ctx }) {
    this._db = db;
    this._ctx = ctx;
  }
  GatherMessage.prototype = {
    plural: false,
    gather(gathered) {
      let messageKey = [gathered.messageId, gathered.date];
      return this._db.read(this._ctx, {
        messages: new Map([[messageKey, null]])
      }).then(({ messages }) => {
        return messages.get(gathered.messageId);
      });
    }
  };

  // src/backend/search/gatherers/message/message_bodies.js
  init_htmlchew();
  function GatherMessageBodies(ignoredParams, args) {
    this.includeQuotes = args ? args.includeQuotes || false : false;
  }
  GatherMessageBodies.prototype = {
    async gather(gathered) {
      let message = gathered.message;
      let bodyPromises = message.bodyReps.map((part) => {
        if (!part.contentBlob) {
          return null;
        }
        return part.contentBlob.text();
      });
      let fetchedBodies = await Promise.all(bodyPromises);
      let bodyResults = [];
      for (let i = 0; i < message.bodyReps.length; i++) {
        let bodyObj = fetchedBodies[i];
        if (!bodyObj) {
          continue;
        }
        let bodyRep = message.bodyReps[i];
        if (bodyRep.type === "html") {
          bodyResults.push({
            type: bodyRep.type,
            textBody: generateSnippet2(bodyObj, this.includeQuotes)
          });
        } else {
          bodyResults.push({
            type: bodyRep.type,
            rep: JSON.parse(bodyObj)
          });
        }
      }
      return bodyResults;
    }
  };

  // src/backend/search/gatherers/message/author_domain.js
  var RE_DOMAIN = /@(.+)$/;
  function AuthorDomain() {
  }
  AuthorDomain.prototype = {
    gather(gathered) {
      const { message } = gathered;
      const address = message.replyTo ? message.replyTo[0].address : message.author.address;
      const match = RE_DOMAIN.exec(address);
      return Promise.resolve(match && match[1].toLowerCase());
    }
  };

  // src/backend/search/gatherers/message/days_ago.js
  init_date();
  function DaysAgo() {
    let dateScratch = new Date(NOW());
    dateScratch.setHours(0, 0, 0, 0);
    this.tomorrowMidnight = dateScratch.valueOf() + DAY_MILLIS;
  }
  DaysAgo.prototype = {
    gather(gathered) {
      const { message } = gathered;
      let daysAgo = Math.floor((this.tomorrowMidnight - message.date) / DAY_MILLIS);
      if (daysAgo < 0) {
        daysAgo = 0;
      }
      return Promise.resolve(daysAgo);
    }
  };

  // src/backend/search/msg_gatherers.js
  var msg_gatherers_default = {
    message: {
      constructor: GatherMessage,
      params: null,
      nested: null
    },
    bodyContents: {
      constructor: GatherMessageBodies,
      params: null,
      nested: null
    },
    authorDomain: {
      constructor: AuthorDomain,
      params: null,
      nested: null
    },
    daysAgo: {
      constructor: DaysAgo,
      params: null,
      nested: null
    }
  };

  // src/backend/search/conv_gatherers.js
  var conv_gatherers_default = {
    conversation: {
      constructor: GatherConversation,
      params: null,
      nested: null
    },
    messages: {
      constructor: GatherConversationMessages,
      params: null,
      nestedRootKey: "message",
      nested: msg_gatherers_default
    }
  };

  // src/backend/search/query_manager.js
  function QueryManager({ db, derivedViewManager }) {
    logic.defineScope(this, "QueryManager");
    this._db = db;
    this._derivedViewManager = derivedViewManager;
  }
  QueryManager.prototype = {
    _buildFilters(filterSpec, filterers) {
      let filters = [];
      if (filterSpec) {
        for (let key of Object.keys(filterSpec)) {
          let filterDef = filterers[key];
          if (filterDef) {
            let filter = new filterDef.constructor(filterDef.params, filterSpec[key]);
            filter.resultKey = key;
            filters.push(filter);
          }
        }
      }
      return filters;
    },
    _buildGatherHierarchy({ consumers, rootGatherDefs, dbCtx, bootstrapKey }) {
      let traverse = (curGatherer, reqObj, gatherDefs) => {
        for (let key of Object.keys(reqObj)) {
          let gatherDef = gatherDefs[key];
          if (!gatherDef.nested) {
            if (!curGatherer.hasGatherer(key)) {
              curGatherer.addGatherer(key, new gatherDef.constructor(dbCtx, gatherDef.params));
            }
          } else {
            let childGatherer;
            if (!curGatherer.hasGatherer(key)) {
              childGatherer = curGatherer.makeNestedGatherer(key, gatherDef.nestedRootKey, new gatherDef.constructor(dbCtx, gatherDef.params));
            } else {
              childGatherer = curGatherer.getGatherer(key);
            }
            traverse(childGatherer, reqObj[key], gatherDef.nested);
          }
        }
      };
      let bootstrapGatherer = null;
      if (bootstrapKey) {
        let bootstrapDef = rootGatherDefs[bootstrapKey];
        bootstrapGatherer = new bootstrapDef.constructor(dbCtx, bootstrapDef.params);
      }
      let rootGatherer = new NestedGatherer(bootstrapKey, bootstrapGatherer);
      for (let consumer of consumers) {
        traverse(rootGatherer, consumer.gather, rootGatherDefs);
      }
      return rootGatherer;
    },
    _buildDerivedViews(viewDefsWithContexts) {
      if (!viewDefsWithContexts) {
        return [];
      }
      const derivedViews = viewDefsWithContexts.map((viewDefWithContext) => {
        return this._derivedViewManager.createDerivedView(viewDefWithContext);
      });
      return derivedViews;
    },
    queryConversations(ctx, spec) {
      if (spec.folderId && !spec.filter) {
        return new DirectFolderConversationsQuery({
          db: this._db,
          folderId: spec.folderId
        });
      }
      const filters = this._buildFilters(spec.filter, conv_filters_default);
      const dbCtx = {
        db: this._db,
        ctx
      };
      const preDerivers = this._buildDerivedViews(spec.viewDefsWithContexts);
      const postDerivers = [];
      const rootGatherer = this._buildGatherHierarchy({
        consumers: [].concat(filters, preDerivers, postDerivers),
        rootGatherDefs: conv_gatherers_default,
        dbCtx
      });
      return new FilteringFolderQuery({
        ctx,
        db: this._db,
        folderId: spec.folderId,
        filterRunner: new FilterRunner({ filters }),
        rootGatherer,
        preDerivers,
        postDerivers
      });
    },
    queryMessages(ctx, spec) {
      if (spec.folderId && !spec.filter) {
        return new DirectFolderMessagesQuery({
          db: this._db,
          folderId: spec.folderId
        });
      }
      if (!spec.filter.event) {
        throw new Error("No messages filtering yet!");
      }
      let filters = this._buildFilters(spec.filter, msg_filters_default);
      const preDerivers = this._buildDerivedViews(spec.viewDefsWithContexts);
      const postDerivers = [];
      const dbCtx = {
        db: this._db,
        ctx
      };
      const rootGatherer = this._buildGatherHierarchy({
        consumers: filters,
        rootGatherDefs: msg_gatherers_default,
        bootstrapKey: "message",
        dbCtx
      });
      return new FilteringFolderMessagesQuery({
        ctx,
        db: this._db,
        folderId: spec.folderId,
        filterRunner: new FilterRunner({ filters }),
        rootGatherer,
        preDerivers,
        postDerivers
      });
    },
    queryConversationMessages(ctx, spec) {
      if (spec.conversationId && !spec.filter) {
        return new DirectConversationMessagesQuery({
          db: this._db,
          conversationId: spec.conversationId
        });
      }
      let filters = this._buildFilters(spec.filter, msg_filters_default);
      let dbCtx = {
        db: this._db,
        ctx
      };
      let rootGatherer = this._buildGatherHierarchy({
        consumers: filters,
        rootGatherDefs: msg_gatherers_default,
        bootstrapKey: "message",
        dbCtx
      });
      return new FilteringConversationMessagesQuery({
        ctx,
        db: this._db,
        conversationId: spec.conversationId,
        filterRunner: new FilterRunner({ filters }),
        rootGatherer
      });
    },
    queryAccountMessages(ctx, spec) {
      try {
        const { filter, folderIds } = spec;
        let filters = this._buildFilters(filter, msg_filters_default);
        const preDerivers = this._buildDerivedViews(spec.viewDefsWithContexts);
        const postDerivers = [];
        const dbCtx = {
          db: this._db,
          ctx
        };
        const rootGatherer = this._buildGatherHierarchy({
          consumers: filters,
          rootGatherDefs: msg_gatherers_default,
          bootstrapKey: "message",
          dbCtx
        });
        return new FilteringAccountMessagesQuery({
          ctx,
          db: this._db,
          folderIds,
          filterRunner: new FilterRunner({ filters }),
          rootGatherer,
          preDerivers,
          postDerivers
        });
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  };

  // src/backend/db/trigger_manager.js
  init_logic();
  function TriggerContext(triggerManager, triggerName) {
    this._triggerManager = triggerManager;
    this.name = triggerName;
  }
  TriggerContext.prototype = {
    get rootTaskGroupId() {
      return this._triggerManager.sourceTaskContext.rootTaskGroupId;
    },
    modify(dict) {
      return this._triggerManager.__triggerMutate(this.name, dict);
    }
  };
  function TriggerManager({ db, triggers }) {
    logic.defineScope(this, "TriggerManager");
    this.db = db;
    db.triggerManager = this;
    this.derivedMutations = null;
    this.sourceTaskContext = null;
    for (let trigger of triggers) {
      this.registerTriggerDictionary(trigger);
    }
  }
  TriggerManager.prototype = {
    __setState(taskContext, derivedMutations) {
      this.sourceTaskContext = taskContext;
      this.derivedMutations = derivedMutations;
    },
    __clearState() {
      this.sourceTaskContext = null;
      this.derivedMutations = null;
    },
    __triggerMutate(triggerName, dict) {
      logic(this, "triggerMutate", { triggerName, dict });
      if (this.derivedMutations) {
        this.derivedMutations.push(dict);
      }
    },
    registerTriggerDictionary(triggerDef) {
      let triggerName = triggerDef.name;
      let triggerContext = new TriggerContext(this, triggerName);
      for (let key of Object.keys(triggerDef)) {
        switch (key) {
          case "name":
            break;
          default: {
            let handlerFunc = triggerDef[key];
            if (!handlerFunc || !handlerFunc.bind) {
              throw new Error(`${triggerName} has broken handler '${key}: ${handlerFunc}`);
            }
            let boundHandler = handlerFunc.bind(null, triggerContext);
            this.db.on(key, boundHandler);
          }
        }
      }
    },
    registerTriggerFunc(eventName, triggerName, handlerFunc) {
      let triggerContext = new TriggerContext(this, triggerName);
      let boundHandler = handlerFunc.bind(null, triggerContext);
      this.db.on(eventName, boundHandler);
    }
  };

  // src/backend/db_triggers/unread_count.js
  var unread_count_default = {
    name: "unread_count",
    "conv!*!add": function(triggerCtx, convInfo) {
      if (!convInfo.hasUnread) {
        return;
      }
      let folderDeltas = new Map();
      for (let folderId of convInfo.folderIds) {
        folderDeltas.set(folderId, {
          localUnreadConversations: 1
        });
      }
      triggerCtx.modify({
        atomicDeltas: {
          folders: folderDeltas
        }
      });
    },
    "conv!*!change": function(triggerCtx, convId, preInfo, convInfo, added, kept, removed) {
      let hasUnread = convInfo ? convInfo.hasUnread : false;
      if (!hasUnread && !preInfo.hasUnread) {
        return;
      }
      let folderDeltas = new Map();
      let applyDelta = (folderIds, delta) => {
        for (let folderId of folderIds) {
          folderDeltas.set(folderId, {
            localUnreadConversations: delta
          });
        }
      };
      if (hasUnread) {
        if (!preInfo.hasUnread) {
          applyDelta(convInfo.folderIds, 1);
        } else {
          applyDelta(added, 1);
          applyDelta(removed, -1);
        }
      } else {
        applyDelta(preInfo.folderIds, -1);
      }
      if (folderDeltas.size) {
        triggerCtx.modify({
          atomicDeltas: {
            folders: folderDeltas
          }
        });
      }
    }
  };

  // src/backend/db_triggers/message_count.js
  var message_count_default = {
    name: "message_count",
    "msg!*!add": function(triggerCtx, message) {
      let folderDeltas = new Map();
      for (let folderId of message.folderIds) {
        folderDeltas.set(folderId, {
          localMessageCount: 1
        });
      }
      triggerCtx.modify({
        atomicDeltas: {
          folders: folderDeltas
        }
      });
    },
    "msg!*!change": function(triggerCtx, messageId, preInfo, message, added, kept, removed) {
      if (!added.size && !removed.size) {
        return;
      }
      let folderDeltas = new Map();
      for (let folderId of added) {
        folderDeltas.set(folderId, {
          localMessageCount: 1
        });
      }
      for (let folderId of removed) {
        folderDeltas.set(folderId, {
          localMessageCount: -1
        });
      }
      triggerCtx.modify({
        atomicDeltas: {
          folders: folderDeltas
        }
      });
    }
  };

  // src/backend/db_triggers/all.js
  var all_default = [unread_count_default, message_count_default];

  // src/backend/tasks/account_autoconfig.js
  init_task_definer();

  // src/backend/autoconfig/autoconfig_lookup.js
  init_logic();

  // src/shared/allback.js
  function latchedWithRejections(namedPromises) {
    return new Promise(function(resolve) {
      var results = Object.create(null);
      var pending = 0;
      Object.keys(namedPromises).forEach(function(name) {
        pending++;
        var promise = namedPromises[name];
        promise.then(function(result) {
          results[name] = { resolved: true, value: result };
          if (--pending === 0) {
            resolve(results);
          }
        }, function(err) {
          results[name] = { resolved: false, value: err };
          if (--pending === 0) {
            resolve(results);
          }
        });
      });
      if (!pending) {
        resolve(results);
      }
    });
  }

  // src/backend/autoconfig/autoconfig_lookup.js
  init_syncbase();

  // src/backend/autoconfig/testing_hacks.js
  var testing_hacks_default = new Map();

  // src/backend/autoconfig/fill_config_placeholders.js
  function fillConfigPlaceholders(userDetails, sourceConfigInfo) {
    var configInfo = JSON.parse(JSON.stringify(sourceConfigInfo));
    var details = userDetails.emailAddress.split("@");
    var emailLocalPart = details[0], emailDomainPart = details[1];
    var placeholderFields = {
      incoming: ["username", "hostname", "server"],
      outgoing: ["username", "hostname"]
    };
    function fillPlaceholder(value) {
      return value.replace("%EMAILADDRESS%", userDetails.emailAddress).replace("%EMAILLOCALPART%", emailLocalPart).replace("%EMAILDOMAIN%", emailDomainPart).replace("%REALNAME%", userDetails.displayName);
    }
    for (var serverType in placeholderFields) {
      var fields = placeholderFields[serverType];
      var server = configInfo[serverType];
      if (!server) {
        continue;
      }
      for (var iField = 0; iField < fields.length; iField++) {
        var field = fields[iField];
        if (server.hasOwnProperty(field)) {
          server[field] = fillPlaceholder(server[field]);
        }
      }
    }
    return configInfo;
  }

  // src/backend/autoconfig/autoconfig_lookup.js
  function Autoconfigurator() {
    this.timeout = AUTOCONFIG_TIMEOUT_MS;
    logic.defineScope(this, "Autoconfigurator");
  }
  Autoconfigurator.prototype = {
    _fatalErrors: ["bad-user-or-pass", "not-authorized"],
    _isSuccessOrFatal(error) {
      return !error || this._fatalErrors.includes(error);
    },
    _getXmlConfig: function getXmlConfig(url) {
      return new Promise((resolve, reject) => {
        var scope4 = logic.subscope(this, { method: "GET", url });
        logic(scope4, "xhr:start");
        var xhr = new XMLHttpRequest({ mozSystem: true });
        xhr.open("GET", url, true);
        xhr.timeout = this.timeout;
        xhr.onload = function() {
          logic(scope4, "xhr:end", { status: xhr.status });
          if (xhr.status < 200 || xhr.status >= 300) {
            reject("status" + xhr.status);
            return;
          }
          self.postMessage({
            uid: 0,
            type: "configparser",
            cmd: "accountcommon",
            args: [xhr.responseText]
          });
          self.addEventListener("message", function onworkerresponse(evt4) {
            var data = evt4.data;
            if (data.type !== "configparser" || data.cmd !== "accountcommon") {
              return;
            }
            self.removeEventListener(evt4.type, onworkerresponse);
            var args = data.args;
            var config = args[0];
            resolve(config);
          });
        };
        xhr.ontimeout = function() {
          logic(scope4, "xhr:end", { status: "timeout" });
          reject("timeout");
        };
        xhr.onerror = function() {
          logic(scope4, "xhr:end", { status: "error" });
          reject("error");
        };
        try {
          xhr.send();
        } catch (e) {
          logic(scope4, "xhr:end", { status: "sync-error" });
          reject("status404");
        }
      });
    },
    _getConfigFromLocalFile: function getConfigFromLocalFile(domain) {
      return this._getXmlConfig("/autoconfig/" + encodeURIComponent(domain));
    },
    _checkAutodiscoverUrl(url) {
      return new Promise((resolve, reject) => {
        var scope4 = logic.subscope(this, { method: "POST", url });
        logic(scope4, "autodiscoverProbe:start");
        var xhr = new XMLHttpRequest({ mozSystem: true });
        xhr.open("POST", url, true);
        xhr.timeout = this.timeout;
        var victory = () => {
          resolve({
            type: "activesync",
            incoming: {
              autodiscoverEndpoint: url
            }
          });
        };
        xhr.onload = function() {
          logic(scope4, "autodiscoverProbe:end", { status: xhr.status });
          if (xhr.status === 401) {
            victory();
            return;
          }
          reject("status" + xhr.status);
        };
        xhr.ontimeout = function() {
          logic(scope4, "autodiscoverProbe:end", { status: "timeout" });
          reject("timeout");
        };
        xhr.onerror = function() {
          logic(scope4, "autodiscoverProbe:end", { status: "error" });
          reject("error");
        };
        try {
          xhr.send(null);
        } catch (e) {
          logic(scope4, "autodiscoverProbe:end", { status: "sync-error" });
          reject("status404");
        }
      });
    },
    _probeForAutodiscover(domain) {
      var subdirUrl = "https://" + domain + "/autodiscover/autodiscover.xml";
      var domainUrl = "https://autodiscover." + domain + "/autodiscover/autodiscover.xml";
      return latchedWithRejections({
        subdir: this._checkAutodiscoverUrl(subdirUrl),
        domain: this._checkAutodiscoverUrl(domainUrl)
      }).then((results) => {
        if (results.subdir.resolved && results.subdir.value) {
          return results.subdir.value;
        }
        if (results.domain.resolved && results.domain.value) {
          return results.domain.value;
        }
        return null;
      });
    },
    _getConfigFromISPDB(domain) {
      return this._getXmlConfig(ISPDB_AUTOCONFIG_ROOT + encodeURIComponent(domain));
    },
    _getMX: function getMX(domain) {
      return new Promise((resolve, reject) => {
        var scope4 = logic.subscope(this, { domain });
        logic(scope4, "mxLookup:begin");
        var xhr = new XMLHttpRequest({ mozSystem: true });
        xhr.open("GET", "https://live.mozillamessaging.com/dns/mx/" + encodeURIComponent(domain), true);
        xhr.timeout = this.timeout;
        xhr.onload = function() {
          var reportDomain = null;
          if (xhr.status === 200) {
            var normStr = xhr.responseText.split("\n")[0];
            if (normStr) {
              normStr = normStr.toLowerCase();
              var mxDomain = normStr.split(".").slice(-2).join(".");
              if (mxDomain !== domain) {
                reportDomain = mxDomain;
              }
            }
          }
          logic(scope4, "mxLookup:end", {
            raw: normStr,
            normalized: mxDomain,
            reporting: reportDomain
          });
          resolve(reportDomain);
        };
        xhr.ontimeout = function() {
          logic(scope4, "mxLookup:end", { status: "timeout" });
          reject("timeout");
        };
        xhr.onerror = function() {
          logic(scope4, "mxLookup:end", { status: "error" });
          reject("error");
        };
        xhr.send();
      });
    },
    _getHostedAndISPDBConfigs(domain, emailAddress) {
      var commonAutoconfigSuffix = "/mail/config-v1.1.xml?emailaddress=" + encodeURIComponent(emailAddress);
      var subdomainAutoconfigUrl = "https://autoconfig." + domain + commonAutoconfigSuffix;
      var wellKnownAutoconfigUrl = "https://" + domain + "/.well-known/autoconfig" + commonAutoconfigSuffix;
      return latchedWithRejections({
        autoconfigSubdomain: this._getXmlConfig(subdomainAutoconfigUrl),
        autoconfigWellKnown: this._getXmlConfig(wellKnownAutoconfigUrl),
        ispdb: this._getConfigFromISPDB(domain),
        mxDomain: this._getMX(domain)
      }).then((results) => {
        if (results.autoconfigSubdomain.resolved && results.autoconfigSubdomain.value) {
          return {
            type: "config",
            source: "autoconfig-subdomain",
            config: results.autoconfigSubdomain.value
          };
        }
        if (results.autoconfigWellKnown.resolved && results.autoconfigWellKnown.value) {
          return {
            type: "config",
            source: "autoconfig-wellknown",
            config: results.autoconfigWellKnown.value
          };
        }
        if (results.ispdb.resolved && results.ispdb.value) {
          return { type: "config", source: "ispdb", config: results.ispdb.value };
        }
        if (results.mxDomain.resolved && results.mxDomain.value && results.mxDomain.value !== domain) {
          return { type: "mx", domain: results.mxDomain.value };
        }
        return { type: null };
      });
    },
    _getConfigFromMX: function getConfigFromMX(domain, callback) {
      this._getMX(domain, (mxError, mxDomain, mxErrorDetails) => {
        if (mxError) {
          callback(mxError, null, mxErrorDetails);
          return;
        }
        console.log("  Found MX for", mxDomain);
        if (domain === mxDomain) {
          callback("no-config-info", null, { status: "mxsame" });
          return;
        }
        console.log("  Looking in local file store");
        this._getConfigFromLocalFile(mxDomain, (error, config, errorDetails) => {
          if (!error) {
            callback(error, config, errorDetails);
            return;
          }
          console.log("  Looking in the Mozilla ISPDB");
          this._getConfigFromDB(mxDomain, callback);
        });
      });
    },
    _checkGelamConfig(domain) {
      if (testing_hacks_default.has(domain)) {
        return testing_hacks_default.get(domain);
      }
      return null;
    },
    learnAboutAccount(details) {
      return new Promise((resolve) => {
        var emailAddress = details.emailAddress;
        var emailParts = emailAddress.split("@");
        var emailDomainPart = emailParts[1];
        var domain = emailDomainPart.toLowerCase();
        var scope4 = logic.subscope(this, { domain });
        logic(scope4, "autoconfig:begin");
        var selfHostedAndISPDBHandler, mxLocalHandler, autodiscoverHandler, mxISPDBHandler;
        var victory = (sourceConfigInfo, source) => {
          var configInfo = null, result;
          if (sourceConfigInfo) {
            configInfo = fillConfigPlaceholders(details, sourceConfigInfo);
            if (configInfo.incoming && configInfo.incoming.authentication === "xoauth2") {
              result = "need-oauth2";
            } else {
              result = "need-password";
            }
          } else {
            result = "no-config-info";
          }
          logic(scope4, "autoconfig:end", {
            result,
            source,
            configInfo
          });
          resolve({ result, source, configInfo });
        };
        var failsafeFailure = (error) => {
          logic(this, "autoconfig:end", {
            error: {
              message: error && error.message,
              stack: error && error.stack
            }
          });
          resolve({ result: "no-config-info", configInfo: null });
        };
        var coerceRejectionToNull = (error) => {
          logic(scope4, "autoconfig:coerceRejection", { error });
          return null;
        };
        var hardcodedConfig = this._checkGelamConfig(domain);
        if (hardcodedConfig) {
          victory(hardcodedConfig, "hardcoded");
          return;
        }
        var localConfigHandler = (info) => {
          if (info) {
            victory(info, "local");
            return null;
          }
          return this._getHostedAndISPDBConfigs(domain, emailAddress).then(selfHostedAndISPDBHandler);
        };
        var mxDomain;
        selfHostedAndISPDBHandler = (typedResult) => {
          if (typedResult.type === "config") {
            victory(typedResult.config, typedResult.source);
            return null;
          }
          if (typedResult.type === "mx") {
            mxDomain = typedResult.domain;
            return this._getConfigFromLocalFile(mxDomain).catch(coerceRejectionToNull).then(mxLocalHandler);
          }
          return this._probeForAutodiscover(domain).then(autodiscoverHandler);
        };
        mxLocalHandler = (info) => {
          if (info) {
            victory(info, "mx local");
            return null;
          }
          return this._getConfigFromISPDB(mxDomain).catch(coerceRejectionToNull).then(mxISPDBHandler);
        };
        mxISPDBHandler = (info) => {
          if (info) {
            victory(info, "mx ispdb");
            return null;
          }
          return this._probeForAutodiscover(domain).then(autodiscoverHandler);
        };
        autodiscoverHandler = (info) => {
          victory(info, info ? "autodiscover" : null);
          return null;
        };
        this._getConfigFromLocalFile(domain).catch(coerceRejectionToNull).then(localConfigHandler).catch(failsafeFailure);
      });
    }
  };
  function autoconfigLookup(details) {
    let autoconfigurator = new Autoconfigurator();
    return autoconfigurator.learnAboutAccount(details);
  }

  // src/backend/tasks/account_autoconfig.js
  var account_autoconfig_default = task_definer_default.defineSimpleTask([
    {
      name: "account_autoconfig",
      exclusiveResources() {
        return [];
      },
      priorityTags() {
        return [];
      },
      async execute(ctx, planned) {
        let result = await autoconfigLookup(planned.userDetails);
        await ctx.finishTask({});
        return ctx.returnValue(result);
      }
    }
  ]);

  // src/backend/tasks/account_create.js
  init_task_definer();

  // src/backend/db/account_def_rep.js
  init_date();
  function makeAccountDef({
    infra,
    credentials,
    prefFields,
    typeFields,
    engineFields,
    connInfoFields,
    identities,
    kind
  }) {
    let def = {
      id: infra.id,
      name: infra.name,
      defaultPriority: NOW(),
      type: infra.type,
      engine: engineFields.engine,
      engineData: engineFields.engineData,
      credentials,
      identities,
      kind
    };
    for (let key of Object.keys(prefFields)) {
      def[key] = prefFields[key];
    }
    for (let key of Object.keys(typeFields)) {
      def[key] = typeFields[key];
    }
    for (let key of Object.keys(connInfoFields)) {
      def[key] = connInfoFields[key];
    }
    return def;
  }
  function makeIdentity(raw) {
    return {
      id: raw.id,
      name: raw.name,
      address: raw.address,
      replyTo: raw.replyTo,
      signature: raw.signature,
      signatureEnabled: raw.signatureEnabled
    };
  }

  // src/backend/default_prefs.js
  var DEFAULT_PREFS = {
    syncRange: "auto",
    syncInterval: 0,
    notifyOnNew: true,
    playSoundOnSend: true
  };
  var default_prefs_default = DEFAULT_PREFS;

  // src/backend/tasks/account_create.js
  init_id_conversions();
  var account_create_default = task_definer_default.defineSimpleTask([
    {
      name: "account_create",
      exclusiveResources() {
        return [];
      },
      priorityTags() {
        return [];
      },
      async execute(ctx, planned) {
        let { userDetails, domainInfo } = planned;
        let accountType = domainInfo.type;
        let [configurator, validator] = await Promise.all([
          configuratorModules.get(accountType)(),
          validatorModules.get(accountType)()
        ]);
        let fragments = configurator(userDetails, domainInfo);
        let validationResult = await validator(fragments);
        if (validationResult.error) {
          return ctx.returnValue(validationResult);
        }
        let accountNum = ctx.universe.config.nextAccountNum;
        let accountId = makeAccountId(accountNum);
        if (validationResult.receiveProtoConn) {
          ctx.universe.accountManager.stashAccountConnection(accountId, validationResult.receiveProtoConn);
        }
        let identity = makeIdentity({
          id: makeIdentityId(accountId, 0),
          name: userDetails.displayName,
          address: userDetails.emailAddress,
          replyTo: null,
          signature: null,
          signatureEnabled: false
        });
        let accountDef = makeAccountDef({
          infra: {
            id: accountId,
            name: userDetails.emailAddress,
            type: accountType
          },
          credentials: fragments.credentials,
          prefFields: default_prefs_default,
          typeFields: fragments.typeFields,
          engineFields: validationResult.engineFields,
          connInfoFields: fragments.connInfoFields,
          identities: [identity],
          kind: fragments.kind
        });
        await ctx.finishTask({
          newData: {
            accounts: [accountDef]
          },
          atomicClobbers: {
            config: {
              nextAccountNum: accountNum + 1
            }
          }
        });
        return ctx.returnValue({
          accountId,
          error: null,
          errorDetails: null
        });
      }
    }
  ]);

  // src/backend/tasks/account_delete.js
  init_task_definer();
  var account_delete_default = task_definer_default.defineSimpleTask([
    {
      name: "account_delete",
      args: ["accountId"],
      exclusiveResources(args) {
        return [`account:${args.accountId}`];
      },
      priorityTags() {
        return [];
      },
      async execute(ctx, planned) {
        await ctx.beginMutate({
          accounts: new Map([[planned.accountId, null]])
        });
        await ctx.finishTask({
          mutations: {
            accounts: new Map([[planned.accountId, null]])
          }
        });
      }
    }
  ]);

  // src/backend/tasks/account_migrate.js
  init_task_definer();
  var account_migrate_default = task_definer_default.defineSimpleTask([
    {
      name: "account_migrate",
      async plan(ctx, raw) {
        let { accountDef } = raw;
        await ctx.finishTask({
          newData: {
            accounts: [accountDef]
          }
        });
      },
      execute: null
    }
  ]);

  // src/backend/tasks/config_modify.js
  init_logic();
  init_task_definer();
  var config_modify_default = task_definer_default.defineSimpleTask([
    {
      name: "config_modify",
      async plan(ctx, rawTask) {
        const globalClobbers = new Map();
        for (let key in rawTask.mods) {
          const val = rawTask.mods[key];
          switch (key) {
            case "debugLogging":
              globalClobbers.set(["debugLogging"], val);
              logic.realtimeLogEverything = val === "realtime";
              break;
            default:
              logic(ctx, "badModifyConfigKey", { key });
              break;
          }
        }
        await ctx.finishTask({
          atomicClobbers: {
            config: globalClobbers
          }
        });
      }
    }
  ]);

  // src/backend/tasks/draft_create.js
  init_task_definer();
  init_id_conversions();
  init_date();
  init_mailchew();

  // src/backend/drafts/address_helpers.js
  function addressMatches(a, b) {
    return a.address === b.address;
  }
  function cloneRecipients(recipients) {
    return {
      to: recipients.to ? recipients.to.slice() : null,
      cc: recipients.cc ? recipients.cc.slice() : null,
      bcc: recipients.bcc ? recipients.bcc.slice : null
    };
  }
  function effectiveAuthorGivenReplyTo(fromAddressPair, replyToAddressPair) {
    return {
      name: fromAddressPair.name,
      address: replyToAddressPair && replyToAddressPair.address || fromAddressPair.address
    };
  }
  function checkIfAddressListContainsAddress(list, addrPair) {
    if (!list) {
      return false;
    }
    let checkAddress = addrPair.address;
    for (var i = 0; i < list.length; i++) {
      if (list[i].address === checkAddress) {
        return true;
      }
    }
    return false;
  }
  function filterOutIdentity(list, identity) {
    return list.filter((addressPair) => addressPair.address !== identity.address);
  }
  function addressPairFromIdentity(identity) {
    return {
      name: identity.name,
      address: identity.address
    };
  }
  function replyToFromIdentity(identity) {
    return { address: identity.replyTo };
  }

  // src/backend/drafts/derive_blank_draft.js
  init_mailchew();
  init_mail_rep();
  function deriveBlankDraft({
    identity,
    messageId,
    umid,
    guid,
    date,
    folderIds
  }) {
    let bodyReps = generateBaseComposeParts(identity);
    let draftInfo = makeDraftInfo({
      draftType: "blank",
      mode: null,
      refMessageId: null,
      refMessageDate: null
    });
    return makeMessageInfo({
      id: messageId,
      umid,
      guid,
      date,
      author: addressPairFromIdentity(identity),
      to: [],
      cc: [],
      bcc: [],
      replyTo: replyToFromIdentity(identity),
      flags: [],
      folderIds,
      hasAttachments: false,
      subject: "",
      snippet: "",
      attachments: [],
      relatedParts: [],
      references: [],
      bodyReps,
      draftInfo
    });
  }

  // src/backend/drafts/derive_inline_forward.js
  init_mailchew();
  init_mail_rep();
  async function deriveInlineForward({
    sourceMessage,
    identity,
    messageId,
    umid,
    guid,
    date,
    folderIds
  }) {
    let subject = generateForwardSubject(sourceMessage.subject);
    let bodyReps = await generateForwardParts(sourceMessage, identity);
    let draftInfo = makeDraftInfo({
      draftType: "forward",
      mode: null,
      refMessageId: sourceMessage.id,
      refMessageDate: sourceMessage.date
    });
    return makeMessageInfo({
      id: messageId,
      umid,
      guid,
      date,
      author: addressPairFromIdentity(identity),
      to: [],
      cc: [],
      bcc: [],
      replyTo: replyToFromIdentity(identity),
      flags: [],
      folderIds,
      hasAttachments: false,
      subject,
      snippet: "",
      attachments: [],
      relatedParts: [],
      references: [],
      bodyReps,
      draftInfo
    });
  }

  // src/backend/drafts/derive_quoted_reply.js
  init_mailchew();

  // src/backend/drafts/reply_all_recipients.js
  function replyAllRecipients(sourceRecipients, sourceAuthor, replyAuthor) {
    let rTo;
    if (checkIfAddressListContainsAddress(sourceRecipients.to, sourceAuthor) || checkIfAddressListContainsAddress(sourceRecipients.cc, sourceAuthor)) {
      rTo = sourceRecipients.to;
    } else if (sourceRecipients.to && sourceRecipients.to.length) {
      rTo = [sourceAuthor].concat(sourceRecipients.to);
    } else {
      rTo = [sourceAuthor];
    }
    if (rTo.length === 1 && (!sourceRecipients.cc || sourceRecipients.cc.length === 0) && checkIfAddressListContainsAddress(rTo, replyAuthor)) {
      return {
        to: rTo,
        cc: [],
        bcc: sourceRecipients.bcc
      };
    }
    return {
      to: filterOutIdentity(rTo, replyAuthor),
      cc: filterOutIdentity(sourceRecipients.cc || [], replyAuthor),
      bcc: sourceRecipients.bcc
    };
  }

  // src/backend/drafts/reply_to_sender_recipients.js
  function replyToSenderRecipients(sourceRecipients, sourceAuthor, replyAuthor) {
    if (addressMatches(sourceAuthor, replyAuthor)) {
      return cloneRecipients(sourceRecipients);
    }
    return {
      to: [sourceAuthor],
      cc: [],
      bcc: []
    };
  }

  // src/backend/drafts/derive_quoted_reply.js
  init_mail_rep();
  async function deriveQuotedReply({
    sourceMessage,
    replyMode,
    identity,
    messageId,
    umid,
    guid,
    date,
    folderIds
  }) {
    let sourceRecipients = {
      to: sourceMessage.to,
      cc: sourceMessage.cc,
      bcc: sourceMessage.bcc
    };
    let sourceEffectiveAuthor = effectiveAuthorGivenReplyTo(sourceMessage.author, sourceMessage.replyTo);
    let replyEffectiveAuthor = effectiveAuthorGivenReplyTo(identity, identity.replyTo && { address: identity.replyTo });
    let recipients;
    switch (replyMode) {
      case "sender":
        recipients = replyToSenderRecipients(sourceRecipients, sourceEffectiveAuthor, replyEffectiveAuthor);
        break;
      case "all":
        recipients = replyAllRecipients(sourceRecipients, sourceEffectiveAuthor, replyEffectiveAuthor);
        break;
      default:
        throw new Error("bad reply mode: " + replyMode);
    }
    let references = sourceMessage.references.slice();
    if (sourceMessage.guid) {
      references.push(sourceMessage.guid);
    }
    let subject = generateReplySubject(sourceMessage.subject);
    let bodyReps = await generateReplyParts(sourceMessage.bodyReps, sourceEffectiveAuthor, date, identity, sourceMessage.guid);
    let draftInfo = makeDraftInfo({
      draftType: "reply",
      mode: replyMode,
      refMessageId: sourceMessage.id,
      refMessageDate: sourceMessage.date
    });
    return makeMessageInfo({
      id: messageId,
      umid,
      guid,
      date,
      author: addressPairFromIdentity(identity),
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.cc,
      replyTo: replyToFromIdentity(identity),
      flags: [],
      folderIds,
      hasAttachments: false,
      subject,
      snippet: "",
      attachments: [],
      relatedParts: [],
      references,
      bodyReps,
      draftInfo
    });
  }

  // src/backend/tasks/draft_create.js
  init_conv_churn_driver();
  var draft_create_default = task_definer_default.defineSimpleTask([
    {
      name: "draft_create",
      async plan(ctx, req) {
        let accountId;
        if (req.refMessageId) {
          accountId = accountIdFromMessageId(req.refMessageId);
        } else if (req.folderId) {
          accountId = accountIdFromFolderId(req.folderId);
        }
        let account = await ctx.universe.acquireAccount(ctx, accountId);
        let draftFolderInfo = account.getFirstFolderWithType("localdrafts");
        let identity = account.identities[0];
        let convId;
        let messageId;
        let messageIdPiece = "~" + ctx.id;
        let umid = accountId + "." + messageIdPiece;
        if (req.draftType === "blank" || req.draftType === "forward") {
          convId = accountId + "." + messageIdPiece;
          messageId = convId + "." + messageIdPiece;
        } else if (req.draftType === "reply") {
          convId = convIdFromMessageId(req.refMessageId);
          messageId = convId + "." + messageIdPiece;
        } else {
          throw new Error("invalid draft type: " + req.draftType);
        }
        let guid = generateMessageIdHeaderValue();
        let date = NOW();
        let allMessages;
        let oldConvInfo;
        let messageInfo;
        let folderIds = new Set([draftFolderInfo.id]);
        if (req.draftType === "blank") {
          messageInfo = deriveBlankDraft({
            identity,
            messageId,
            umid,
            guid,
            date,
            folderIds
          });
          allMessages = [messageInfo];
        } else if (req.draftType === "reply") {
          let fromDb = await ctx.beginMutate({
            conversations: new Map([[convId, null]]),
            messagesByConversation: new Map([[convId, null]])
          });
          oldConvInfo = fromDb.conversations.get(convId);
          let loadedMessages = fromDb.messagesByConversation.get(convId);
          let sourceMessage = loadedMessages.find((msg) => msg.id === req.refMessageId);
          messageInfo = await deriveQuotedReply({
            sourceMessage,
            replyMode: req.mode,
            identity,
            messageId,
            umid,
            guid,
            date,
            folderIds
          });
          allMessages = loadedMessages.concat([messageInfo]);
        } else {
          let sourceMessageKey = [req.refMessageId, req.refMessageDate];
          let fromDb = await ctx.beginMutate({
            messages: new Map([[sourceMessageKey, null]])
          });
          let sourceMessage = fromDb.messages.get(req.refMessageId);
          messageInfo = await deriveInlineForward({
            sourceMessage,
            identity,
            messageId,
            umid,
            guid,
            date,
            folderIds
          });
          allMessages = [messageInfo];
        }
        let convInfo = churnConversationDriver(convId, oldConvInfo, allMessages);
        if (oldConvInfo) {
          await ctx.finishTask({
            mutations: {
              conversations: new Map([[convId, convInfo]])
            },
            newData: {
              messages: [messageInfo]
            }
          });
        } else {
          await ctx.finishTask({
            newData: {
              conversations: [convInfo],
              messages: [messageInfo]
            }
          });
        }
        return ctx.returnValue({ messageId, messageDate: date });
      },
      execute: null
    }
  ]);

  // src/backend/tasks/new_flush.js
  init_task_definer();

  // src/app_logic/new_batch_churn.js
  function flattenConvHierarchyToMessagesNewestFirst(newByConv) {
    let messages = [];
    for (let messageMap of newByConv.values()) {
      for (let message of messageMap.values()) {
        messages.push(message);
      }
    }
    messages.sort((a, b) => b.date - a.date);
    return messages;
  }
  function churnPerAccount(multipleAccounts, accountInfo, newByConv) {
    if (newByConv.size === 0) {
      return null;
    }
    let messages = flattenConvHierarchyToMessagesNewestFirst(newByConv);
    let maybeAccountName = multipleAccounts ? accountInfo.name : null;
    if (messages.length === 1) {
      let message = messages[0];
      return {
        newMessageCount: 1,
        fromAddress: message.authorNameish,
        subject: message.subject,
        maybeAccountName
      };
    }
    let uniqueAddresses = [];
    let maxCount = 3;
    for (let message of messages) {
      let candidateAddress = message.authorNameish;
      if (!uniqueAddresses.includes(candidateAddress)) {
        uniqueAddresses.push(candidateAddress);
        if (uniqueAddresses.length >= maxCount) {
          break;
        }
      }
    }
    return {
      newMessageCount: messages.length,
      topFromAddresses: uniqueAddresses,
      maybeAccountName
    };
  }
  function churnAllNewMessages(ctx, newSetsWithAccount) {
    let perAccountResults = new Map();
    for (let { accountInfo, newByConv } of newSetsWithAccount) {
      perAccountResults.set(accountInfo.id, churnPerAccount(!!newSetsWithAccount.length, accountInfo, newByConv));
    }
    return Promise.resolve(perAccountResults);
  }

  // src/backend/tasks/new_flush.js
  var new_flush_default = task_definer_default.defineAtMostOnceTask([
    {
      name: "new_flush",
      binByArg: null,
      async helped_plan(ctx) {
        const accountsTOC = await ctx.acquireAccountsTOC();
        const accountInfos = accountsTOC.getAllItems();
        const newSetsWithAccount = [];
        for (let accountInfo of accountInfos) {
          let newByConv = ctx.synchronouslyConsultOtherTask({
            name: "new_tracking",
            accountId: accountInfo.id
          });
          newSetsWithAccount.push({
            accountInfo,
            newByConv
          });
        }
        let churned = await churnAllNewMessages(ctx, newSetsWithAccount);
        ctx.broadcastOverBridges("newMessagesUpdate", churned);
        return {
          taskState: null
        };
      }
    }
  ]);

  // src/backend/global_tasks.js
  var global_tasks_default = [
    config_modify_default,
    account_autoconfig_default,
    account_create_default,
    account_delete_default,
    account_migrate_default,
    draft_create_default,
    new_flush_default
  ];

  // src/backend/mailuniverse.js
  init_id_conversions();
  function MailUniverse({ online, testOptions, appExtensions }) {
    logic.defineScope(this, "Universe");
    this._initialized = false;
    this._appExtensions = appExtensions;
    const db = this.db = new MailDB({
      universe: this,
      testOptions
    });
    const tocManager = this.tocManager = new TOCManager();
    const derivedViewManager = this.derivedViewManager = new DerivedViewManager();
    this.queryManager = new QueryManager({
      db,
      derivedViewManager
    });
    const triggerManager = this.triggerManager = new TriggerManager({
      db,
      triggers: all_default
    });
    this._bridges = [];
    this._folderConvsTOCs = new Map();
    this._folderMessagesTOCs = new Map();
    this._conversationTOCs = new Map();
    const dataOverlayManager = this.dataOverlayManager = new DataOverlayManager();
    const taskPriorities = this.taskPriorities = new TaskPriorities();
    const taskResources = this.taskResources = new TaskResources(this.taskPriorities);
    const taskRegistry = this.taskRegistry = new TaskRegistry({
      dataOverlayManager,
      triggerManager,
      taskResources
    });
    const accountManager = this.accountManager = new AccountManager({
      db,
      universe: this,
      taskRegistry,
      taskResources
    });
    const taskManager = this.taskManager = new TaskManager({
      universe: this,
      db,
      taskRegistry,
      taskResources,
      taskPriorities,
      accountManager
    });
    this.taskGroupTracker = new TaskGroupTracker(taskManager);
    this.taskRegistry.registerGlobalTasks(global_tasks_default);
    this.cronSyncSupport = new CronSyncSupport({
      universe: this,
      db,
      accountManager
    });
    this.extensionManager = new ExtensionManager({
      derivedViewManager,
      tocManager
    });
    this._testModeFakeNavigator = testOptions && testOptions.fakeNavigator || null;
    this.online = true;
    this._onConnectionChange(online);
    this._mode = "cron";
    this.config = null;
    this._logReaper = null;
    this._logBacklog = null;
    this._LOG = null;
  }
  MailUniverse.prototype = {
    _initLogging(config) {
      if (config.debugLogging === "realtime") {
        logic.realtimeLogEverything = true;
      }
    },
    _generateMigrationTasks({ accountDefs }) {
      return accountDefs.map((accountDef) => {
        return {
          type: "account_migrate",
          accountDef
        };
      });
    },
    init() {
      if (this._initialized !== false) {
        throw new Error("misuse");
      }
      this._initialized = "initializing";
      return this.db.getConfig().then(({ config, accountDefs, carryover }) => {
        if (config) {
          return this._initFromConfig({ config, accountDefs });
        }
        let freshConfig = {
          id: "config",
          nextAccountNum: carryover ? carryover.config.nextAccountNum : 0,
          debugLogging: carryover ? carryover.config.debugLogging : false
        };
        let migrationTasks;
        if (carryover) {
          migrationTasks = this._generateMigrationTasks(carryover);
        }
        this.db.saveConfig(freshConfig);
        return this._initFromConfig({
          config: freshConfig,
          accountDefs: [],
          tasksToPlan: migrationTasks
        });
      });
    },
    _initFromConfig({ config, accountDefs, tasksToPlan }) {
      this._initialized = true;
      this.config = config;
      this._initLogging(config);
      logic(this, "START_OF_LOG");
      logic(this, "configLoaded", { config });
      this._bindStandardBroadcasts();
      this.extensionManager.registerExtensions(this._appExtensions, "app");
      let initPromise = this.accountManager.initFromDB(accountDefs).then(() => {
        return this.taskManager.__restoreFromDB();
      }).then(() => {
        if (tasksToPlan) {
          this.taskManager.scheduleTasks(tasksToPlan, "initFromConfig");
        }
        this.cronSyncSupport.systemReady();
        return this;
      });
      this.cronSyncSupport.ensureSync("universe-init");
      return initPromise;
    },
    setInteractive() {
      this._mode = "interactive";
    },
    _onConnectionChange(isOnline) {
      var wasOnline = this.online;
      this.online = this._testModeFakeNavigator ? this._testModeFakeNavigator.onLine : isOnline;
      logic(this, "connectionChange", { online: this.online, wasOnline });
      if (this.online) {
        this.taskResources.resourceAvailable("online");
      } else {
        this.taskResources.resourcesNoLongerAvailable(["online"]);
      }
    },
    registerBridge(mailBridge) {
      this._bridges.push(mailBridge);
    },
    unregisterBridge(mailBridge) {
      var idx = this._bridges.indexOf(mailBridge);
      if (idx !== -1) {
        this._bridges.splice(idx, 1);
      }
    },
    exposeConfigForClient() {
      const config = this.config;
      return {
        debugLogging: config.debugLogging
      };
    },
    getAllAccountIdsWithKind(kind) {
      return this.accountManager.getAllAccountIdsWithKind(kind);
    },
    _bindStandardBroadcasts() {
      this.db.on("config", () => {
        this.broadcastOverBridges("config", this.exposeConfigForClient());
      });
    },
    broadcastOverBridges(name, data) {
      for (let bridge of this._bridges) {
        bridge.broadcast(name, data);
      }
    },
    acquireAccountsTOC(ctx) {
      return this.accountManager.acquireAccountsTOC(ctx);
    },
    acquireAccount(ctx, accountId) {
      return this.accountManager.acquireAccount(ctx, accountId);
    },
    acquireAccountFoldersTOC(ctx, accountId) {
      return this.accountManager.acquireAccountFoldersTOC(ctx, accountId);
    },
    acquireExtensionTOC(ctx, namespace, name) {
      return this.tocManager.acquireExtensionTOC(ctx, namespace, name);
    },
    acquireFolderConversationsTOC(ctx, folderId) {
      let toc;
      if (this._folderConvsTOCs.has(folderId)) {
        toc = this._folderConvsTOCs.get(folderId);
      } else {
        let accountId = accountIdFromFolderId(folderId);
        let engineFacts = this.accountManager.getAccountEngineBackEndFacts(accountId);
        let syncStampSource;
        if (engineFacts.syncGranularity === "account") {
          syncStampSource = this.accountManager.getAccountDefById(accountId);
        } else {
          syncStampSource = this.accountManager.getFolderById(folderId);
        }
        toc = new FolderConversationsTOC({
          db: this.db,
          query: this.queryManager.queryConversations(ctx, { folderId }),
          dataOverlayManager: this.dataOverlayManager,
          metaHelpers: [
            new SyncLifecycle({
              folderId,
              syncStampSource,
              dataOverlayManager: this.dataOverlayManager
            })
          ],
          refreshHelpers: [(why) => this.universe.syncRefreshFolder(folderId, why)],
          onForgotten: () => {
            this._folderConvsTOCs.delete(folderId);
          }
        });
        this._folderConvsTOCs.set(folderId, toc);
      }
      return ctx.acquire(toc);
    },
    acquireSearchConversationsTOC(ctx, spec) {
      let folderId = spec.folderId;
      let accountId = accountIdFromFolderId(folderId);
      let engineFacts = this.accountManager.getAccountEngineBackEndFacts(accountId);
      let syncStampSource;
      if (engineFacts.syncGranularity === "account") {
        syncStampSource = this.accountManager.getAccountDefById(accountId);
      } else {
        syncStampSource = this.accountManager.getFolderById(folderId);
      }
      let toc = new FolderConversationsTOC({
        db: this.db,
        query: this.queryManager.queryConversations(ctx, spec),
        dataOverlayManager: this.dataOverlayManager,
        metaHelpers: [
          new SyncLifecycle({
            folderId,
            syncStampSource,
            dataOverlayManager: this.dataOverlayManager
          })
        ],
        refreshHelpers: [(why) => this.universe.syncRefreshFolder(folderId, why)],
        onForgotten: () => {
        }
      });
      return ctx.acquire(toc);
    },
    acquireFolderMessagesTOC(ctx, folderId) {
      let toc;
      if (this._folderMessagesTOCs.has(folderId)) {
        toc = this._folderMessagesTOCs.get(folderId);
      } else {
        let accountId = accountIdFromFolderId(folderId);
        let engineFacts = this.accountManager.getAccountEngineBackEndFacts(accountId);
        let syncStampSource;
        if (engineFacts.syncGranularity === "account") {
          syncStampSource = this.accountManager.getAccountDefById(accountId);
        } else {
          syncStampSource = this.accountManager.getFolderById(folderId);
        }
        toc = new ConversationTOC({
          db: this.db,
          query: this.queryManager.queryMessages(ctx, { folderId }),
          dataOverlayManager: this.dataOverlayManager,
          metaHelpers: [
            new SyncLifecycle({
              folderId,
              syncStampSource,
              dataOverlayManager: this.dataOverlayManager
            })
          ],
          refreshHelpers: [(why) => this.universe.syncRefreshFolder(folderId, why)],
          onForgotten: () => {
            this._folderMessagesTOCs.delete(folderId);
          }
        });
        this._folderMessagesTOCs.set(folderId, toc);
      }
      return ctx.acquire(toc);
    },
    acquireSearchMessagesTOC(ctx, spec) {
      const { folderId } = spec;
      let accountId = accountIdFromFolderId(folderId);
      let engineFacts = this.accountManager.getAccountEngineBackEndFacts(accountId);
      let syncStampSource;
      if (engineFacts.syncGranularity === "account") {
        syncStampSource = this.accountManager.getAccountDefById(accountId);
      } else {
        syncStampSource = this.accountManager.getFolderById(folderId);
      }
      const toc = new ConversationTOC({
        db: this.db,
        query: this.queryManager.queryMessages(ctx, spec),
        dataOverlayManager: this.dataOverlayManager,
        metaHelpers: [
          new SyncLifecycle({
            folderId,
            syncStampSource,
            dataOverlayManager: this.dataOverlayManager
          })
        ],
        refreshHelpers: [(why) => this.universe.syncRefreshFolder(folderId, why)],
        onForgotten: () => {
        }
      });
      return ctx.acquire(toc);
    },
    __acquireSearchFoldersHelper(accountId, spec, metaHelpers, refreshHelpers) {
      const engineFacts = this.accountManager.getAccountEngineBackEndFacts(accountId);
      let syncStampSource = null;
      if (engineFacts.syncGranularity === "account") {
        syncStampSource = this.accountManager.getAccountDefById(accountId);
      }
      const folderIds = this.accountManager.getFolderIdsByTag(accountId, spec?.filter.tag || null);
      spec.folderIds.push(...folderIds);
      for (const folderId of folderIds) {
        metaHelpers.push(new SyncLifecycle({
          folderId,
          syncStampSource: syncStampSource || this.accountManager.getFolderById(folderId),
          dataOverlayManager: this.dataOverlayManager
        }));
        refreshHelpers.push((why) => this.syncRefreshFolder(folderId, why));
      }
    },
    acquireSearchAccountMessagesTOC(ctx, spec) {
      const { accountId } = spec;
      spec.folderIds = [];
      const metaHelpers = [];
      const refreshHelpers = [];
      this.__acquireSearchFoldersHelper(accountId, spec, metaHelpers, refreshHelpers);
      const toc = new ConversationTOC({
        db: this.db,
        query: this.queryManager.queryAccountMessages(ctx, spec),
        dataOverlayManager: this.dataOverlayManager,
        metaHelpers,
        refreshHelpers,
        onForgotten: () => {
        }
      });
      if (spec.refresh) {
        toc.refresh("searchAccountMessages");
      }
      return ctx.acquire(toc);
    },
    acquireSearchAllAccountsMessagesTOC(ctx, spec) {
      const { accountIds } = spec;
      spec.folderIds = [];
      const metaHelpers = [];
      const refreshHelpers = [];
      for (const accountId of accountIds) {
        this.__acquireSearchFoldersHelper(accountId, spec, metaHelpers, refreshHelpers);
      }
      const toc = new ConversationTOC({
        db: this.db,
        query: this.queryManager.queryAccountMessages(ctx, spec),
        dataOverlayManager: this.dataOverlayManager,
        metaHelpers,
        refreshHelpers,
        onForgotten: () => {
        }
      });
      if (spec.refresh) {
        toc.refresh("searchAllAccountsMessages");
      }
      return ctx.acquire(toc);
    },
    acquireConversationTOC(ctx, conversationId) {
      let toc;
      if (this._conversationTOCs.has(conversationId)) {
        toc = this._conversationTOCs.get(conversationId);
      } else {
        toc = new ConversationTOC({
          db: this.db,
          query: this.queryManager.queryConversationMessages(ctx, {
            conversationId
          }),
          dataOverlayManager: this.dataOverlayManager,
          onForgotten: () => {
            this._conversationTOCs.delete(conversationId);
          }
        });
        this._conversationTOCs.set(conversationId, toc);
      }
      return ctx.acquire(toc);
    },
    acquireSearchConversationMessagesTOC(ctx, spec) {
      let toc = new ConversationTOC({
        db: this.db,
        query: this.queryManager.queryConversationMessages(ctx, spec),
        dataOverlayManager: this.dataOverlayManager,
        onForgotten: () => {
        }
      });
      return ctx.acquire(toc);
    },
    learnAboutAccount(userDetails, why) {
      return this.taskManager.scheduleNonPersistentTaskAndWaitForExecutedResult({
        type: "account_autoconfig",
        userDetails
      }, why);
    },
    tryToCreateAccount(userDetails, domainInfo, why) {
      if (!this.online) {
        return Promise.resolve({ error: "offline" });
      }
      if (domainInfo) {
        return this.taskManager.scheduleNonPersistentTaskAndWaitForExecutedResult({
          type: "account_create",
          userDetails,
          domainInfo
        }, why);
      }
      return this.taskManager.scheduleNonPersistentTaskAndWaitForExecutedResult({
        type: "account_autoconfig",
        userDetails
      }, why).then((result) => {
        if (result.result !== "need-password") {
          return {
            error: result.result,
            errorDetails: null
          };
        }
        return this.taskManager.scheduleNonPersistentTaskAndWaitForExecutedResult({
          type: "account_create",
          userDetails,
          domainInfo: result.configInfo
        }, why);
      });
    },
    deleteAccount(accountId, why) {
      return this.taskManager.scheduleTasksAndWaitForExecutedResult([
        {
          type: "account_delete",
          accountId
        }
      ], why);
    },
    recreateAccount(accountId, why) {
      let accountDef = this.accountManager.getAccountDefById(accountId);
      this.taskManager.scheduleTaskAndWaitForExecutedResult({
        type: "account_delete",
        accountId
      }, why).then(() => {
        this.taskManager.scheduleTasks([
          {
            type: "account_migrate",
            accountDef
          }
        ], why);
      });
    },
    saveAccountDef(accountDef, protoConn) {
      this.db.saveAccountDef(this.config, accountDef);
      if (this.accountsTOC.isKnownAccount(accountDef.id)) {
        this.accountsTOC.accountModified(accountDef);
      } else {
        let accountWireRep = this._accountExists(accountDef);
        if (protoConn) {
          return this._loadAccount(accountDef, this.accountFoldersTOCs.get(accountDef.id), protoConn).then(() => {
            return {
              error: null,
              errorDetails: null,
              accountId: accountDef.id,
              accountWireRep
            };
          });
        }
      }
      return null;
    },
    modifyConfig(mods, why) {
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "config_modify",
        mods
      }, why);
    },
    modifyAccount(accountId, mods, why) {
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "account_modify",
        accountId,
        mods
      }, why);
    },
    modifyIdentity(identityId, mods, why) {
      const accountId = accountIdFromIdentityId(identityId);
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "identity_modify",
        accountId,
        mods
      }, why);
    },
    modifyFolder(accountId, mods, why) {
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "folder_modify",
        accountId,
        mods
      }, why);
    },
    shutdown(callback) {
      var waitCount = this.accounts.length;
      function accountShutdownCompleted() {
        if (--waitCount === 0) {
          callback();
        }
      }
      for (var iAcct = 0; iAcct < this.accounts.length; iAcct++) {
        var account = this.accounts[iAcct];
        account.shutdown(callback ? accountShutdownCompleted : null);
      }
      if (this._cronSync) {
        this._cronSync.shutdown();
      }
      this.db.close();
      if (!this.accounts.length) {
        callback();
      }
    },
    syncFolderList(accountId, why) {
      return this.taskManager.scheduleTaskAndWaitForExecutedResult({
        type: "sync_folder_list",
        accountId
      }, why);
    },
    syncGrowFolder(folderId, why) {
      const accountId = accountIdFromFolderId(folderId);
      return this.taskManager.scheduleTaskAndWaitForExecutedResult({
        type: "sync_grow",
        accountId,
        folderId
      }, why);
    },
    syncRefreshFolder(folderId, why) {
      const accountId = accountIdFromFolderId(folderId);
      return this.taskManager.scheduleTaskAndWaitForExecutedResult({
        type: "sync_refresh",
        accountId,
        folderId
      }, why);
    },
    fetchConversationSnippets(convIds, why) {
      let tasks = convIds.map((convId) => {
        return {
          type: "sync_body",
          accountId: accountIdFromConvId(convId),
          convId,
          amount: "snippet"
        };
      });
      return this.taskManager.scheduleTasks(tasks, why);
    },
    fetchMessageBody(messageId, messageDate, why) {
      return this.taskManager.scheduleTasks([
        {
          type: "sync_body",
          accountId: accountIdFromMessageId(messageId),
          convId: convIdFromMessageId(messageId),
          fullBodyMessageIds: new Set([messageId])
        }
      ], why);
    },
    storeLabels(conversationId, messageIds, messageSelector, addLabels, removeLabels) {
      return this.taskManager.scheduleTaskAndWaitForPlannedUndoTasks({
        type: "store_labels",
        accountId: accountIdFromConvId(conversationId),
        convId: conversationId,
        onlyMessages: messageIds || null,
        messageSelector: messageSelector || null,
        add: addLabels,
        remove: removeLabels
      });
    },
    storeFlags(conversationId, messageIds, messageSelector, addFlags, removeFlags) {
      return this.taskManager.scheduleTaskAndWaitForPlannedUndoTasks({
        type: "store_flags",
        accountId: accountIdFromConvId(conversationId),
        convId: conversationId,
        onlyMessages: messageIds || null,
        messageSelector: messageSelector || null,
        add: addFlags,
        remove: removeFlags
      });
    },
    undo(undoTasks) {
      this.taskManager.scheduleTasks(undoTasks);
    },
    createDraft({ draftType, mode, refMessageId, refMessageDate, folderId }, why) {
      return this.taskManager.scheduleNonPersistentTaskAndWaitForPlannedResult({
        type: "draft_create",
        draftType,
        mode,
        refMessageId,
        refMessageDate,
        folderId
      }, why);
    },
    attachBlobToDraft(messageId, attachmentDef, why) {
      return this.taskManager.scheduleNonPersistentTasks([
        {
          type: "draft_attach",
          accountId: accountIdFromMessageId(messageId),
          messageId,
          attachmentDef
        }
      ], why);
    },
    detachAttachmentFromDraft(messageId, attachmentRelId, why) {
      return this.taskManager.scheduleNonPersistentTasks([
        {
          type: "draft_detach",
          accountId: accountIdFromMessageId(messageId),
          messageId,
          attachmentRelId
        }
      ], why);
    },
    saveDraft(messageId, draftFields, why) {
      return this.taskManager.scheduleTasks([
        {
          type: "draft_save",
          accountId: accountIdFromMessageId(messageId),
          messageId,
          draftFields
        }
      ], why);
    },
    deleteDraft(messageId, why) {
      return this.taskManager.scheduleTasks([
        {
          type: "draft_delete",
          accountId: accountIdFromMessageId(messageId),
          messageId
        }
      ], why);
    },
    outboxSendDraft(messageId, why) {
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "outbox_send",
        command: "send",
        accountId: accountIdFromMessageId(messageId),
        messageId
      }, why);
    },
    outboxAbortSend(messageId) {
      return this.taskManager.scheduleTasks([
        {
          type: "outbox_send",
          command: "abort",
          accountId: accountIdFromMessageId(messageId),
          messageId
        }
      ]);
    },
    outboxSetPaused(accountId, bePaused) {
      return this.taskManager.scheduleTasks([
        {
          type: "outbox_send",
          command: "setPaused",
          accountId,
          pause: bePaused
        }
      ]);
    },
    downloadMessageAttachments({ messageId, messageDate, parts }) {
      return this.taskManager.scheduleTaskAndWaitForPlannedResult({
        type: "download",
        accountId: accountIdFromMessageId(messageId),
        messageId,
        messageDate,
        parts
      });
    },
    clearNewTrackingForAccount({ accountId, silent }) {
      this.taskManager.scheduleTasks([
        {
          type: "new_tracking",
          accountId,
          op: "clear",
          silent
        }
      ]);
    },
    flushNewAggregates() {
      this.taskManager.scheduleTasks([
        {
          type: "new_flush"
        }
      ]);
    },
    notifyOutboxSyncDone(account) {
      this.__notifyBackgroundSendStatus({
        accountId: account.id,
        state: "syncDone"
      });
    },
    createFolder() {
    }
  };

  // src/app_logic/worker_extensions.js
  var worker_extensions_default = [];

  // src/backend/worker-setup.js
  logic.tid = "worker";
  logic.bc = new BroadcastChannel("logic");
  var SCOPE = {};
  logic.defineScope(SCOPE, "WorkerSetup");
  var routerBridgeMaker = registerInstanceType("bridge");
  var nextBridgeUid = 0;
  function createBridgePair(universe2, usePort, uid, cleanupPromise) {
    const TMB = new MailBridge(universe2, universe2.db, uid);
    cleanupPromise.then(() => {
      TMB.shutdown();
    });
    const routerInfo = routerBridgeMaker.register(function(data) {
      TMB.__receiveMessage(data.msg);
    }, usePort);
    const sendMessage = routerInfo.sendMessage;
    TMB.__sendMessage = function(msg) {
      logic(TMB, "send", { type: msg.type, msg });
      sendMessage(null, msg);
    };
    TMB.__sendMessage({
      type: "hello",
      config: universe2.exposeConfigForClient()
    });
  }
  var universe = null;
  var universePromise = null;
  var sendControl = registerSimple("control", async function(data, source, cleanupPromise) {
    var args = data.args;
    switch (data.cmd) {
      case "hello": {
        const bridgeUid = nextBridgeUid++;
        logic(SCOPE, "gotHello", { bridgeUid });
        if (!universe) {
          logic(SCOPE, "creatingUniverse");
          universe = new MailUniverse({
            online: args[0],
            appExtensions: worker_extensions_default
          });
          universePromise = universe.init();
        }
        logic(SCOPE, "awaitingUniverse", { bridgeUid });
        await universePromise;
        logic(SCOPE, "gotUniverse", { bridgeUid });
        createBridgePair(universe, source, bridgeUid, cleanupPromise);
        break;
      }
      case "online":
      case "offline":
        universe._onConnectionChange(args[0]);
        break;
      default:
        break;
    }
  });
  runOnConnect((port) => {
    sendControl("worker-exists", void 0, port);
  });
})();
