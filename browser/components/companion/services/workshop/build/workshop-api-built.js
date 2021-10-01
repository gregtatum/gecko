// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __commonJS = (cb, mod) => function __require() {
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
      var evt2, slice = Array.prototype.slice, props = [
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
        if (evt2._events.hasOwnProperty("error")) {
          evt2.emit("error", err);
        } else {
          console.error(err, err.stack);
        }
      }
      class Emitter14 {
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
          const self = this;
          let fired = false;
          const applyPair = objFnPair(obj, fnName);
          function one() {
            if (fired) {
              return;
            }
            fired = true;
            callApply(applyPair, arguments);
            setTimeout(() => self.removeListener(id, one));
          }
          return this.on(id, applyPair[0], one);
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
        emitWhenListener(id) {
          var listeners2 = this._events[id];
          if (listeners2) {
            this.emit.apply(this, arguments);
          } else {
            if (!this._pendingEvents[id]) {
              this._pendingEvents[id] = [];
            }
            this._pendingEvents[id].push(slice.call(arguments, 1));
          }
        }
        emit(id) {
          var args = slice.call(arguments, 1), listeners2 = this._events[id];
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
      evt2 = new Emitter14();
      evt2.Emitter = Emitter14;
      evt2.mix = function(obj) {
        var e = new Emitter14();
        props.forEach(function(prop) {
          if (obj.hasOwnProperty(prop)) {
            throw new Error('Object already has a property "' + prop + '"');
          }
          obj[prop] = e[prop];
        });
        return obj;
      };
      return evt2;
    });
  }
});

// src/vendor/addressparser.js
var require_addressparser = __commonJS({
  "src/vendor/addressparser.js"(exports, module) {
    (function(root, factory) {
      "use strict";
      if (typeof define === "function" && define.amd) {
        define(factory);
      } else if (typeof exports === "object") {
        module.exports = factory();
      } else {
        root.addressparser = factory();
      }
    })(exports, function() {
      "use strict";
      var addressparser2 = {};
      addressparser2.parse = function(str) {
        var tokenizer = new addressparser2.Tokenizer(str), tokens = tokenizer.tokenize();
        var addresses = [], address = [], parsedAddresses = [];
        tokens.forEach(function(token) {
          if (token.type === "operator" && (token.value === "," || token.value === ";")) {
            if (address.length) {
              addresses.push(address);
            }
            address = [];
          } else {
            address.push(token);
          }
        });
        if (address.length) {
          addresses.push(address);
        }
        addresses.forEach(function(address2) {
          address2 = addressparser2._handleAddress(address2);
          if (address2.length) {
            parsedAddresses = parsedAddresses.concat(address2);
          }
        });
        return parsedAddresses;
      };
      addressparser2._handleAddress = function(tokens) {
        var token, isGroup = false, state = "text", address, addresses = [], data = {
          address: [],
          comment: [],
          group: [],
          text: []
        }, i, len;
        for (i = 0, len = tokens.length; i < len; i++) {
          token = tokens[i];
          if (token.type === "operator") {
            switch (token.value) {
              case "<":
                state = "address";
                break;
              case "(":
                state = "comment";
                break;
              case ":":
                state = "group";
                isGroup = true;
                break;
              default:
                state = "text";
            }
          } else {
            if (token.value) {
              data[state].push(token.value);
            }
          }
        }
        if (!data.text.length && data.comment.length) {
          data.text = data.comment;
          data.comment = [];
        }
        if (isGroup) {
          data.text = data.text.join(" ");
          addresses.push({
            name: data.text || address && address.name,
            group: data.group.length ? addressparser2.parse(data.group.join(",")) : []
          });
        } else {
          if (!data.address.length && data.text.length) {
            for (i = data.text.length - 1; i >= 0; i--) {
              if (data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
                data.address = data.text.splice(i, 1);
                break;
              }
            }
            var _regexHandler = function(address2) {
              if (!data.address.length) {
                data.address = [address2.trim()];
                return " ";
              } else {
                return address2;
              }
            };
            if (!data.address.length) {
              for (i = data.text.length - 1; i >= 0; i--) {
                data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^@\s]+\b\s*/, _regexHandler).trim();
                if (data.address.length) {
                  break;
                }
              }
            }
          }
          if (!data.text.length && data.comment.length) {
            data.text = data.comment;
            data.comment = [];
          }
          if (data.address.length > 1) {
            data.text = data.text.concat(data.address.splice(1));
          }
          data.text = data.text.join(" ");
          data.address = data.address.join(" ");
          if (!data.address && isGroup) {
            return [];
          } else {
            address = {
              address: data.address || data.text || "",
              name: data.text || data.address || ""
            };
            if (address.address === address.name) {
              if ((address.address || "").match(/@/)) {
                address.name = "";
              } else {
                address.address = "";
              }
            }
            addresses.push(address);
          }
        }
        return addresses;
      };
      addressparser2.Tokenizer = function(str) {
        this.str = (str || "").toString();
        this.operatorCurrent = "";
        this.operatorExpecting = "";
        this.node = null;
        this.escaped = false;
        this.list = [];
      };
      addressparser2.Tokenizer.prototype.operators = {
        '"': '"',
        "(": ")",
        "<": ">",
        ",": "",
        ":": ";",
        ";": ""
      };
      addressparser2.Tokenizer.prototype.tokenize = function() {
        var chr, list = [];
        for (var i = 0, len = this.str.length; i < len; i++) {
          chr = this.str.charAt(i);
          this.checkChar(chr);
        }
        this.list.forEach(function(node) {
          node.value = (node.value || "").toString().trim();
          if (node.value) {
            list.push(node);
          }
        });
        return list;
      };
      addressparser2.Tokenizer.prototype.checkChar = function(chr) {
        if ((chr in this.operators || chr === "\\") && this.escaped) {
          this.escaped = false;
        } else if (this.operatorExpecting && chr === this.operatorExpecting) {
          this.node = {
            type: "operator",
            value: chr
          };
          this.list.push(this.node);
          this.node = null;
          this.operatorExpecting = "";
          this.escaped = false;
          return;
        } else if (!this.operatorExpecting && chr in this.operators) {
          this.node = {
            type: "operator",
            value: chr
          };
          this.list.push(this.node);
          this.node = null;
          this.operatorExpecting = this.operators[chr];
          this.escaped = false;
          return;
        }
        if (!this.escaped && chr === "\\") {
          this.escaped = true;
          return;
        }
        if (!this.node) {
          this.node = {
            type: "text",
            value: ""
          };
          this.list.push(this.node);
        }
        if (this.escaped && chr !== "\\") {
          this.node.value += "\\";
        }
        this.node.value += chr;
        this.escaped = false;
      };
      return addressparser2;
    });
  }
});

// src/shared/logic.js
var import_evt = __toModule(require_evt());

// src/vendor/equal.js
var COMPARE_DEPTH = 6;
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

// src/shared/logic.js
function logic() {
  return logic.event.apply(logic, arguments);
}
import_evt.default.mix(logic);
logic.scope = function(namespace, defaultDetails) {
  return new Scope(namespace, defaultDetails);
};
var objectToScope = new WeakMap();
function toScope(scope) {
  if (!(scope instanceof Scope)) {
    scope = objectToScope.get(scope);
    if (!scope) {
      throw new Error("Invalid scope " + scope + " passed to logic.event(); did you remember to call logic.defineScope()? " + new Error().stack);
    }
  }
  return scope;
}
logic.defineScope = function(obj, namespace, defaultDetails) {
  if (!namespace && obj && obj.constructor && obj.constructor.name) {
    namespace = obj.constructor.name;
  }
  var scope = new Scope(namespace, defaultDetails);
  objectToScope.set(obj, scope);
  return scope;
};
logic.subscope = function(scope, defaultDetails) {
  scope = toScope(scope);
  return new Scope(scope.namespace, into(shallowClone(scope.defaultDetails), shallowClone(defaultDetails)));
};
logic.event = function(scope, type, details) {
  scope = toScope(scope);
  var isDefaultPrevented = false;
  var preprocessEvent = {
    scope,
    namespace: scope.namespace,
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
  if (scope.defaultDetails) {
    if (isPlainObject(details)) {
      details = into(shallowClone(scope.defaultDetails), shallowClone(details));
    } else {
      details = shallowClone(scope.defaultDetails);
    }
  } else {
    details = shallowClone(details);
  }
  var event = new LogicEvent(scope, type, details);
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
    dump("logic: " + JSON.stringify(event) + "\n");
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
var nextId = 1;
logic.uniqueId = function() {
  return nextId++;
};
logic.isCensored = false;
logic.realtimeLogEverything = false;
logic.bc = null;
var interceptions = {};
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
function MismatchError(matcher, event) {
  this.matcher = matcher;
  this.event = event;
}
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
function LogicEvent(scope, type, details) {
  if (!(scope instanceof Scope)) {
    throw new Error('Invalid "scope" passed to LogicEvent(); did you remember to call logic.defineScope()?');
  }
  this.scope = scope;
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
logic.isPlainObject = isPlainObject;
var promiseToStartEventMap = new WeakMap();
var promiseToResultEventMap = new WeakMap();
logic.startAsync = function(scope, type, details) {
  var resolve, reject;
  logic.async(scope, type, details, (_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    resolve,
    reject
  };
};
logic.async = function(scope, type, details, fn) {
  if (!fn && typeof details === "function") {
    fn = details;
    details = null;
  }
  scope = logic.subscope(scope, details);
  var startEvent;
  var promise = new Promise((resolve, reject) => {
    startEvent = logic(scope, "begin " + type, {
      asyncStatus: 0,
      asyncName: type
    });
    fn((result) => {
      promiseToResultEventMap.set(promise, logic(scope, type, {
        asyncStatus: 1,
        sourceEventIds: [startEvent.id],
        result
      }));
      resolve(result);
    }, (error) => {
      promiseToResultEventMap.set(promise, logic(scope, type, {
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
logic.await = function(scope, type, details, promise) {
  if (!promise && details.then) {
    promise = details;
    details = null;
  }
  scope = logic.subscope(scope, details);
  var startEvent = promiseToStartEventMap.get(promise);
  var awaitEvent = logic.event(scope, "await " + type, {
    awaitStatus: 0,
    sourceEventIds: startEvent ? [startEvent.id] : null,
    awaitName: type
  });
  return promise.then((result) => {
    var resultEvent = promiseToResultEventMap.get(promise);
    logic(scope, type, {
      awaitStatus: 1,
      result,
      sourceEventIds: resultEvent ? [resultEvent.id, awaitEvent.id] : [awaitEvent.id]
    });
    return result;
  }, (error) => {
    var resultEvent = promiseToResultEventMap.get(promise);
    logic(scope, type, {
      awaitStatus: 2,
      error,
      stack: error && error.stack,
      sourceEventIds: resultEvent ? [resultEvent.id, awaitEvent.id] : [awaitEvent.id]
    });
    throw error;
  });
};
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

// src/clientapi/mailapi.js
var import_addressparser = __toModule(require_addressparser());
var import_evt14 = __toModule(require_evt());

// src/clientapi/mail_folder.js
var import_evt2 = __toModule(require_evt());
var MailFolder = class extends import_evt2.Emitter {
  constructor(api, wireRep, overlays, matchInfo) {
    super();
    this.api = api;
    this.__update(wireRep);
    this.__updateOverlays(overlays);
    this.matchInfo = matchInfo;
  }
  toString() {
    return "[MailFolder: " + this.path + "]";
  }
  toJSON() {
    return {
      type: this.type,
      path: this.path
    };
  }
  __update(wireRep) {
    this._wireRep = wireRep;
    this.localUnreadConversations = wireRep.localUnreadConversations;
    this.localMessageCount = wireRep.localMessageCount;
    let datify = (maybeDate) => maybeDate ? new Date(maybeDate) : null;
    this.lastSuccessfulSyncAt = datify(wireRep.lastSuccessfulSyncAt);
    this.lastAttemptedSyncAt = datify(wireRep.lastAttemptedSyncAt);
    this.path = wireRep.path;
    this.id = wireRep.id;
    this.name = wireRep.name;
    this.path = wireRep.path;
    this.depth = wireRep.depth;
    this.type = wireRep.type;
    this.name = this.api.l10n_folder_name(this.name, this.type);
    let hierarchyOnly = wireRep.type === "account" || wireRep.type === "nomail";
    this.selectable = !hierarchyOnly && !wireRep.engineSaysUnselectable;
    this.neededForHierarchy = hierarchyOnly;
    this.fullySynced = wireRep.fullySynced;
    switch (this.type) {
      case "localdrafts":
      case "outbox":
      case "account":
      case "nomail":
        this.isValidMoveTarget = false;
        break;
      default:
        this.isValidMoveTarget = true;
    }
    this.syncGranularity = wireRep.syncGranularity;
    this.tags = wireRep.tags || [];
  }
  __updateOverlays(overlays) {
    let syncOverlay = overlays.sync_refresh || overlays.sync_grow || {};
    this.syncStatus = syncOverlay.status || null;
    this.syncBlocked = syncOverlay.blocked || null;
  }
  release() {
  }
};

// src/clientapi/mail_conversation.js
var import_evt4 = __toModule(require_evt());

// src/clientapi/mail_peep.js
var import_evt3 = __toModule(require_evt());

// src/clientapi/blob_helpers.js
function revokeImageSrc() {
  var useWin = this.ownerGlobal || window;
  useWin.URL.revokeObjectURL(this.src);
}
function showBlobInImg(imgNode, blob) {
  var useWin = imgNode.ownerGlobal || window;
  imgNode.src = useWin.URL.createObjectURL(blob);
  imgNode.addEventListener("load", revokeImageSrc);
}

// src/clientapi/mail_peep.js
var MailPeep = class extends import_evt3.Emitter {
  constructor(name, address, contactId, thumbnailBlob) {
    super();
    this.name = name;
    this.address = address;
    this.contactId = contactId;
    this._thumbnailBlob = thumbnailBlob;
    this.type = null;
  }
  get isContact() {
    return this.contactId !== null;
  }
  toString() {
    return "[MailPeep: " + this.address + "]";
  }
  toJSON() {
    return {
      name: this.name,
      address: this.address,
      contactId: this.contactId
    };
  }
  toWireRep() {
    return {
      name: this.name,
      address: this.address
    };
  }
  get hasPicture() {
    return this._thumbnailBlob !== null;
  }
  displayPictureInImageTag(imgNode) {
    if (this._thumbnailBlob) {
      showBlobInImg(imgNode, this._thumbnailBlob);
    }
  }
};

// src/clientapi/contact_cache.js
var ContactCache = {
  _contactCache: new Map(),
  _cacheHitEntries: 0,
  _cacheEmptyEntries: 0,
  MAX_CACHE_HITS: 256,
  MAX_CACHE_EMPTY: 1024,
  _livePeepsById: new Map(),
  _livePeepsByEmail: new Map(),
  pendingLookupCount: 0,
  callbacks: [],
  init() {
    const contactsAPI = navigator.mozContacts;
    if (!contactsAPI) {
      return;
    }
    contactsAPI.oncontactchange = this._onContactChange.bind(this);
  },
  _resetCache() {
    this._contactCache.clear();
    this._cacheHitEntries = 0;
    this._cacheEmptyEntries = 0;
  },
  shutdown() {
    const contactsAPI = navigator.mozContacts;
    if (!contactsAPI) {
      return;
    }
    contactsAPI.oncontactchange = null;
  },
  async shoddyAutocomplete(phrase) {
    if (!(phrase instanceof RegExp)) {
      phrase = new RegExp(phrase.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
    }
    let matches = [];
    const MAX_MATCHES = 8;
    for (const peeps of this._livePeepsByEmail.values()) {
      let peep = peeps[0];
      if (peep.name) {
        if (phrase.exec(peep.name)) {
          matches.push(peep);
          if (matches.length >= MAX_MATCHES) {
            break;
          }
          continue;
        }
      }
      if (phrase.exec(peep.address)) {
        matches.push(peep);
        if (matches.length >= MAX_MATCHES) {
          break;
        }
      }
    }
    return matches;
  },
  _onContactChange(event) {
    function cleanOutPeeps(livePeeps) {
      for (const peep of livePeeps) {
        peep.contactId = null;
        peep.emit("change", peep);
      }
    }
    const contactsAPI = navigator.mozContacts;
    const livePeepsById = this._livePeepsById, livePeepsByEmail = this._livePeepsByEmail;
    if (this._cacheHitEntries || this._cacheEmptyEntries) {
      this._resetCache();
    }
    if (event.reason === "remove") {
      if (!event.contactID) {
        for (const livePeeps of livePeepsById.values()) {
          cleanOutPeeps(livePeeps);
        }
        livePeepsById.clear();
      } else {
        const livePeeps = livePeepsById.get(event.contactID);
        if (livePeeps) {
          cleanOutPeeps(livePeeps);
          livePeepsById.delete(event.contactID);
        }
      }
    } else {
      var req = contactsAPI.find({
        filterBy: ["id"],
        filterOp: "equals",
        filterValue: event.contactID
      });
      req.onsuccess = function() {
        if (!req.result.length) {
          return;
        }
        const contact = req.result[0];
        if (event.reason === "update") {
          let livePeeps = livePeepsById.get(contact.id);
          if (livePeeps) {
            var contactEmails = contact.email ? contact.email.map(function(e) {
              return e.value;
            }) : [];
            for (let iPeep = 0; iPeep < livePeeps.length; iPeep++) {
              const peep = livePeeps[iPeep];
              if (!contactEmails.includes(peep.address)) {
                livePeeps.splice(iPeep--, 1);
                peep.contactId = null;
                peep.emit("change", peep);
              }
            }
            if (livePeeps.length === 0) {
              livePeepsById.delete(contact.id);
            }
          }
        }
        if (!contact.email) {
          return;
        }
        for (const emailData of contact.email) {
          const email = emailData.value;
          const livePeeps = livePeepsByEmail.get(email);
          if (!livePeeps) {
            continue;
          }
          for (const peep of livePeeps) {
            if (!peep.contactId) {
              peep.contactId = contact.id;
              let idLivePeeps = livePeepsById.get(peep.contactId);
              if (idLivePeeps === void 0) {
                idLivePeeps = [];
                livePeepsById.set(peep.contactId, idLivePeeps);
              }
              idLivePeeps.push(peep);
            } else if (peep.contactId !== contact.id) {
              continue;
            }
            if (contact.name && contact.name.length) {
              peep.name = contact.name[0];
            }
            peep.emit("change", peep);
          }
        }
      };
    }
  },
  resolvePeeps(addressPairs) {
    if (addressPairs == null) {
      return null;
    }
    const resolved = [];
    for (const addressPair of addressPairs) {
      resolved.push(this.resolvePeep(addressPair));
    }
    return resolved;
  },
  resolvePeep(addressPair) {
    const emailAddress = addressPair.address;
    const entry = this._contactCache.get(emailAddress);
    let peep;
    const contactsAPI = navigator.mozContacts;
    if (entry === null || !contactsAPI) {
      peep = new MailPeep(addressPair.name || "", emailAddress, null, null);
      if (!contactsAPI) {
        return peep;
      }
    } else if (entry !== void 0) {
      let name = addressPair.name || "";
      if (entry.name && entry.name.length) {
        name = entry.name[0];
      }
      peep = new MailPeep(name, emailAddress, entry.id, entry.photo && entry.photo.length ? entry.photo[0] : null);
    } else {
      peep = new MailPeep(addressPair.name || "", emailAddress, null, null);
      this._contactCache.set(emailAddress, null);
      this.pendingLookupCount++;
      const filterValue = emailAddress ? emailAddress.toLowerCase() : "";
      const req = contactsAPI.find({
        filterBy: ["email"],
        filterOp: "equals",
        filterValue
      });
      const self = this, handleResult = function() {
        if (req.result && req.result.length) {
          const contact = req.result[0];
          ContactCache._contactCache.set(emailAddress, contact);
          if (++ContactCache._cacheHitEntries > ContactCache.MAX_CACHE_HITS) {
            self._resetCache();
          }
          const peepsToFixup = self._livePeepsByEmail.get(emailAddress);
          if (!peepsToFixup) {
            return;
          }
          for (const fixupPeep of peepsToFixup) {
            if (!fixupPeep.contactId) {
              fixupPeep.contactId = contact.id;
              let livePeeps2 = self._livePeepsById.get(fixupPeep.contactId);
              if (livePeeps2 === void 0) {
                livePeeps2 = [];
                self._livePeepsById.set(fixupPeep.contactId, livePeeps2);
              }
              livePeeps2.push(fixupPeep);
            }
            if (contact.name && contact.name.length) {
              fixupPeep.name = contact.name[0];
            }
            if (contact.photo && contact.photo.length) {
              fixupPeep._thumbnailBlob = contact.photo[0];
            }
            if (!self.callbacks.length) {
              fixupPeep.emit("change", fixupPeep);
            }
          }
        } else {
          ContactCache._contactCache.set(emailAddress, null);
          if (++ContactCache._cacheEmptyEntries > ContactCache.MAX_CACHE_EMPTY) {
            self._resetCache();
          }
        }
        if (--self.pendingLookupCount === 0) {
          for (const callback of ContactCache.callbacks) {
            callback();
          }
          ContactCache.callbacks.splice(0, ContactCache.callbacks.length);
        }
      };
      req.onsuccess = handleResult;
      req.onerror = handleResult;
    }
    let livePeeps;
    livePeeps = this._livePeepsByEmail.get(emailAddress);
    if (livePeeps === void 0) {
      livePeeps = [];
      this._livePeepsByEmail.set(emailAddress, livePeeps);
    }
    livePeeps.push(peep);
    if (peep.contactId) {
      livePeeps = this._livePeepsById.get(peep.contactId);
      if (livePeeps === void 0) {
        livePeeps = [];
        this._livePeepsById.set(peep.contactId, livePeeps);
      }
      livePeeps.push(peep);
    }
    return peep;
  },
  forgetPeepInstances() {
    const livePeepsById = this._livePeepsById, livePeepsByEmail = this._livePeepsByEmail;
    for (const peeps of arguments) {
      if (!peeps) {
        continue;
      }
      for (const peep of peeps) {
        let livePeeps, idx;
        if (peep.contactId) {
          livePeeps = livePeepsById.get(peep.contactId);
          if (livePeeps) {
            idx = livePeeps.indexOf(peep);
            if (idx !== -1) {
              livePeeps.splice(idx, 1);
              if (livePeeps.length === 0) {
                livePeepsById.delete(peep.contactId);
              }
            }
          }
        }
        livePeeps = livePeepsByEmail.get(peep.address);
        if (livePeeps) {
          idx = livePeeps.indexOf(peep);
          if (idx !== -1) {
            livePeeps.splice(idx, 1);
            if (livePeeps.length === 0) {
              livePeepsByEmail.delete(peep.address);
            }
          }
        }
      }
    }
  }
};

// src/shared/a64.js
var ORDERED_ARBITRARY_BASE64_CHARS = [
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
var ZERO_PADDING = "0000000000000000";
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
var E10_14_RSH_14 = Math.pow(10, 14) / Math.pow(2, 14);
var P2_14 = Math.pow(2, 14);
var P2_22 = Math.pow(2, 22);
var P2_36 = Math.pow(2, 36);

// src/shared/id_conversions.js
function accountIdFromFolderId(folderId) {
  return folderId.split(/\./g, 1)[0];
}
function accountIdFromConvId(convId) {
  return convId.split(/\./g, 1)[0];
}
function accountIdFromMessageId(messageId) {
  return messageId.split(/\./g, 1)[0];
}
function convIdFromMessageId(messageId) {
  let idxFirst = messageId.indexOf(".");
  let idxSecond = messageId.indexOf(".", idxFirst + 1);
  return messageId.substring(0, idxSecond);
}

// src/app_logic/conv_client_cleanup.js
function cleanupConversation(mailConversation) {
  let tidbitPeeps = mailConversation.messageTidbits.map((x) => x.author);
  ContactCache.forgetPeepInstances(tidbitPeeps);
}

// src/app_logic/conv_client_decorator.js
function decorateConversation(mailConversation, wireRep, firstTime) {
  if (!firstTime) {
    cleanupConversation(mailConversation);
  }
  mailConversation.messageTidbits = wireRep.app.tidbits.map((tidbit) => {
    return {
      id: tidbit.id,
      date: new Date(tidbit.date),
      isRead: tidbit.isRead,
      isStarred: tidbit.isStarred,
      author: ContactCache.resolvePeep(tidbit.author),
      parentIndex: tidbit.parent
    };
  });
  if (wireRep.app.patchInfo) {
    mailConversation.drevInfo = wireRep.app.drevInfo;
    mailConversation.patchInfo = wireRep.app.patchInfo;
  }
}

// src/clientapi/mail_conversation.js
var MailConversation = class extends import_evt4.Emitter {
  constructor(api, wireRep, overlays, matchInfo, slice, handle) {
    super();
    this._api = api;
    this._slice = slice;
    this._handle = handle;
    this._wireRep = wireRep;
    this.id = wireRep.id;
    this.convType = wireRep.convType;
    this.__update(wireRep, true);
    this.matchInfo = matchInfo;
  }
  toString() {
    return "[MailConversation: " + this.id + "]";
  }
  toJSON() {
    return {
      type: "MailConversation",
      id: this.id
    };
  }
  viewMessages() {
    return this._api.viewConversationMessages(this);
  }
  getKnownLabels() {
    let accountId = accountIdFromConvId(this.id);
    let account = this._api.accounts.getAccountById(accountId);
    return account.folders.items.concat();
  }
  archive() {
    let accountId = accountIdFromConvId(this.id);
    let account = this._api.accounts.getAccountById(accountId);
    let inboxFolder = account.foldes.getFirstFolderWithType("inbox");
    return this.removeLabels([inboxFolder]);
  }
  addLabels(folders) {
    return this._api.modifyLabels([this], { addLabels: folders });
  }
  removeLabels(folders) {
    return this._api.modifyLabels([this], { removeLabels: folders });
  }
  modifyLabels(args) {
    return this._api.modifyLabels([this], args);
  }
  modifyTags(args) {
    return this._api.modifyTags([this], args);
  }
  get isStarred() {
    return this.hasStarred;
  }
  setStarred(beStarred) {
    return this._api.markStarred([this], beStarred);
  }
  toggleStarred() {
    this.setStarred(!this.hasStarred);
  }
  get isRead() {
    return !this.hasUnread;
  }
  setRead(beRead) {
    return this._api.markRead([this], beRead);
  }
  toggleRead() {
    this.setRead(!this.isRead);
  }
  __update(wireRep, firstTime) {
    this._wireRep = wireRep;
    this.height = wireRep.height;
    this.mostRecentMessageDate = new Date(wireRep.date);
    this.firstSubject = wireRep.subject;
    this.messageCount = wireRep.messageCount;
    this.snippetCount = wireRep.snippetCount;
    this.authors = ContactCache.resolvePeeps(wireRep.authors);
    decorateConversation(this, wireRep, firstTime);
    this.labels = this._api._mapLabels(this.id, wireRep.folderIds);
    this.hasUnread = wireRep.hasUnread;
    this.hasStarred = wireRep.hasStarred;
    this.hasDrafts = wireRep.hasDrafts;
    this.hasAttachments = wireRep.hasAttachments;
  }
  __updateOverlays() {
  }
  release() {
    ContactCache.forgetPeepInstances(this.authors);
    cleanupConversation(this);
    if (this._handle) {
      this._api._cleanupContext(this._handle);
      this._handle = null;
    }
  }
};

// src/clientapi/mail_message.js
var import_evt6 = __toModule(require_evt());

// src/clientapi/mail_attachment.js
var import_evt5 = __toModule(require_evt());
var MailAttachment = class extends import_evt5.Emitter {
  constructor(_message, wireRep) {
    super();
    this._message = _message;
    this.id = _message.id + "." + wireRep.relId;
    this.relId = wireRep.relId;
    this.partId = wireRep.part;
    this.__update(wireRep);
    this.__updateDownloadOverlay(null);
  }
  toString() {
    return '[MailAttachment: "' + this.filename + '"]';
  }
  toJSON() {
    return {
      type: "MailAttachment",
      filename: this.filename
    };
  }
  __update(wireRep) {
    this.filename = wireRep.name;
    this.mimetype = wireRep.type;
    this.sizeEstimateInBytes = wireRep.sizeEstimate;
    this._downloadState = wireRep.downloadState;
    this._file = wireRep.file;
  }
  __updateDownloadOverlay(info) {
    if (info) {
      this._overlayDownloadStatus = info.status;
      this.bytesDownloaded = info.bytesDownloaded;
    } else {
      this.downloadStatus = null;
      this.bytesDownloaded = 0;
    }
  }
  get downloadState() {
    return this._downloadState || this._overlayDownloadStatus;
  }
  get isDownloading() {
    return !!this._overlayDownloadStatus;
  }
  get isDownloaded() {
    return (this._downloadState === "cached" || this._downloadState === "saved") && this._file;
  }
  get isDownloadable() {
    return this.mimetype !== "application/x-gelam-no-download" && this._downloadState !== "draft";
  }
  download(opts) {
    let downloadTarget = opts && opts.downloadTarget || "save";
    return this._message._api._downloadAttachments({
      messageId: this._message.id,
      messageDate: this._message.date.valueOf(),
      parts: new Map([[this.relId, downloadTarget]])
    });
  }
  getDownloadedBlob() {
    if (!this.isDownloaded) {
      return Promise.reject();
    }
    if (this._downloadState === "cached") {
      return Promise.resolve(this._file);
    }
    return new Promise((resolve, reject) => {
      try {
        const storageType = this._file[0];
        const filename = this._file[1];
        const storage = navigator.getDeviceStorage(storageType);
        const getreq = storage.get(filename);
        getreq.onerror = function() {
          reject(getreq.error);
          console.warn("Could not open attachment file: ", filename, getreq.error.name);
        };
        getreq.onsuccess = function() {
          resolve(getreq.result);
        };
      } catch (ex) {
        console.warn("Exception getting attachment from device storage:", ex, "\n", ex.stack);
        reject(ex);
      }
    });
  }
};

// src/clientapi/keyed_list_helper.js
function keyedListHelper({
  wireReps,
  existingRichReps,
  constructor,
  owner,
  idKey,
  addEvent,
  changeEvent,
  removeEvent
}) {
  const pendingRichMap = new Map();
  for (const richRep of existingRichReps) {
    pendingRichMap.set(richRep[idKey], richRep);
  }
  const updatedList = [];
  for (const wireRep of wireReps) {
    let richRep = pendingRichMap.get(wireRep[idKey]);
    if (richRep) {
      richRep.__update(wireRep);
      pendingRichMap.delete(wireRep[idKey]);
      richRep.emit("change", richRep);
      if (changeEvent) {
        owner.emit(changeEvent, richRep);
      }
    } else {
      richRep = new constructor(owner, wireRep);
      if (addEvent) {
        owner.emit(addEvent, richRep);
      }
    }
    updatedList.push(richRep);
  }
  for (const richRep of existingRichReps) {
    richRep.emit("remove", richRep);
    if (removeEvent) {
      owner.emit(removeEvent, richRep);
    }
  }
  return updatedList;
}

// src/clientapi/mail_message.js
function filterOutBuiltinFlags(flags) {
  const outFlags = [];
  for (var i = flags.length - 1; i >= 0; i--) {
    if (flags[i][0] !== "\\") {
      outFlags.push(flags[i]);
    }
  }
  return outFlags;
}
var MailMessage = class extends import_evt6.Emitter {
  constructor(api, wireRep, overlays, matchInfo, slice) {
    super();
    this._api = api;
    this._slice = slice;
    this._wireRep = wireRep;
    this.id = wireRep.id;
    this.guid = wireRep.guid;
    this.author = ContactCache.resolvePeep(wireRep.author);
    this.to = ContactCache.resolvePeeps(wireRep.to);
    this.cc = ContactCache.resolvePeeps(wireRep.cc);
    this.bcc = ContactCache.resolvePeeps(wireRep.bcc);
    this.replyTo = wireRep.replyTo;
    this._relatedParts = wireRep.relatedParts;
    this.bodyReps = wireRep.bodyReps;
    this._references = wireRep.references;
    this.attachments = [];
    this.__update(wireRep);
    this.__updateOverlays(overlays);
    this.hasAttachments = wireRep.hasAttachments;
    this.subject = wireRep.subject;
    this.snippet = wireRep.snippet;
    this.matchInfo = matchInfo;
    this.type = "msg";
  }
  toString() {
    return "[MailMessage: " + this.id + "]";
  }
  toJSON() {
    return {
      type: "MailMessage",
      id: this.id
    };
  }
  __update(wireRep) {
    this._wireRep = wireRep;
    if (wireRep.snippet !== null) {
      this.snippet = wireRep.snippet;
    }
    this.date = new Date(wireRep.date);
    this.isRead = wireRep.flags.includes("\\Seen");
    this.isStarred = wireRep.flags.includes("\\Flagged");
    this.isRepliedTo = wireRep.flags.includes("\\Answered");
    this.isForwarded = wireRep.flags.includes("$Forwarded");
    this.isJunk = wireRep.flags.includes("$Junk");
    this.isDraft = wireRep.draftInfo !== null;
    this.isServerDraft = wireRep.flags.includes("\\Draft");
    this.tags = filterOutBuiltinFlags(wireRep.flags);
    this.labels = this._api._mapLabels(this.id, wireRep.folderIds);
    this.sendProblems = wireRep.draftInfo && wireRep.draftInfo.sendProblems || {};
    this._relatedParts = wireRep.relatedParts;
    this.bodyReps = wireRep.bodyReps;
    this.attachments = keyedListHelper({
      wireReps: wireRep.attachments,
      existingRichReps: this.attachments,
      constructor: MailAttachment,
      owner: this,
      idKey: "relId",
      addEvent: "attachment:add",
      changeEvent: "attachment:change",
      removeEvent: "attachment:remove"
    });
  }
  __updateOverlays(overlays) {
    const downloadMap = overlays.download;
    for (const attachment of this.attachments) {
      const downloadOverlay = downloadMap && downloadMap.get(attachment.relId);
      attachment.__updateDownloadOverlay(downloadOverlay);
      attachment.emit("change");
    }
    this.isDownloadingEmbeddedImages = downloadMap && downloadMap.keys().some((relId) => relId[0] === "r");
  }
  release() {
    ContactCache.forgetPeepInstances([this.author], this.to, this.cc, this.bcc);
  }
  archiveFromInbox() {
    const curInboxFolders = this.labels.filter((folder) => folder.type === "inbox");
    if (curInboxFolders.length) {
      return this.modifyLabels({ removeLabels: curInboxFolders });
    }
    return null;
  }
  trash() {
    return this._api.trash([this]);
  }
  move(targetFolder) {
    return this._api.move([this], targetFolder);
  }
  setRead(beRead) {
    return this._api.markRead([this], beRead);
  }
  toggleRead() {
    return this.setRead(!this.isRead);
  }
  setStarred(beStarred) {
    return this._api.markStarred([this], beStarred);
  }
  toggleStarred() {
    return this.setStarred(!this.isStarred);
  }
  modifyTags(args) {
    return this._api.modifyTags([this], args);
  }
  modifyLabels(args) {
    return this._api.modifyLabels([this], args);
  }
  get bytesToDownloadForBodyDisplay() {
    return this._wireRep.bytesToDownloadForBodyDisplay || 0;
  }
  editAsDraft() {
    if (!this.isDraft) {
      throw new Error("Nice try, but I am not a magical localdraft.");
    }
    return this._api.resumeMessageComposition(this);
  }
  replyToMessage(replyMode, options) {
    return this._slice._api.beginMessageComposition(this, null, {
      command: "reply",
      mode: replyMode,
      noComposer: options && options.noComposer
    });
  }
  forwardMessage(forwardMode, options) {
    return this._slice._api.beginMessageComposition(this, null, {
      command: "forward",
      mode: forwardMode,
      noComposer: options && options.noComposer
    });
  }
  get embeddedImageCount() {
    return this.relatedParts?.length || 0;
  }
  downloadBodyReps() {
    this._api._downloadBodyReps(this.id, this.date.valueOf());
  }
  get bodyRepsDownloaded() {
    return this.bodyReps.every((bodyRep) => bodyRep.isDownloaded);
  }
  get embeddedImagesDownloaded() {
    return this._relatedParts.every((relatedPart) => relatedPart.file);
  }
  async downloadEmbeddedImages() {
    const relatedPartRelIds = [];
    for (const relatedPart of this._relatedParts) {
      if (relatedPart.file) {
        continue;
      }
      relatedPartRelIds.push(relatedPart.relId);
    }
    if (!relatedPartRelIds.length) {
      return null;
    }
    return this._api._downloadAttachments({
      messageId: this.id,
      messageDate: this.date.valueOf(),
      relatedPartRelIds,
      attachmentRelIds: null
    });
  }
  showEmbeddedImages(htmlNode, loadCallback) {
    const cidToBlob = new Map();
    for (const { file, contentId } of this._relatedParts) {
      if (file && !Array.isArray(file)) {
        cidToBlob.set(contentId, file);
      }
    }
    const nodes = htmlNode.querySelectorAll(".moz-embedded-image");
    for (const node of nodes) {
      const cid = node.getAttribute("cid-src");
      if (!cidToBlob.has(cid)) {
        continue;
      }
      showBlobInImg(node, cidToBlob.get(cid));
      if (loadCallback) {
        node.addEventListener("load", loadCallback);
      }
      node.removeAttribute("cid-src");
      node.classList.remove("moz-embedded-image");
    }
  }
  checkForExternalImages(htmlNode) {
    const someNode = htmlNode.querySelector(".moz-external-image");
    return someNode !== null;
  }
  showExternalImages(htmlNode, loadCallback) {
    const nodes = htmlNode.querySelectorAll(".moz-external-image");
    for (const node of nodes) {
      if (loadCallback) {
        node.addEventListener("load", loadCallback);
      }
      node.setAttribute("src", node.getAttribute("ext-src"));
      node.removeAttribute("ext-src");
      node.classList.remove("moz-external-image");
    }
  }
};

// src/clientapi/undoable_operation.js
var UndoableOperation = class {
  constructor({
    api,
    id,
    operation,
    affectedCount,
    affectedType,
    undoableTasksPromise
  }) {
    this._api = api;
    this.id = id;
    this.operation = operation;
    this.affectedCount = affectedCount;
    this.affectedType = affectedType;
    this._undoableTasksPromise = undoableTasksPromise;
    this._undoRequested = false;
  }
  toString() {
    return "[UndoableOperation]";
  }
  toJSON() {
    return {
      type: "UndoableOperation",
      affectedType: this.affectedType,
      affectedCount: this.affectedCount
    };
  }
  undo() {
    if (!this._undoableTasksPromise) {
      return;
    }
    this._undoableTasksPromise.then((undoTasks) => {
      this._api.__scheduleUndoTasks(this, undoTasks);
    });
    this._undoableTasksPromise = null;
    if (!this._longtermIds) {
      this._undoRequested = true;
    }
  }
};

// src/clientapi/entire_list_view.js
var import_evt7 = __toModule(require_evt());
var EntireListView = class extends import_evt7.Emitter {
  constructor(api, itemConstructor, handle) {
    super();
    this._api = api;
    this._itemConstructor = itemConstructor;
    this.handle = handle;
    this.serial = 0;
    this.items = [];
    this.itemsById = new Map();
    this.complete = false;
    this.viewKind = "entire";
  }
  toString() {
    return "[EntireListView: " + this._ns + " " + this.handle + "]";
  }
  toJSON() {
    return {
      type: "EntireListView",
      namespace: this._ns,
      handle: this.handle
    };
  }
  __update(details) {
    let newSerial = ++this.serial;
    for (let change of details.changes) {
      if (change.type === "add") {
        let obj = new this._itemConstructor(this._api, change.state, change.overlays, change.matchInfo, this);
        obj.serial = newSerial;
        this.items.splice(change.index, 0, obj);
        this.emit("add", obj, change.index);
      } else if (change.type === "change") {
        let obj = this.items[change.index];
        obj.serial = newSerial;
        if (change.state) {
          obj.__update(change.state);
        }
        if (change.overlays) {
          obj.__updateOverlays(change.overlays);
        }
        this.emit("change", obj, change.index, !!change.state, !!change.overlays);
        obj.emit("change", !!change.state, !!change.overlays);
      } else if (change.type === "remove") {
        let obj = this.items[change.index];
        this.items.splice(change.index, 1);
        this.emit("remove", obj, change.index);
      }
    }
    this.complete = true;
    this.emit("complete", this);
  }
  release() {
    this._api.__bridgeSend({
      type: "cleanupContext",
      handle: this.handle
    });
    for (const item of this.items) {
      item.release();
    }
  }
};

// src/clientapi/mail_account.js
var import_evt8 = __toModule(require_evt());

// src/clientapi/mail_sender_identity.js
var MailSenderIdentity = class {
  constructor(api, wireRep) {
    this._api = api;
    this.id = wireRep.id;
    this.name = wireRep.name;
    this.address = wireRep.address;
    this.replyTo = wireRep.replyTo;
    this.signature = wireRep.signature;
    this.signatureEnabled = wireRep.signatureEnabled;
  }
  toString() {
    return "[MailSenderIdentity: " + this.type + " " + this.id + "]";
  }
  toJSON() {
    return { type: "MailSenderIdentity" };
  }
  __update(wireRep) {
    this.id = wireRep.id;
    this.name = wireRep.name;
    this.address = wireRep.address;
    this.replyTo = wireRep.replyTo;
    this.signature = wireRep.signature;
    this.signatureEnabled = wireRep.signatureEnabled;
  }
  modifyIdentity(mods) {
    if (typeof mods.signature !== "undefined") {
      this.signature = mods.signature;
    }
    if (typeof mods.signatureEnabled !== "undefined") {
      this.signatureEnabled = mods.signatureEnabled;
    }
    return this._api._modifyIdentity(this, mods);
  }
  release() {
  }
};

// src/clientapi/mail_account.js
var MailAccount = class extends import_evt8.Emitter {
  constructor(api, wireRep, overlays, matchInfo, acctsSlice) {
    super();
    this._api = api;
    this.id = wireRep.id;
    this.matchInfo = matchInfo;
    this._wireRep = wireRep;
    this.acctsSlice = acctsSlice;
    this.type = wireRep.type;
    this.name = wireRep.name;
    this.syncRange = wireRep.syncRange;
    this.syncInterval = wireRep.syncInterval;
    this.notifyOnNew = wireRep.notifyOnNew;
    this.playSoundOnSend = wireRep.playSoundOnSend;
    this.enabled = wireRep.enabled;
    this.problems = wireRep.problems;
    this.identities = wireRep.identities.map((id) => new MailSenderIdentity(this._api, id));
    this.username = wireRep.credentials.username;
    this.servers = wireRep.servers;
    this.authMechanism = wireRep.credentials.oauth2 ? "oauth2" : "password";
    this.folders = null;
    if (acctsSlice && acctsSlice._autoViewFolders) {
      this.folders = api.viewFolders("account", this.id);
    }
    this.__updateOverlays(overlays);
  }
  toString() {
    return "[MailAccount: " + this.type + " " + this.id + "]";
  }
  toJSON() {
    return {
      type: "MailAccount",
      accountType: this.type,
      id: this.id
    };
  }
  __update(wireRep) {
    this._wireRep = wireRep;
    this.enabled = wireRep.enabled;
    this.problems = wireRep.problems;
    this.syncRange = wireRep.syncRange;
    this.syncInterval = wireRep.syncInterval;
    this.notifyOnNew = wireRep.notifyOnNew;
    this.playSoundOnSend = wireRep.playSoundOnSend;
    for (let i = 0; i < wireRep.identities.length; i++) {
      if (this.identities[i]) {
        this.identities[i].__update(wireRep.identities[i]);
      } else {
        this.identities.push(new MailSenderIdentity(this._api, wireRep.identities[i]));
      }
    }
  }
  __updateOverlays(overlays) {
    this.syncStatus = overlays.sync_refresh ? overlays.sync_refresh : null;
  }
  release() {
  }
  clearProblems(callback) {
    this._api._clearAccountProblems(this, callback);
  }
  modifyAccount(mods) {
    return this._api._modifyAccount(this, mods);
  }
  async modifyFolder(mods) {
    return this._api._modifyFolder(this, mods);
  }
  recreateAccount() {
    this._api._recreateAccount(this);
  }
  deleteAccount() {
    this._api._deleteAccount(this);
  }
  syncFolderList() {
    this._api.__bridgeSend({
      type: "syncFolderList",
      accountId: this.id
    });
  }
  clearNewTracking(opts) {
    this._api.clearNewTrackingForAccount({
      accountId: this.id,
      silent: opts && opts.silent || false
    });
  }
  get isDefault() {
    if (!this.acctsSlice) {
      throw new Error("No account slice available");
    }
    return this.acctsSlice.defaultAccount === this;
  }
};

// src/clientapi/accounts_list_view.js
var AccountsListView = class extends EntireListView {
  constructor(api, handle, opts) {
    super(api, MailAccount, handle);
    this._autoViewFolders = opts && opts.autoViewFolders || false;
  }
  getAccountById(id) {
    return this.items.find((item) => item.id === id) || null;
  }
  eventuallyGetAccountById(id) {
    return new Promise((resolve, reject) => {
      const existingAccount = this.getAccountById(id);
      if (existingAccount) {
        resolve(existingAccount);
        return;
      }
      const addListener = (account) => {
        if (account.id === id) {
          this.removeListener("add", addListener);
          resolve(account);
        }
      };
      this.on("add", addListener);
    });
  }
  get defaultAccount() {
    const items = this.items;
    let defaultAccount = items[0];
    for (let i = 1; i < items.length; i++) {
      if ((items[i]._wireRep.defaultPriority || 0) > (defaultAccount._wireRep.defaultPriority || 0)) {
        defaultAccount = items[i];
      }
    }
    return defaultAccount;
  }
};

// src/clientapi/folders_list_view.js
var FoldersListView = class extends EntireListView {
  constructor(api, handle) {
    super(api, MailFolder, handle);
    this.inbox = null;
    const inboxListener = (mailFolder) => {
      if (mailFolder.type === "inbox") {
        this.inbox = mailFolder;
        this.removeListener("add", inboxListener);
        this.emit("inbox", mailFolder);
      }
    };
    this.on("add", inboxListener);
  }
  getFolderById(id) {
    return this.items.find((folder) => folder.id === id) || null;
  }
  eventuallyGetFolderById(id) {
    return new Promise((resolve, reject) => {
      const existingFolder = this.getFolderById(id);
      if (existingFolder) {
        resolve(existingFolder);
        return;
      }
      if (this.complete) {
        reject("already complete");
        return;
      }
      const addListener = (folder) => {
        if (folder.id === id) {
          this.removeListener("add", addListener);
          resolve(folder);
        }
      };
      const completeListener = () => {
        this.removeListener("add", addListener);
        this.removeListener("complete", completeListener);
        reject("async complete");
      };
      this.on("add", addListener);
      this.on("complete", completeListener);
    });
  }
  getFirstFolderWithType(type, items) {
    return (items || this.items).find((folder) => folder.type === type) || null;
  }
  getFirstFolderWithName(name, items) {
    return (items || this.items).find((folder) => folder.name === name) || null;
  }
  getFirstFolderWithPath(path, items) {
    return (items || this.items).find((folder) => folder.path === path) || null;
  }
};

// src/clientapi/windowed_list_view.js
var import_evt9 = __toModule(require_evt());
var WindowedListView = class extends import_evt9.Emitter {
  constructor(api, itemConstructor, handle) {
    super();
    this._api = api;
    this.handle = handle;
    this._itemConstructor = itemConstructor;
    this.released = false;
    this.serial = 0;
    this.tocMetaSerial = 0;
    this.offset = 0;
    this.heightOffset = 0;
    this.totalCount = 0;
    this.totalHeight = 0;
    this.items = [];
    this._itemsById = new Map();
    this.tocMeta = {};
    this.complete = false;
    this.viewKind = "windowed";
  }
  toString() {
    return "[WindowedListView: " + this._itemConstructor.name + " " + this.handle + "]";
  }
  toJSON() {
    return {
      type: "WindowedListView",
      namespace: this._ns,
      handle: this.handle
    };
  }
  __update(details) {
    let newSerial = ++this.serial;
    let existingSet = this._itemsById;
    let newSet = new Map();
    let newIds = details.ids;
    let newStates = details.values;
    let newItems = [];
    let itemSetChanged = newIds.length !== this.items.length;
    let contentsChanged = false;
    for (const id of newIds) {
      let obj;
      if (existingSet.has(id)) {
        obj = existingSet.get(id);
        if (newStates.has(id)) {
          let [newState, newOverlays] = newStates.get(id);
          contentsChanged = true;
          obj.serial = newSerial;
          if (newState) {
            obj.__update(newState);
          }
          if (newOverlays) {
            obj.__updateOverlays(newOverlays);
          }
          obj.emit("change", !!newState, !!newOverlays);
        }
        existingSet.delete(id);
        newSet.set(id, obj);
      } else if (newStates.has(id)) {
        itemSetChanged = true;
        let [newState, newOverlays, matchInfo] = newStates.get(id);
        obj = new this._itemConstructor(this._api, newState, newOverlays, matchInfo, this);
        obj.serial = newSerial;
        newSet.set(id, obj);
      } else {
        obj = null;
      }
      newItems.push(obj);
    }
    for (const deadObj of existingSet.values()) {
      itemSetChanged = true;
      deadObj.release();
    }
    const whatChanged = {
      offset: details.offset !== this.offset,
      totalCount: details.totalCount !== this.totalCount,
      itemSet: itemSetChanged,
      itemContents: contentsChanged
    };
    this.offset = details.offset;
    this.heightOffset = details.heightOffset;
    this.totalCount = details.totalCount;
    this.totalHeight = details.totalHeight;
    this.items = newItems;
    this._itemsById = newSet;
    if (details.tocMeta) {
      this.tocMeta = details.tocMeta;
      this.tocMetaSerial++;
      this.emit("metaChange", this.tocMeta);
    }
    this.emit("seeked", whatChanged);
    if (details.events) {
      for (const { name, data } of details.events) {
        this.emit(name, data);
      }
    }
  }
  get atTop() {
    return this.offset === 0;
  }
  get atBottom() {
    return this.totalCount === this.offset + this.items.length;
  }
  getItemByAbsoluteIndex(absIndex) {
    let relIndex = absIndex - this.offset;
    if (relIndex < 0 || relIndex >= this.items.length) {
      return null;
    }
    return this.items[relIndex];
  }
  seekToTop(visibleDesired, bufferDesired) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "top",
      visibleDesired,
      bufferDesired
    });
  }
  seekFocusedOnItem(item, bufferAbove, visibleAbove, visibleBelow, bufferBelow) {
    let idx = this.items.indexOf(item);
    if (idx === -1) {
      throw new Error("item is not in list");
    }
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "focus",
      focusKey: this._makeOrderingKeyFromItem(item),
      bufferAbove,
      visibleAbove,
      visibleBelow,
      bufferBelow
    });
  }
  seekFocusedOnAbsoluteIndex(index, bufferAbove, visibleAbove, visibleBelow, bufferBelow) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "focusIndex",
      index,
      bufferAbove,
      visibleAbove,
      visibleBelow,
      bufferBelow
    });
  }
  seekToBottom(visibleDesired, bufferDesired) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "bottom",
      visibleDesired,
      bufferDesired
    });
  }
  seekInCoordinateSpace(offset, before, visible, after) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "coordinates",
      offset,
      before,
      visible,
      after
    });
  }
  release() {
    if (this.released) {
      return;
    }
    this.released = true;
    this._api.__bridgeSend({
      type: "cleanupContext",
      handle: this.handle
    });
    for (const item of this.items) {
      if (item) {
        item.release();
      }
    }
  }
};

// src/clientapi/conversations_list_view.js
var ConversationsListView = class extends WindowedListView {
  constructor(api, handle) {
    super(api, MailConversation, handle);
    this.syncRequested = false;
    this.on("syncComplete", (data) => {
      data.thisViewTriggered = this.syncRequested;
      this.syncRequested = false;
    });
  }
  _makeOrderingKeyFromItem(item) {
    return {
      date: item.mostRecentMessageDate.valueOf(),
      id: item.id
    };
  }
  refresh() {
    this.syncRequested = true;
    this._api.__bridgeSend({
      type: "refreshView",
      handle: this.handle
    });
  }
  grow() {
    this.syncRequested = true;
    this._api.__bridgeSend({
      type: "growView",
      handle: this.handle
    });
  }
  ensureSnippets(idxStart, idxEnd) {
    if (idxStart === void 0) {
      idxStart = 0;
    }
    if (idxEnd === void 0) {
      idxEnd = this.items.length - 1;
    }
    let convIds = [];
    for (let i = idxStart; i <= idxEnd; i++) {
      let convInfo = this.items[i];
      if (!convInfo) {
        continue;
      }
      if (convInfo.snippetCount < convInfo.messageCount) {
        convIds.push(convInfo.id);
      }
    }
    if (!convIds.length) {
      return false;
    }
    this._api.__bridgeSend({
      type: "fetchSnippets",
      convIds
    });
    return true;
  }
};

// src/clientapi/messages_list_view.js
var MessagesListView = class extends WindowedListView {
  constructor(api, handle) {
    super(api, MailMessage, handle);
    this._nextSnippetRequestValidAt = 0;
  }
  ensureSnippets() {
    const snippetsNeeded = this.items.some((message) => {
      return message && message.snippet === null;
    });
    if (snippetsNeeded) {
      if (this._nextSnippetRequestValidAt > Date.now()) {
        return;
      }
      this._nextSnippetRequestValidAt = Date.now() + 5e3;
      this._api.__bridgeSend({
        type: "fetchSnippets",
        convIds: [this.conversationId]
      });
    }
  }
  refresh() {
    this._api.__bridgeSend({
      type: "refreshView",
      handle: this.handle
    });
  }
};

// src/clientapi/raw_item.js
var import_evt10 = __toModule(require_evt());
var RawItem = class extends import_evt10.Emitter {
  constructor(api, wireRep, overlays, matchInfo) {
    super();
    this.id = wireRep.id || wireRep._id;
    this.__update(wireRep);
    this.__updateOverlays(overlays);
    this.matchInfo = matchInfo;
  }
  toString() {
    return "[RawItem]";
  }
  toJSON() {
    return {
      data: this.data
    };
  }
  __update(wireRep) {
    this.data = wireRep;
  }
  __updateOverlays() {
  }
  release() {
  }
};

// src/clientapi/raw_list_view.js
var RawListView = class extends WindowedListView {
  constructor(api, handle) {
    super(api, RawItem, handle);
  }
};

// src/clientapi/message_composition.js
var import_evt11 = __toModule(require_evt());
function bruteForceAttachmentId(existingAttachments) {
  let existingIds = new Set();
  for (let att of existingAttachments) {
    existingIds.add(att.relId);
  }
  let ival = existingAttachments.length;
  let probeStep = 1;
  let relId;
  do {
    relId = encodeInt(ival);
    ival += probeStep;
    probeStep = 1 + Math.floor(Math.random() * existingAttachments.length);
  } while (existingIds.has(relId));
  return relId;
}
var MessageComposition = class extends import_evt11.Emitter {
  constructor(api) {
    super();
    this.api = api;
    this._message = null;
    this.senderIdentity = null;
    this.to = null;
    this.cc = null;
    this.bcc = null;
    this.subject = null;
    this.textBody = null;
    this.htmlBlob = null;
    this.serial = 0;
    this._references = null;
    this.attachments = null;
  }
  toString() {
    return "[MessageComposition: " + this._handle + "]";
  }
  toJSON() {
    return {
      type: "MessageComposition",
      handle: this._handle
    };
  }
  async __asyncInitFromMessage(message) {
    this._message = message;
    message.on("change", this._onMessageChange.bind(this));
    message.on("remove", this._onMessageRemove.bind(this));
    let wireRep = message._wireRep;
    this.serial++;
    this.id = wireRep.id;
    this.subject = wireRep.subject;
    this.to = wireRep.to;
    this.cc = wireRep.cc;
    this.bcc = wireRep.bcc;
    this.attachments = wireRep.attachments;
    this.sendProblems = wireRep.draftInfo.sendProblems;
    if (wireRep.bodyReps.length === 2 && wireRep.bodyReps[1].type === "html") {
      this.htmlBlob = wireRep.bodyReps[1].contentBlob;
    } else {
      this.htmlBlob = null;
    }
    const textRep = JSON.parse(await wireRep.bodyReps[0].contentBlob.text());
    if (Array.isArray(textRep) && textRep.length === 2 && textRep[0] === 1) {
      this.textBody = textRep[1];
    } else {
      this.textBody = "";
    }
    return this;
  }
  _onMessageChange() {
    let wireRep = this._message._wireRep;
    this.sendStatus = wireRep.draftInfo.sendStatus;
    this.emit("change");
  }
  _onMessageRemove() {
    this.emit("remove");
  }
  release() {
    if (this._message) {
      this._message.release();
      this._message = null;
    }
  }
  _mutated() {
    this.serial++;
    this.emit("change");
  }
  addAttachment(attachmentDef) {
    const relId = bruteForceAttachmentId(this.attachments);
    this.api._composeAttach(this.id, {
      relId,
      name: attachmentDef.name,
      blob: attachmentDef.blob
    });
    var placeholderAttachment = {
      relId,
      name: attachmentDef.name,
      type: attachmentDef.blob.type,
      sizeEstimate: attachmentDef.blob.size
    };
    this.attachments.push(placeholderAttachment);
    this._mutated();
    return placeholderAttachment;
  }
  removeAttachment(attachmentThing) {
    const idx = this.attachments.indexOf(attachmentThing);
    if (idx !== -1) {
      this.attachments.splice(idx, 1);
      this.api._composeDetach(this.id, attachmentThing.relId);
    }
    this._mutated();
  }
  addRecipient(bin, addressPair) {
    this[bin].push(addressPair);
    this._mutated();
  }
  removeRecipient(bin, addressPair) {
    const recipList = this[bin];
    const idx = recipList.indexOf(addressPair);
    if (idx !== -1) {
      recipList.splice(idx, 1);
      this._mutated();
    }
  }
  removeLastRecipient(bin) {
    const recipList = this[bin];
    if (recipList.length) {
      recipList.pop();
      this._mutated();
    }
  }
  setSubject(subject) {
    this.subject = subject;
    this._mutated();
  }
  _buildWireRep() {
    return {
      date: Date.now(),
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      subject: this.subject,
      textBody: this.textBody
    };
  }
  finishCompositionSendMessage() {
    return this.api._composeDone(this.id, "send", this._buildWireRep());
  }
  saveDraft() {
    return this.api._composeDone(this.id, "save", this._buildWireRep());
  }
  abortCompositionDeleteDraft() {
    return this.api._composeDone(this.id, "delete", null);
  }
};

// src/client_specific/oauth_bindings.js
var OauthBindings = {
  google: {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId: "913967847322-m8ij544g2i23pssvchhru1hceg08irud.apps.googleusercontent.com",
    clientSecret: "G7bg5a1bahnVWxd6GKQcO4Ro",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/documents.readonly"
    ]
  },
  microsoft: {
    endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: "66d9891f-d284-4158-a9b3-27aebf6b0f8c",
    clientSecret: "P8_.eMal60dY1VFEU1K6N_-22o4cA6vo.d",
    scopes: [
      "offline_access",
      "https://graph.microsoft.com/Calendars.Read",
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/User.Read"
    ]
  }
};

// src/clientapi/bodies/linkify.js
var linkify_exports = {};
__export(linkify_exports, {
  linkifyHTML: () => linkifyHTML,
  linkifyPlain: () => linkifyPlain
});
var RE_URL = /(^|[\s(,;])((?:https?:\/\/|www\d{0,3}[.][-a-z0-9.]{2,249}|[-a-z0-9.]{2,250}[.][a-z]{2,4}\/)[-\w.!~*'();,/?:@&=+$#%]*)/im;
var RE_UNEAT_LAST_URL_CHARS = /(?:[),;.!?]|[.!?]\)|\)[.!?])$/;
var RE_HTTP = /^https?:/i;
var RE_MAIL = /(^|[\s(,;<>])([^(,;<>@\s]+@[-a-z0-9.]{2,250}[.][-a-z0-9]{2,32})/im;
var RE_MAILTO = /^mailto:/i;
function linkifyPlain(body, doc) {
  const nodes = [];
  let contentStart;
  while (true) {
    const url = RE_URL.exec(body);
    const email = RE_MAIL.exec(body);
    let link, text;
    if (url && (!email || url.index < email.index)) {
      contentStart = url.index + url[1].length;
      if (contentStart > 0) {
        nodes.push(doc.createTextNode(body.substring(0, contentStart)));
      }
      let useUrl = url[2];
      const uneat = RE_UNEAT_LAST_URL_CHARS.exec(useUrl);
      if (uneat) {
        useUrl = useUrl.substring(0, uneat.index);
      }
      link = doc.createElement("a");
      link.className = "moz-external-link";
      if (RE_HTTP.test(url[2])) {
        link.setAttribute("ext-href", useUrl);
      } else {
        link.setAttribute("ext-href", "http://" + useUrl);
      }
      text = doc.createTextNode(useUrl);
      link.appendChild(text);
      nodes.push(link);
      body = body.substring(url.index + url[1].length + useUrl.length);
    } else if (email) {
      contentStart = email.index + email[1].length;
      if (contentStart > 0) {
        nodes.push(doc.createTextNode(body.substring(0, contentStart)));
      }
      link = doc.createElement("a");
      link.className = "moz-external-link";
      if (RE_MAILTO.test(email[2])) {
        link.setAttribute("ext-href", email[2]);
      } else {
        link.setAttribute("ext-href", "mailto:" + email[2]);
      }
      text = doc.createTextNode(email[2]);
      link.appendChild(text);
      nodes.push(link);
      body = body.substring(email.index + email[0].length);
    } else {
      break;
    }
  }
  if (body.length) {
    nodes.push(doc.createTextNode(body));
  }
  return nodes;
}
function linkifyHTML(doc) {
  function linkElem(elem) {
    const children = elem.childNodes;
    for (const sub of children) {
      if (sub.nodeName === "#text") {
        const nodes = linkifyPlain(sub.nodeValue, doc);
        elem.replaceChild(nodes[nodes.length - 1], sub);
        for (let iNode = nodes.length - 2; iNode >= 0; --iNode) {
          elem.insertBefore(nodes[iNode], nodes[iNode + 1]);
        }
      } else if (sub.nodeName !== "A") {
        linkElem(sub);
      }
    }
  }
  linkElem(doc.body);
}

// src/clientapi/cal_event.js
var import_evt13 = __toModule(require_evt());

// src/clientapi/cal_attendee.js
var import_evt12 = __toModule(require_evt());
var CalAttendee = class extends import_evt12.Emitter {
  constructor(_event, wireRep) {
    super();
    this._event = _event;
    this.__update(wireRep);
  }
  toString() {
    return '[CalAttendee: "' + this.email + '"]';
  }
  toJSON() {
    return {
      type: "CalAttendee",
      filename: this.filename
    };
  }
  __update(wireRep) {
    this.email = wireRep.email;
    this.displayName = wireRep.displayName;
    this.isSelf = wireRep.isSelf;
    this.isOrganizer = wireRep.isOrganizer;
    this.isResource = wireRep.isResource;
    this.responseStatus = wireRep.responseStatus;
    this.comment = wireRep.comment;
    this.isOptional = wireRep.isOptional;
  }
};

// src/clientapi/cal_event.js
function filterOutBuiltinFlags2(flags) {
  const outFlags = [];
  for (let i = flags.length - 1; i >= 0; i--) {
    if (flags[i][0] !== "\\") {
      outFlags.push(flags[i]);
    }
  }
  return outFlags;
}
var CalEvent = class extends import_evt13.Emitter {
  constructor(api, wireRep, overlays, matchInfo, slice) {
    super();
    this._api = api;
    this._slice = slice;
    this._wireRep = wireRep;
    this.id = wireRep.id;
    this.attendees = [];
    this.creator = wireRep.creator;
    this.organizer = wireRep.organizer;
    this.bodyReps = wireRep.bodyReps;
    this.__update(wireRep);
    this.__updateOverlays(overlays);
    this.matchInfo = matchInfo;
    this.type = "cal";
  }
  toString() {
    return "[CalEvent: " + this.id + "]";
  }
  toJSON() {
    return {
      type: "CalEvent",
      id: this.id
    };
  }
  __update(wireRep) {
    this._wireRep = wireRep;
    if (wireRep.snippet !== null) {
      this.snippet = wireRep.snippet;
    }
    this.date = new Date(wireRep.date);
    this.startDate = new Date(wireRep.startDate);
    this.endDate = new Date(wireRep.endDate);
    this.isAllDay = wireRep.isAllDay;
    this.summary = wireRep.subject;
    this.snippet = wireRep.snippet;
    this.tags = filterOutBuiltinFlags2(wireRep.flags);
    this.labels = this._api._mapLabels(this.id, wireRep.folderIds);
    this.bodyReps = wireRep.bodyReps;
    this.attendees = keyedListHelper({
      wireReps: wireRep.attendees,
      existingRichReps: this.attendees,
      constructor: CalAttendee,
      owner: this,
      idKey: "email",
      addEvent: "attendee:add",
      changeEvent: "attendee:change",
      removeEvent: "attendee:remove"
    });
  }
  __updateOverlays(overlays) {
  }
  release() {
  }
  modifyTags(args) {
    return this._api.modifyTags([this], args);
  }
};

// src/clientapi/cal_events_list_view.js
var CalEventsListView = class extends WindowedListView {
  constructor(api, handle) {
    super(api, CalEvent, handle);
    this._nextSnippetRequestValidAt = 0;
  }
  ensureSnippets() {
    const snippetsNeeded = this.items.some((message) => {
      return message && message.snippet === null;
    });
    if (snippetsNeeded) {
      if (this._nextSnippetRequestValidAt > Date.now()) {
        return;
      }
      this._nextSnippetRequestValidAt = Date.now() + 5e3;
      this._api.__bridgeSend({
        type: "fetchSnippets",
        convIds: [this.conversationId]
      });
    }
  }
  refresh() {
    this._api.__bridgeSend({
      type: "refreshView",
      handle: this.handle
    });
  }
};

// src/clientapi/mailapi.js
var normalizeFoldersToIds = (folders) => folders?.map((folder) => folder.id);
var LEGAL_CONFIG_KEYS = ["debugLogging"];
var MailAPI = class extends import_evt14.Emitter {
  constructor() {
    super();
    logic.defineScope(this, "MailAPI", {});
    this._nextHandle = 1;
    this._trackedItemHandles = new Map();
    this._pendingRequests = {};
    this._liveBodies = {};
    this._storedSends = [];
    this._processingMessage = null;
    this._deferredMessages = [];
    this.config = null;
    this.configLoaded = false;
    this.accountsLoaded = false;
    ContactCache.init();
    this.accounts = this.viewAccounts({ autoViewFolders: true });
    this.oauthBindings = OauthBindings;
    this.utils = linkify_exports;
    this.l10n_folder_names = {};
  }
  toString() {
    return "[MailAPI]";
  }
  toJSON() {
    return { type: "MailAPI" };
  }
  __universeAvailable() {
    this.configLoaded = true;
    this.emit("configLoaded");
    logic(this, "configLoaded");
    this.accounts.latestOnce("complete", () => {
      Promise.all(this.accounts.items.map((account) => {
        return new Promise((resolve) => {
          account.folders.latestOnce("complete", resolve);
        });
      })).then(() => {
        this.accountsLoaded = true;
        logic(this, "accountsLoaded");
        this.emit("accountsLoaded");
      });
    });
  }
  eventuallyGetAccountById(accountId) {
    return this.accounts.eventuallyGetAccountById(accountId);
  }
  async eventuallyGetFolderById(folderId) {
    const accountId = accountIdFromFolderId(folderId);
    const account = await this.accounts.eventuallyGetAccountById(accountId);
    return account.folders.eventuallyGetFolderById(folderId);
  }
  getFolderById(folderId) {
    const accountId = accountIdFromFolderId(folderId);
    const account = this.accounts.getAccountById(accountId);
    return account && account.folders.getFolderById(folderId);
  }
  willDie() {
    throw new Error("Not implemented");
  }
  _mapLabels(messageId, folderIds) {
    let accountId = accountIdFromMessageId(messageId);
    let account = this.accounts.getAccountById(accountId);
    if (!account) {
      console.warn("the possible has happened; unable to find account with id", accountId);
    }
    let folders = account.folders;
    return Array.from(folderIds).map((folderId) => {
      return folders.getFolderById(folderId);
    });
  }
  __bridgeSend(msg) {
    logic(this, "storingSend", { msg });
    this._storedSends.push(msg);
  }
  __bridgeReceive(msg) {
    if (this._processingMessage && msg.type !== "pong") {
      logic(this, "deferMessage", { type: msg.type });
      this._deferredMessages.push(msg);
    } else {
      logic(this, "immediateProcess", { type: msg.type });
      this._processMessage(msg);
    }
  }
  _processMessage(msg) {
    const methodName = "_recv_" + msg.type;
    if (!(methodName in this)) {
      logic.fail(new Error("Unsupported message type:", msg.type));
      return;
    }
    try {
      logic(this, "processMessage", { type: msg.type });
      const promise = this[methodName](msg);
      if (promise && promise.then) {
        this._processingMessage = promise;
        promise.then(this._doneProcessingMessage.bind(this, msg));
      }
    } catch (ex) {
      logic(this, "processMessageError", {
        type: msg.type,
        ex,
        stack: ex.stack
      });
    }
  }
  _doneProcessingMessage(msg) {
    if (this._processingMessage && this._processingMessage !== msg) {
      throw new Error("Mismatched message completion!");
    }
    this._processingMessage = null;
    while (this._processingMessage === null && this._deferredMessages.length) {
      this._processMessage(this._deferredMessages.shift());
    }
  }
  shoddyAutocomplete(phrase) {
    return ContactCache.shoddyAutocomplete(phrase);
  }
  async getConversation(conversationId, priorityTags) {
    await this.eventuallyGetAccountById(accountIdFromConvId(conversationId));
    return this._getItemAndTrackUpdates("conv", conversationId, MailConversation, priorityTags);
  }
  async getMessage(messageNamer, priorityTags) {
    const messageId = messageNamer[0];
    await this.eventuallyGetAccountById(accountIdFromMessageId(messageId));
    return this._getItemAndTrackUpdates("msg", messageNamer, MailMessage, priorityTags);
  }
  _sendPromisedRequest(sendMsg) {
    return new Promise((resolve) => {
      const handle = sendMsg.handle = this._nextHandle++;
      this._pendingRequests[handle] = {
        type: sendMsg.type,
        resolve
      };
      this.__bridgeSend(sendMsg);
    });
  }
  _recv_promisedResult(msg) {
    const { handle } = msg;
    const pending = this._pendingRequests[handle];
    delete this._pendingRequests[handle];
    pending.resolve(msg.data);
  }
  _sendUndoableRequest(undoableInfo, requestPayload) {
    const id = this._nextHandle;
    const undoableTasksPromise = this._sendPromisedRequest(requestPayload);
    const undoableOp = new UndoableOperation({
      api: this,
      id,
      operation: undoableInfo.operation,
      affectedType: undoableInfo.affectedType,
      affectedCount: undoableInfo.affectedCount,
      undoableTasksPromise
    });
    this.emit("undoableOp", undoableOp);
    return undoableOp;
  }
  __scheduleUndoTasks(undoableOp, undoTasks) {
    this.emit("undoing", undoableOp);
    this.__bridgeSend({
      type: "undo",
      undoTasks
    });
  }
  _normalizeConversationSelectorArgs(arrayOfStuff, args) {
    let {
      detectType: argDetect,
      conversations: argConversations,
      messages: argMessages,
      messageSelector
    } = args;
    let convSelectors;
    if (arrayOfStuff) {
      argDetect = arrayOfStuff;
    }
    if (argDetect) {
      if (argDetect[0] instanceof MailMessage) {
        argMessages = argDetect;
      } else if (argDetect[0] instanceof MailConversation) {
        argConversations = argDetect;
      }
    }
    let affectedType;
    let affectedCount = 0;
    if (argConversations) {
      affectedType = "conversation";
      affectedCount = argConversations.length;
      convSelectors = argConversations.map((x) => {
        return {
          id: x.id,
          messageSelector
        };
      });
    } else if (argMessages) {
      affectedType = "message";
      affectedCount = argMessages.length;
      convSelectors = [];
      let selectorByConvId = new Map();
      for (const message of argMessages) {
        const convId = convIdFromMessageId(message.id);
        let selector = selectorByConvId.get(convId);
        if (!selector) {
          selector = {
            id: convId,
            messageIds: [message.id]
          };
          selectorByConvId.set(convId, selector);
          convSelectors.push(selector);
        } else {
          selector.messageIds.push(message.id);
        }
      }
    } else {
      throw new Error("Weird conversation/message selector.");
    }
    return { convSelectors, affectedType, affectedCount };
  }
  _recv_broadcast(msg) {
    const { name, data } = msg.payload;
    this.emit(name, data);
  }
  _getItemAndTrackUpdates(itemType, itemId, itemConstructor, priorityTags) {
    return new Promise((resolve, reject) => {
      const handle = this._nextHandle++;
      this._trackedItemHandles.set(handle, {
        type: itemType,
        id: itemId,
        callback: (msg) => {
          if (msg.error || !msg.data) {
            reject(new Error("track problem, error: " + msg.error + " has data?: " + !!msg.data));
            return;
          }
          const obj = new itemConstructor(this, msg.data.state, msg.data.overlays, null, handle);
          resolve(obj);
          this._trackedItemHandles.set(handle, {
            type: itemType,
            id: itemId,
            obj
          });
        }
      });
      this.__bridgeSend({
        type: "getItemAndTrackUpdates",
        handle,
        itemType,
        itemId,
        priorityTags
      });
      return handle;
    });
  }
  _recv_gotItemNowTrackingUpdates(msg) {
    const details = this._trackedItemHandles.get(msg.handle);
    details.callback(msg);
  }
  _updateTrackedItemPriorityTags(handle, priorityTags) {
    this.__bridgeSend({
      type: "updateTrackedItemPriorityTags",
      handle,
      priorityTags
    });
  }
  _recv_update(msg) {
    const details = this._trackedItemHandles.get(msg.handle);
    if (details && details.obj) {
      const obj = details.obj;
      let data = msg.data;
      obj.__update(data);
    } else {
      logic(this, "unknownHandle", { msg });
    }
  }
  _recv_updateItem(msg) {
    const details = this._trackedItemHandles.get(msg.handle);
    if (details && details.obj) {
      const obj = details.obj;
      const data = msg.data;
      if (data === null) {
        obj.emit("remove", obj);
      } else {
        if (data.state) {
          obj.__update(data.state);
        }
        if (data.overlays) {
          obj.__updateOverlays(data.overlays);
        }
        obj.serial++;
        obj.emit("change", obj);
      }
    } else {
      logic(this, "unknownHandle", { msg });
    }
  }
  _cleanupContext(handle) {
    this.__bridgeSend({
      type: "cleanupContext",
      handle
    });
  }
  _recv_contextCleanedUp(msg) {
    this._trackedItemHandles.delete(msg.handle);
  }
  _downloadBodyReps(messageId, messageDate) {
    this.__bridgeSend({
      type: "downloadBodyReps",
      id: messageId,
      date: messageDate
    });
  }
  _downloadAttachments(downloadReq) {
    return this._sendPromisedRequest({
      type: "downloadAttachments",
      downloadReq
    });
  }
  learnAboutAccount(details) {
    return this._sendPromisedRequest({
      type: "learnAboutAccount",
      details
    });
  }
  tryToCreateAccount(userDetails, domainInfo) {
    return this._sendPromisedRequest({
      type: "tryToCreateAccount",
      userDetails,
      domainInfo
    }).then((result) => {
      if (result.accountId) {
        return this.accounts.eventuallyGetAccountById(result.accountId).then((account) => {
          return {
            error: null,
            errorDetails: null,
            account
          };
        });
      }
      return {
        error: result.error,
        errorDetails: result.errorDetails
      };
    });
  }
  _clearAccountProblems(account, callback) {
    const handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: "clearAccountProblems",
      callback
    };
    this.__bridgeSend({
      type: "clearAccountProblems",
      accountId: account.id,
      handle
    });
  }
  _recv_clearAccountProblems(msg) {
    const req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
  }
  _modifyAccount(account, mods) {
    return this._sendPromisedRequest({
      type: "modifyAccount",
      accountId: account.id,
      mods
    }).then(() => null);
  }
  _recreateAccount(account) {
    this.__bridgeSend({
      type: "recreateAccount",
      accountId: account.id
    });
  }
  _deleteAccount(account) {
    this.__bridgeSend({
      type: "deleteAccount",
      accountId: account.id
    });
  }
  _modifyIdentity(identity, mods) {
    return this._sendPromisedRequest({
      type: "modifyIdentity",
      identityId: identity.id,
      mods
    }).then(() => null);
  }
  _modifyFolder(account, mods) {
    return this._sendPromisedRequest({
      type: "modifyFolder",
      accountId: account.id,
      mods
    }).then(() => null);
  }
  syncAllSubscribedCalendars() {
  }
  viewAccounts(opts) {
    const handle = this._nextHandle++, view = new AccountsListView(this, handle, opts);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewAccounts",
      handle
    });
    return view;
  }
  viewFolders(mode, accountId) {
    const handle = this._nextHandle++, view = new FoldersListView(this, handle);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewFolders",
      mode,
      handle,
      accountId
    });
    return view;
  }
  viewRawList(namespace, name) {
    const handle = this._nextHandle++, view = new RawListView(this, handle);
    view.source = { namespace, name };
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewRawList",
      handle,
      namespace,
      name
    });
    return view;
  }
  viewFolderConversations(folder) {
    const handle = this._nextHandle++, view = new ConversationsListView(this, handle);
    view.folderId = folder.id;
    view.folder = this.getFolderById(view.folderId);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewFolderConversations",
      folderId: folder.id,
      handle
    });
    return view;
  }
  _makeDerivedViews(rootView, viewSpecs) {
    const viewDefsWithHandles = [];
    const createView = (viewDef) => {
      const handle = this._nextHandle++;
      const view = new RawListView(this, handle);
      view.viewDef = viewDef;
      this._trackedItemHandles.set(handle, { obj: view });
      viewDefsWithHandles.push({
        handle,
        viewDef
      });
      return view;
    };
    const apiResult = {
      root: rootView
    };
    for (const [key, viewDefs] of Object.entries(viewSpecs)) {
      apiResult[key] = viewDefs.map(createView);
    }
    return { apiResult, viewDefsWithHandles };
  }
  searchFolderConversations(spec) {
    const handle = this._nextHandle++, view = new ConversationsListView(this, handle);
    view.folderId = spec.folder.id;
    view.folder = this.getFolderById(view.folderId);
    this._trackedItemHandles.set(handle, { obj: view });
    let result = view;
    let viewDefsWithHandles = null;
    if (spec.derivedViews) {
      ({ apiResult: result, viewDefsWithHandles } = this._makeDerivedViews(view, spec.derivedViews));
    }
    this.__bridgeSend({
      type: "searchFolderConversations",
      handle,
      spec: {
        folderId: view.folderId,
        filter: spec.filter
      },
      viewDefsWithHandles
    });
    return result;
  }
  searchFolderMessages(spec) {
    const handle = this._nextHandle++;
    const { folder } = spec;
    const view = folder.type === "calendar" ? new CalEventsListView(this, handle) : new MessagesListView(this, handle);
    view.folderId = folder.id;
    view.folder = this.getFolderById(view.folderId);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "searchFolderMessages",
      handle,
      spec: {
        folderId: view.folderId,
        filter: spec.filter
      }
    });
    return view;
  }
  searchAccountMessages(spec) {
    const handle = this._nextHandle++;
    const { account } = spec;
    const view = ["mapi", "gapi"].includes(account.type) ? new CalEventsListView(this, handle) : new MessagesListView(this, handle);
    view.accountId = account.id;
    view.account = this.accounts.getAccountById(account.id);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "searchAccountMessages",
      handle,
      spec: {
        accountId: view.accountId,
        filter: spec.filter
      }
    });
    return view;
  }
  viewFolderMessages(folder) {
    const handle = this._nextHandle++;
    let view;
    if (folder.type === "calendar") {
      view = new CalEventsListView(this, handle);
    } else {
      view = new MessagesListView(this, handle);
    }
    view.folderId = folder.id;
    view.folder = this.getFolderById(view.folderId);
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewFolderMessages",
      folderId: folder.id,
      handle
    });
    return view;
  }
  viewConversationMessages(convOrId) {
    const handle = this._nextHandle++, view = new MessagesListView(this, handle);
    view.conversationId = typeof convOrId === "string" ? convOrId : convOrId.id;
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "viewConversationMessages",
      conversationId: view.conversationId,
      handle
    });
    return view;
  }
  searchConversationMessages(spec) {
    const handle = this._nextHandle++, view = new MessagesListView(this, handle);
    view.conversationId = spec.conversation.id;
    this._trackedItemHandles.set(handle, { obj: view });
    this.__bridgeSend({
      type: "searchConversationMessages",
      handle,
      spec: {
        conversationId: view.conversationId,
        filter: spec.filter
      }
    });
    return view;
  }
  trash(arrayOfStuff, opts) {
    const {
      convSelectors,
      affectedType,
      affectedCount
    } = this._normalizeConversationSelectorArgs(arrayOfStuff, opts);
    return this._sendUndoableRequest({
      operation: "trash",
      affectedType,
      affectedCount
    }, {
      type: "trash",
      conversations: convSelectors
    });
  }
  move(arrayOfStuff, targetFolder, opts) {
    const {
      convSelectors,
      affectedType,
      affectedCount
    } = this._normalizeConversationSelectorArgs(arrayOfStuff, opts);
    return this._sendUndoableRequest({
      operation: "move",
      affectedType,
      affectedCount
    }, {
      type: "move",
      conversations: convSelectors,
      targetFolderId: targetFolder.id
    });
  }
  markRead(arrayOfStuff, beRead) {
    return this.modifyTags(arrayOfStuff, {
      operation: beRead ? "read" : "unread",
      addTags: beRead ? ["\\Seen"] : null,
      removeTags: beRead ? null : ["\\Seen"]
    });
  }
  markStarred(arrayOfStuff, beStarred) {
    return this.modifyTags(arrayOfStuff, {
      operation: beStarred ? "star" : "unstar",
      addTags: beStarred ? ["\\Flagged"] : null,
      removeTags: beStarred ? null : ["\\Flagged"],
      messageSelector: beStarred ? "last" : null
    });
  }
  modifyLabels(arrayOfStuff, opts) {
    const {
      convSelectors,
      affectedType,
      affectedCount
    } = this._normalizeConversationSelectorArgs(arrayOfStuff, opts);
    return this._sendUndoableRequest({
      operation: opts.operation || "modifylabels",
      affectedType,
      affectedCount
    }, {
      type: "store_labels",
      conversations: convSelectors,
      add: normalizeFoldersToIds(opts.addLabels),
      remove: normalizeFoldersToIds(opts.removeLabels)
    });
  }
  modifyTags(arrayOfStuff, opts) {
    const {
      convSelectors,
      affectedType,
      affectedCount
    } = this._normalizeConversationSelectorArgs(arrayOfStuff, opts);
    return this._sendUndoableRequest({
      operation: opts.operation || "modifytags",
      affectedType,
      affectedCount
    }, {
      type: "store_flags",
      conversations: convSelectors,
      add: opts.addTags,
      remove: opts.removeTags
    });
  }
  setOutboxSyncEnabled(account, enabled) {
    return this._sendPromisedRequest({
      type: "outboxSetPaused",
      accountId: account.id,
      bePaused: !enabled
    });
  }
  parseMailbox(email) {
    try {
      const mailbox = import_addressparser.default.parse(email);
      return mailbox.length >= 1 ? mailbox[0] : null;
    } catch (ex) {
      return null;
    }
  }
  resolveEmailAddressToPeep(emailAddress, callback) {
    const peep = ContactCache.resolvePeep({
      name: null,
      address: emailAddress
    });
    if (ContactCache.pendingLookupCount) {
      ContactCache.callbacks.push(callback.bind(null, peep));
    } else {
      callback(peep);
    }
  }
  async beginMessageComposition(message, folder, options) {
    if (!options) {
      options = {};
    }
    const data = await this._sendPromisedRequest({
      type: "createDraft",
      draftType: options.command,
      mode: options.mode,
      refMessageId: message ? message.id : null,
      refMessageDate: message ? message.date.valueOf() : null,
      folderId: folder ? folder.id : null
    });
    const namer = { id: data.messageId, date: data.messageDate };
    if (options.noComposer) {
      return namer;
    }
    return this.resumeMessageComposition(namer);
  }
  async resumeMessageComposition(namer) {
    const msg = await this.getMessage([namer.id, namer.date.valueOf()]);
    const composer = new MessageComposition(this);
    return composer.__asyncInitFromMessage(msg);
  }
  _composeAttach(messageId, attachmentDef) {
    this.__bridgeSend({
      type: "attachBlobToDraft",
      messageId,
      attachmentDef
    });
  }
  _composeDetach(messageId, attachmentRelId) {
    this.__bridgeSend({
      type: "detachAttachmentFromDraft",
      messageId,
      attachmentRelId
    });
  }
  _composeDone(messageId, command, draftFields) {
    return this._sendPromisedRequest({
      type: "doneCompose",
      messageId,
      command,
      draftFields
    });
  }
  setInteractive() {
    this.__bridgeSend({
      type: "setInteractive"
    });
  }
  useLocalizedStrings(strings) {
    this.__bridgeSend({
      type: "localizedStrings",
      strings
    });
    if (strings.folderNames) {
      this.l10n_folder_names = strings.folderNames;
    }
  }
  l10n_folder_name(name, type) {
    if (this.l10n_folder_names.hasOwnProperty(type)) {
      const lowerName = name.toLowerCase();
      if (type === lowerName || type === "drafts" || type === "junk" || type === "queue") {
        return this.l10n_folder_names[type];
      }
    }
    return name;
  }
  async modifyConfig(mods) {
    for (const key in mods) {
      if (!LEGAL_CONFIG_KEYS.includes(key)) {
        throw new Error(key + " is not a legal config key!");
      }
    }
    await this._sendPromisedRequest({
      type: "modifyConfig",
      mods
    });
    return null;
  }
  _recv_config(msg) {
    this.config = msg.config;
    logic.realtimeLogEverything = this.config.debugLogging === "realtime";
  }
  ping(callback) {
    const handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: "ping",
      callback
    };
    globalThis.setTimeout(() => {
      this.__bridgeSend({
        type: "ping",
        handle
      });
    }, 0);
  }
  _recv_pong(msg) {
    const req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback();
  }
  clearNewTrackingForAccount({ account, accountId, silent }) {
    if (account && !accountId) {
      accountId = account.id;
    }
    this.__bridgeSend({
      type: "clearNewTrackingForAccount",
      accountId,
      silent
    });
  }
  flushNewAggregates() {
    this.__bridgeSend({
      type: "flushNewAggregates"
    });
  }
  debugForceCronSync({ accountIds, notificationAccountIds }) {
    const allAccountIds = this.accounts.items.map((account) => account.id);
    if (!accountIds) {
      accountIds = allAccountIds;
    }
    if (!notificationAccountIds) {
      notificationAccountIds = allAccountIds;
    }
    this.__bridgeSend({
      type: "debugForceCronSync",
      accountIds,
      notificationAccountIds
    });
  }
  getPersistedLogs() {
    return this._sendPromisedRequest({
      type: "getPersistedLogs"
    });
  }
};

// src/worker-support/main-router.js
var modules = [];
var listeners = new Map();
var workerPort = null;
function register(module) {
  modules.push(module);
  let action;
  if (module.process) {
    action = (msg) => {
      module.process(msg.uid, msg.cmd, msg.args);
    };
  } else if (module.dispatch) {
    action = (msg) => {
      if (module.dispatch[msg.cmd]) {
        module.dispatch[msg.cmd].apply(module.dispatch, msg.args);
      }
    };
  }
  const name = module.name;
  if (action) {
    listeners.set(name, action);
  }
  module.sendMessage = (uid, cmd, args, error = null) => {
    try {
      workerPort.postMessage({
        type: name,
        uid,
        cmd,
        args,
        error
      });
    } catch (ex) {
      console.error("Presumed DataCloneError on:", args, "ex:", ex);
    }
  };
}
function unregister(module) {
  listeners.delete(module.name);
}
function useWorker(worker) {
  workerPort = worker.port || worker;
  workerPort.onmessage = function dispatchToListener(evt2) {
    const { data } = evt2;
    listeners.get(data.type)?.(data);
  };
}

// src/worker-support/configparser-main.js
function debug(str) {
}
var me = {
  name: "configparser",
  sendMessage: null,
  process(uid, cmd, args) {
    debug("process " + cmd);
    switch (cmd) {
      case "accountcommon":
        parseAccountCommon(uid, cmd, args[0]);
        break;
      case "accountactivesync":
        parseActiveSyncAccount(uid, cmd, args[0], args[1]);
        break;
      default:
        break;
    }
  }
};
function nsResolver(prefix) {
  var baseUrl = "http://schemas.microsoft.com/exchange/autodiscover/";
  var ns = {
    rq: baseUrl + "mobilesync/requestschema/2006",
    ad: baseUrl + "responseschema/2006",
    ms: baseUrl + "mobilesync/responseschema/2006"
  };
  return ns[prefix] || null;
}
function parseAccountCommon(uid, cmd, text) {
  var doc = new DOMParser().parseFromString(text, "text/xml");
  var getNode = function(xpath, rel) {
    return doc.evaluate(xpath, rel || doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  };
  var dictifyChildNodes = function(node) {
    if (!node) {
      return null;
    }
    var dict = {};
    for (var kid = node.firstElementChild; kid; kid = kid.nextElementSibling) {
      dict[kid.tagName] = kid.textContent;
    }
    return dict;
  };
  var provider = getNode("/clientConfig/emailProvider");
  var incoming = getNode('incomingServer[@type="imap"] | incomingServer[@type="activesync"] | incomingServer[@type="pop3"]', provider);
  var outgoing = getNode('outgoingServer[@type="smtp"]', provider);
  var oauth2Settings = dictifyChildNodes(getNode("oauth2Settings", provider));
  var config = null;
  var status = null;
  if (incoming) {
    config = {
      type: null,
      incoming: {},
      outgoing: {},
      oauth2Settings
    };
    for (const child of incoming.children) {
      config.incoming[child.tagName] = child.textContent;
    }
    if (incoming.getAttribute("type") === "activesync") {
      config.type = "activesync";
    } else if (outgoing) {
      var isImap = incoming.getAttribute("type") === "imap";
      config.type = isImap ? "imap+smtp" : "pop3+smtp";
      for (const child of outgoing.children) {
        config.outgoing[child.tagName] = child.textContent;
      }
      var ALLOWED_SOCKET_TYPES = ["SSL", "STARTTLS"];
      if (!ALLOWED_SOCKET_TYPES.includes(config.incoming.socketType) || !ALLOWED_SOCKET_TYPES.includes(config.outgoing.socketType)) {
        config = null;
        status = "unsafe";
      }
    } else {
      config = null;
      status = "no-outgoing";
    }
  } else {
    status = "no-incoming";
  }
  me.sendMessage(uid, cmd, [config, status]);
}
function parseActiveSyncAccount(uid, cmd, text, aNoRedirect) {
  var doc = new DOMParser().parseFromString(text, "text/xml");
  var getNode = function(xpath, rel) {
    return doc.evaluate(xpath, rel, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  };
  var getNodes = function(xpath, rel) {
    return doc.evaluate(xpath, rel, nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  };
  var getString = function(xpath, rel) {
    return doc.evaluate(xpath, rel, nsResolver, XPathResult.STRING_TYPE, null).stringValue;
  };
  var postResponse = function(error2, config2, redirectedEmail2) {
    me.sendMessage(uid, cmd, [config2, error2, redirectedEmail2]);
  };
  let error = null;
  if (doc.documentElement.tagName === "parsererror") {
    error = "Error parsing autodiscover response";
    return postResponse(error);
  }
  var responseNode = getNode("/ad:Autodiscover/ms:Response", doc) || getNode("/ms:Autodiscover/ms:Response", doc);
  if (!responseNode) {
    error = "Missing Autodiscover Response node";
    return postResponse(error);
  }
  error = getNode("ms:Error", responseNode) || getNode("ms:Action/ms:Error", responseNode);
  if (error) {
    error = getString("ms:Message/text()", error);
    return postResponse(error);
  }
  var redirect = getNode("ms:Action/ms:Redirect", responseNode);
  if (redirect) {
    if (aNoRedirect) {
      error = "Multiple redirects occurred during autodiscovery";
      return postResponse(error);
    }
    var redirectedEmail = getString("text()", redirect);
    return postResponse(null, null, redirectedEmail);
  }
  var user = getNode("ms:User", responseNode);
  var config = {
    culture: getString("ms:Culture/text()", responseNode),
    user: {
      name: getString("ms:DisplayName/text()", user),
      email: getString("ms:EMailAddress/text()", user)
    },
    servers: []
  };
  const servers = getNodes("ms:Action/ms:Settings/ms:Server", responseNode);
  let server;
  while (server = servers.iterateNext()) {
    config.servers.push({
      type: getString("ms:Type/text()", server),
      url: getString("ms:Url/text()", server),
      name: getString("ms:Name/text()", server),
      serverData: getString("ms:ServerData/text()", server)
    });
  }
  for (const mobileServer of config.servers) {
    if (mobileServer.type === "MobileSync") {
      config.mobileSyncServer = mobileServer;
      break;
    }
  }
  if (!config.mobileSyncServer) {
    error = "No MobileSync server found";
    return postResponse(error, config);
  }
  postResponse(null, config);
  return null;
}
var configparser_main_default = me;

// src/worker-support/wakelocks-main.js
var nextId2 = 1;
var locks = new Map();
function requestWakeLock(type) {
  var lock;
  if (navigator.requestWakeLock) {
    lock = navigator.requestWakeLock(type);
  }
  var id = nextId2++;
  locks.set(id, lock);
  return id;
}
var me2 = {
  name: "wakelocks",
  sendMessage: null,
  process(uid, cmd, args) {
    switch (cmd) {
      case "requestWakeLock":
        var type = args[0];
        me2.sendMessage(uid, cmd, [requestWakeLock(type)]);
        break;
      case "unlock":
        var id = args[0];
        var lock = locks.get(id);
        if (lock) {
          lock.unlock();
          locks.delete(id);
        }
        me2.sendMessage(uid, cmd, []);
        break;
      default:
        break;
    }
  },
  requestWakeLock
};
var wakelocks_main_default = me2;

// src/worker-support/cronsync-main.js
var requestWakeLock2 = wakelocks_main_default.requestWakeLock;
function makeData(accountIds, interval, date) {
  return {
    type: "sync",
    accountIds,
    interval,
    timestamp: date.getTime()
  };
}
function makeAccountKey(accountIds) {
  return "id" + accountIds.join(" ");
}
var prefixLength = "interval".length;
function toInterval(intervalKey) {
  return parseInt(intervalKey.substring(prefixLength), 10);
}
function hasSameValues(ary1, ary2) {
  if (ary1.length !== ary2.length) {
    return false;
  }
  var hasMismatch = ary1.some(function(item, i) {
    return item !== ary2[i];
  });
  return !hasMismatch;
}
function getAccountsWithOutstandingSyncNotifications() {
  if (typeof Notification !== "function" || !Notification.get) {
    return Promise.resolve([]);
  }
  return Notification.get().then(function(notifications) {
    var result = [];
    notifications.forEach(function(notification) {
      var data = notification.data;
      if (data.v && data.ntype === "sync") {
        result.push(data.accountId);
      }
    });
    return result;
  }, function() {
    return [];
  });
}
var routeRegistration;
var dispatcher = {
  _routeReady: false,
  _routeQueue: [],
  _sendMessage(type, args) {
    if (this._routeReady) {
      routeRegistration.sendMessage(null, type, args);
    } else {
      this._routeQueue.push([type, args]);
    }
  },
  hello() {
    this._routeReady = true;
    if (this._routeQueue.length) {
      var queue = this._routeQueue;
      this._routeQueue = [];
      queue.forEach(function(args) {
        this._sendMessage(args[0], args[1]);
      }.bind(this));
    }
  },
  clearAll() {
    var mozAlarms = navigator.mozAlarms;
    if (!mozAlarms) {
      return;
    }
    var r = mozAlarms.getAll();
    r.onsuccess = function(event) {
      var alarms = event.target.result;
      if (!alarms) {
        return;
      }
      alarms.forEach(function(alarm) {
        if (alarm.data && alarm.data.type === "sync") {
          mozAlarms.remove(alarm.id);
        }
      });
    };
    r.onerror = function(err) {
      console.error("cronsync-main clearAll mozAlarms.getAll: error: " + err);
    };
  },
  ensureSync(syncData) {
    var mozAlarms = navigator.mozAlarms;
    if (!mozAlarms) {
      logic(this, "unavailable", { mozAlarms: false });
      return;
    }
    logic(this, "ensureSync:begin");
    var request = mozAlarms.getAll();
    request.onsuccess = (event) => {
      logic(this, "ensureSync:gotAlarms");
      var alarms = event.target.result;
      if (!alarms) {
        alarms = [];
      }
      var expiredAlarmIds = [], okAlarmIntervals = {}, uniqueAlarms = {};
      alarms.forEach((alarm) => {
        if (!alarm.data || !alarm.data.type || alarm.data.type !== "sync") {
          return;
        }
        var intervalKey = "interval" + alarm.data.interval, wantedAccountIds = syncData[intervalKey];
        if (!wantedAccountIds || !hasSameValues(wantedAccountIds, alarm.data.accountIds)) {
          logic(this, "ensureSyncAccountMismatch", {
            alarmId: alarm.id,
            alarmAccountIds: alarm.data.accountIds,
            wantedAccountIds
          });
          expiredAlarmIds.push(alarm.id);
        } else {
          var interval = toInterval(intervalKey), now = Date.now(), alarmTime = alarm.data.timestamp, accountKey = makeAccountKey(wantedAccountIds);
          if (interval && !uniqueAlarms.hasOwnProperty(accountKey) && alarmTime > now && alarmTime < now + interval) {
            logic(this, "ensureSyncAlarmOK", {
              alarmId: alarm.id,
              accountKey,
              intervalKey
            });
            uniqueAlarms[accountKey] = true;
            okAlarmIntervals[intervalKey] = true;
          } else {
            logic(this, "ensureSyncAlarmOutOfRange", {
              alarmId: alarm.id,
              accountKey,
              intervalKey
            });
            expiredAlarmIds.push(alarm.id);
          }
        }
      });
      expiredAlarmIds.forEach((alarmId) => {
        mozAlarms.remove(alarmId);
      });
      var alarmMax = 0, alarmCount = 0, self = this;
      var done = () => {
        alarmCount += 1;
        if (alarmCount < alarmMax) {
          return;
        }
        logic(this, "ensureSync:end");
        self._sendMessage("syncEnsured");
      };
      Object.keys(syncData).forEach((intervalKey) => {
        if (okAlarmIntervals.hasOwnProperty(intervalKey)) {
          return;
        }
        var interval = toInterval(intervalKey), accountIds = syncData[intervalKey], date = new Date(Date.now() + interval);
        if (!interval) {
          return;
        }
        alarmMax += 1;
        var alarmRequest = mozAlarms.add(date, "ignoreTimezone", makeData(accountIds, interval, date));
        alarmRequest.onsuccess = () => {
          logic(this, "ensureSyncAlarmAdded", { accountIds, interval });
          done();
        };
        alarmRequest.onerror = (err) => {
          logic(this, "ensureSyncAlarmAddError", { accountIds, interval, err });
          done();
        };
      });
      if (!alarmMax) {
        done();
      }
    };
    request.onerror = (err) => {
      logic(this, "ensureSyncGetAlarmsError", { err });
    };
  }
};
logic.defineScope(dispatcher, "CronsyncMain");
if (navigator.mozSetMessageHandler) {
  navigator.mozSetMessageHandler("alarm", (alarm) => {
    logic(dispatcher, "alarmFired");
    if (window.hasOwnProperty("appShouldStayAlive")) {
      window.appShouldStayAlive = "alarmFired";
    }
    var data = alarm.data;
    if (!data || data.type !== "sync") {
      return;
    }
    var wakelockId = requestWakeLock2("cpu");
    getAccountsWithOutstandingSyncNotifications().then((accountIdsWithNotifications) => {
      logic(dispatcher, "alarmDispatch");
      dispatcher._sendMessage("alarm", [
        data.accountIds,
        data.interval,
        wakelockId,
        accountIdsWithNotifications
      ]);
    });
  });
}
routeRegistration = {
  name: "cronsync",
  sendMessage: null,
  dispatch: dispatcher
};
var cronsync_main_default = routeRegistration;

// src/worker-support/devicestorage-main.js
var me3;
function save(uid, cmd, storage, blob, filename, registerDownload) {
  var deviceStorage = navigator.getDeviceStorage(storage);
  if (!deviceStorage) {
    console.warn("no device-storage available.");
    me3.sendMessage(uid, cmd, [false, "no-device-storage", null, false]);
    return;
  }
  console.log("issuing addNamed req");
  var req = deviceStorage.addNamed(blob, filename);
  req.onerror = function() {
    console.log("device-storage addNamed error, may be expected.", req.error);
    me3.sendMessage(uid, cmd, [false, req.error.name, null, false]);
  };
  req.onsuccess = function(e) {
    console.log("addName returned happy");
    var prefix = "";
    if (typeof window.IS_GELAM_TEST !== "undefined") {
      prefix = "TEST_PREFIX/";
    }
    var savedPath = prefix + e.target.result;
    var registering = false;
    if (registerDownload) {
      var downloadManager = navigator.mozDownloadManager;
      console.warn("have downloadManager?", !!downloadManager, "have adoptDownload?", downloadManager && !!downloadManager.adoptDownload);
      if (downloadManager && downloadManager.adoptDownload) {
        try {
          var fullPath = e.target.result;
          var firstSlash = fullPath.indexOf("/", 2);
          var storageName = fullPath.substring(1, firstSlash);
          var storagePath = fullPath.substring(firstSlash + 1);
          console.log("adopting download", deviceStorage.storageName, e.target.result);
          registering = true;
          downloadManager.adoptDownload({
            totalBytes: blob.size,
            url: "",
            storageName,
            storagePath,
            contentType: blob.type,
            startTime: new Date(Date.now())
          }).then(function() {
            console.log("registered download with download manager");
            me3.sendMessage(uid, cmd, [true, null, savedPath, true]);
          }, function() {
            console.warn("failed to register download with download manager");
            me3.sendMessage(uid, cmd, [true, null, savedPath, false]);
          });
        } catch (ex) {
          console.error("Problem adopting download!:", ex, "\n", ex.stack);
        }
      } else {
        console.log("download manager not available, not registering.");
      }
    } else {
      console.log("do not want to register download");
    }
    if (!registering) {
      me3.sendMessage(uid, cmd, [true, null, savedPath, false]);
    }
  };
}
me3 = {
  name: "devicestorage",
  sendMessage: null,
  process(uid, cmd, args) {
    console.log("devicestorage-main:", cmd);
    switch (cmd) {
      case "save":
        save(uid, cmd, ...args);
        break;
      default:
        break;
    }
  }
};
var devicestorage_main_default = me3;

// src/worker-support/net-main.js
var sockInfoByUID = {};
function open(uid, host, port, options) {
  var socket = navigator.mozTCPSocket;
  var sock = socket.open(host, port, options);
  var sockInfo = sockInfoByUID[uid] = {
    uid,
    sock,
    activeBlob: null,
    blobOffset: 0,
    queuedData: null,
    backlog: []
  };
  sock.onopen = function() {
    me4.sendMessage(uid, "onopen");
  };
  sock.onerror = function(evt2) {
    var err = evt2.data;
    var wrappedErr;
    if (err && typeof err === "object") {
      wrappedErr = {
        name: err.name,
        type: err.type,
        message: err.message
      };
    } else {
      wrappedErr = err;
    }
    me4.sendMessage(uid, "onerror", wrappedErr);
  };
  sock.ondata = function(evt2) {
    var buf = evt2.data;
    me4.sendMessage(uid, "ondata", buf, [buf]);
  };
  sock.ondrain = function() {
    if (sockInfo.activeBlob && sockInfo.queuedData) {
      console.log("net-main(" + sockInfo.uid + "): Socket drained, sending.");
      sock.send(sockInfo.queuedData, 0, sockInfo.queuedData.byteLength);
      sockInfo.queuedData = null;
      fetchNextBlobChunk(sockInfo);
    } else {
      me4.sendMessage(uid, "ondrain");
    }
  };
  sock.onclose = function() {
    me4.sendMessage(uid, "onclose");
    delete sockInfoByUID[uid];
  };
}
function beginBlobSend(sockInfo, blob) {
  console.log("net-main(" + sockInfo.uid + "): Blob send of", blob.size, "bytes");
  sockInfo.activeBlob = blob;
  sockInfo.blobOffset = 0;
  sockInfo.queuedData = null;
  fetchNextBlobChunk(sockInfo);
}
function fetchNextBlobChunk(sockInfo) {
  if (sockInfo.blobOffset >= sockInfo.activeBlob.size) {
    console.log("net-main(" + sockInfo.uid + "): Blob send completed.", "backlog length:", sockInfo.backlog.length);
    sockInfo.activeBlob = null;
    var backlog = sockInfo.backlog;
    while (backlog.length) {
      var sendArgs = backlog.shift();
      var data = sendArgs[0];
      if (data instanceof Blob) {
        beginBlobSend(sockInfo, data);
        return;
      }
      sockInfo.sock.send(data, sendArgs[1], sendArgs[2]);
    }
    return;
  }
  var nextOffset = Math.min(sockInfo.blobOffset + me4.BLOB_BLOCK_READ_SIZE, sockInfo.activeBlob.size);
  console.log("net-main(" + sockInfo.uid + "): Fetching bytes", sockInfo.blobOffset, "through", nextOffset, "of", sockInfo.activeBlob.size);
  var blobSlice = sockInfo.activeBlob.slice(sockInfo.blobOffset, nextOffset);
  sockInfo.blobOffset = nextOffset;
  let gotChunk = (arraybuffer) => {
    console.log("net-main(" + sockInfo.uid + "): Retrieved chunk");
    if (sockInfo.sock.bufferedAmount === 0) {
      console.log("net-main(" + sockInfo.uid + "): Sending chunk immediately.");
      sockInfo.sock.send(arraybuffer, 0, arraybuffer.byteLength);
      fetchNextBlobChunk(sockInfo);
      return;
    }
    sockInfo.queuedData = arraybuffer;
  };
  blobSlice.arrayBuffer().then(gotChunk, () => {
    sockInfo.sock.close();
  });
}
function close(uid) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo) {
    return;
  }
  var sock = sockInfo.sock;
  sock.close();
  sock.onopen = null;
  sock.onerror = null;
  sock.ondata = null;
  sock.ondrain = null;
  sock.onclose = null;
  me4.sendMessage(uid, "onclose");
  delete sockInfoByUID[uid];
}
function write(uid, data, offset, length) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo) {
    return;
  }
  if (sockInfo.activeBlob) {
    sockInfo.backlog.push([data, offset, length]);
    return;
  }
  me4.sendMessage(uid, "onprogress", []);
  if (data instanceof Blob) {
    beginBlobSend(sockInfo, data);
  } else {
    sockInfo.sock.send(data, offset, length);
  }
}
function upgradeToSecure(uid) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo) {
    return;
  }
  sockInfo.sock.upgradeToSecure();
}
var me4 = {
  name: "netsocket",
  sendMessage: null,
  BLOB_BLOCK_READ_SIZE: 96 * 1024,
  process(uid, cmd, args) {
    switch (cmd) {
      case "open":
        open(uid, args[0], args[1], args[2]);
        break;
      case "close":
        close(uid);
        break;
      case "write":
        write(uid, args[0], args[1], args[2]);
        break;
      case "upgradeToSecure":
        upgradeToSecure(uid);
        break;
      default:
        console.error("Unhandled net-main command:", cmd);
        break;
    }
  }
};
var net_main_default = me4;

// src/app_logic/worker_maker.js
function makeWorker() {
  return new SharedWorker("chrome://browser/content/companion/workshop-worker-built.js");
}

// src/main-frame-setup.js
window.LOGIC = logic;
logic.tid = "api?";
logic.bc = new BroadcastChannel("logic");
var SCOPE = {};
logic.defineScope(SCOPE, "MainFrameSetup");
var control = {
  name: "control",
  sendMessage: null,
  process(uid) {
    var online = navigator.onLine;
    logic(SCOPE, "sendingHello");
    control.sendMessage(uid, "hello", [online]);
    window.addEventListener("online", function(evt2) {
      control.sendMessage(uid, evt2.type, [true]);
    });
    window.addEventListener("offline", function(evt2) {
      control.sendMessage(uid, evt2.type, [false]);
    });
    unregister(control);
  }
};
function MailAPIFactory(mainThreadService) {
  const MailAPI2 = new MailAPI();
  const worker = makeWorker();
  logic.defineScope(worker, "Worker");
  const workerPort2 = worker.port;
  const bridge = {
    name: "bridge",
    sendMessage: null,
    process(uid, cmd, args) {
      var msg = args;
      if (msg.type === "hello") {
        delete MailAPI2._fake;
        logic.tid = `api${uid}`;
        logic(SCOPE, "gotHello", { uid, storedSends: MailAPI2._storedSends });
        MailAPI2.__bridgeSend = function(sendMsg) {
          logic(this, "send", { msg: sendMsg });
          try {
            workerPort2.postMessage({
              uid,
              type: "bridge",
              msg: sendMsg
            });
          } catch (ex) {
            console.error("Presumed DataCloneError on:", sendMsg, "ex:", ex);
          }
        };
        MailAPI2.willDie = () => {
          workerPort2.postMessage({
            type: "willDie"
          });
        };
        MailAPI2.config = msg.config;
        MailAPI2._storedSends.forEach(function(storedMsg) {
          MailAPI2.__bridgeSend(storedMsg);
        });
        MailAPI2.__universeAvailable();
      } else {
        MailAPI2.__bridgeReceive(msg);
      }
    }
  };
  const mainThreadServiceModule = {
    name: "mainThreadService",
    process(uid, cmd, args) {
      if (!mainThreadService?.hasOwnProperty(cmd)) {
        this.sendMessage(uid, cmd, args, `No service ${cmd} in the main thread.`);
      }
      try {
        const result = mainThreadService[cmd](...args);
        if (result instanceof Promise) {
          result.then((res) => this.sendMessage(uid, cmd, res, null)).catch((err) => this.sendMessage(uid, cmd, args, `Main thread service threw: ${err.message}`));
        } else {
          this.sendMessage(uid, cmd, result, null);
        }
      } catch (ex) {
        this.sendMessage(uid, cmd, args, `Main thread service threw: ${ex.message}`);
      }
    }
  };
  worker.onerror = (event) => {
    logic(worker, "workerError", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno
    });
  };
  register(mainThreadServiceModule);
  register(control);
  register(bridge);
  register(configparser_main_default);
  register(cronsync_main_default);
  register(devicestorage_main_default);
  register(net_main_default);
  register(wakelocks_main_default);
  useWorker(worker);
  return MailAPI2;
}
export {
  MailAPIFactory
};
