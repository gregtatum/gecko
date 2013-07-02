/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  'stability': 'experimental'
};

let { request: hostReq, response: hostRes } = require('./host');
let { defer: async } = require('../lang/functional');
let { defer } = require('../core/promise');
let { emit: emitSync, on, off } = require('../event/core');
let { uuid } = require('../util/uuid');
let emit = async(emitSync);

// Map of IDs to deferreds
let requests = new Map();

function receive ({data, id, error}) {
  let request = requests.get(id);
  if (request) {
    if (error) request.reject(error);
    else request.resolve(serialize(data));
    requests.delete(id);
  }
}
on(hostRes, 'data', receive);

/*
 * Send is a helper to be used in client APIs to send
 * a request to host
 */
function send (eventName, data) {
  let id = uuid();
  let deferred = defer();
  requests.set(id, deferred);
  emit(hostReq, 'data', {
    id: id,
    data: serialize(data),
    event: eventName
  });
  return deferred.promise;
}
exports.send = send;

function serialize (obj) JSON.parse(JSON.stringify(obj))
