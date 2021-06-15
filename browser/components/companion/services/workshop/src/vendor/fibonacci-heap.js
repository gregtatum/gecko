/*
https://github.com/Tyriar/js-data-structures/blob/aa71bf13f880aaabd49dea69b634da9105b137ec/src/fibonacci-heap.js

Copyright (c) 2014, Daniel Imms (http://www.growingwiththeweb.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return (root.FibonacciHeap = factory());
    });
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.FibonacciHeap = factory();
  }
}(this, function () {
  'use strict';

  var FibonacciHeap = function (customCompare) {
    this.minNode = undefined;
    this.nodeCount = 0;

    if (customCompare) {
      this.compare = customCompare;
    }
  };

  FibonacciHeap.prototype.clear = function () {
    this.minNode = undefined;
    this.nodeCount = 0;
  };

  FibonacciHeap.prototype.decreaseKey = function (node, newKey) {
    if (typeof node === 'undefined') {
      throw 'Cannot decrease key of non-existent node';
    }
    if (this.compare({ key: newKey }, { key: node.key }) > 0) {
      throw 'New key is larger than old key';
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

  FibonacciHeap.prototype.delete = function (node) {
    // This is a special implementation of decreaseKey that sets the
    // argument to the minimum value. This is necessary to make generic keys
    // work, since there is no MIN_VALUE constant for generic types.
    node.isMinimum = true;
    var parent = node.parent;
    if (parent) {
      cut(node, parent, this.minNode, this.compare);
      cascadingCut(parent, this.minNode, this.compare);
    }
    this.minNode = node;

    this.extractMinimum();
  };

  FibonacciHeap.prototype.extractMinimum = function () {
    var extractedMin = this.minNode;
    if (extractedMin) {
      // Set parent to undefined for the minimum's children
      if (extractedMin.child) {
        var child = extractedMin.child;
        do {
          child.parent = undefined;
          child = child.next;
        } while (child !== extractedMin.child);
      }

      var nextInRootList;
      if (this.minNode.next !== this.minNode) {
        nextInRootList = this.minNode.next;
      }
      // Remove min from root list
      removeNodeFromList(extractedMin);
      this.nodeCount--;

      // Merge the children of the minimum node with the root list
      this.minNode = mergeLists(nextInRootList, extractedMin.child,
          this.compare);
      if (nextInRootList) {
        this.minNode = nextInRootList;
        this.minNode = consolidate(this.minNode, this.compare);
      }
    }
    return extractedMin;
  };

  FibonacciHeap.prototype.findMinimum = function () {
    return this.minNode;
  };

  FibonacciHeap.prototype.insert = function (key, value) {
    var node = new Node(key, value);
    this.minNode = mergeLists(this.minNode, node, this.compare);
    this.nodeCount++;
    return node;
  };

  FibonacciHeap.prototype.isEmpty = function () {
    return this.minNode === undefined;
  };

  FibonacciHeap.prototype.size = function () {
    if (this.isEmpty()) {
      return 0;
    }
    return getNodeListSize(this.minNode);
  };

  // Union another fibonacci heap with this one
  FibonacciHeap.prototype.union = function (other) {
    this.minNode = mergeLists(this.minNode, other.minNode, this.compare);
    this.nodeCount += other.nodeCount;
  };

  FibonacciHeap.prototype.compare = function (a, b) {
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
      parent.child = undefined;
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

      // If there exists another node with the same degree, merge them
      while (aux[current.degree]) {
        if (compare(current, aux[current.degree]) > 0) {
          var temp = current;
          current = aux[current.degree];
          aux[current.degree] = temp;
        }
        linkHeaps(aux[current.degree], current, compare);
        aux[current.degree] = undefined;
        current.degree++;
      }

      aux[current.degree] = current;
    }

    minNode = undefined;
    for (var i = 0; i < aux.length; i++) {
      if (aux[i]) {
        // Remove siblings before merging
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

  // Merges two lists and returns the minimum node
  function mergeLists(a, b, compare) {
    if (!a && !b) {
      return undefined;
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

    this.parent = undefined;
    this.child = undefined;
    this.isMarked = undefined;
    this.isMinimum = undefined;
  }

  // This Iterator is used to simplify the consolidate() method. It works by
  // gathering a list of the nodes in the list in the constructor since the
  // nodes can change during consolidation.
  var NodeListIterator = function (start) {
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

  NodeListIterator.prototype.hasNext = function () {
    return this.items.length > 0;
  };

  NodeListIterator.prototype.next = function () {
    return this.items.shift();
  };

  return FibonacciHeap;
}));
