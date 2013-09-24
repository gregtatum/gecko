/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function TCPSocketParentIntermediary() {
}

TCPSocketParentIntermediary.prototype = {
  _setCallbacks: function(aParentSide, socket) {
    aParentSide.initJS(this);
    this._socket = socket;

    // Create handlers for every possible callback that attempt to trigger
    // corresponding callbacks on the child object.
    ["open", "drain", "data", "error", "close"].forEach(
      function(p) {
        socket["on" + p] = function(data) {
          aParentSide.sendCallback(p, data.data, socket.readyState,
                                   socket.bufferedAmount);
        };
      }
    );
 },

  open: function(aParentSide, aHost, aPort, aUseSSL, aBinaryType, aAppId) {
    let baseSocket = Cc["@mozilla.org/tcp-socket;1"].createInstance(Ci.nsIDOMTCPSocket);
    let socket = baseSocket.open(aHost, aPort, {useSecureTransport: aUseSSL, binaryType: aBinaryType});
    if (!socket)
      return null;

    let socketInternal = socket.QueryInterface(Ci.nsITCPSocketInternal);
    if (socketInternal) {
      socketInternal.setAppId(aAppId);
    }

    // Handlers are set to the JS-implemented socket object on the parent side.
    this._setCallbacks(aParentSide, socket);
    return socket;
  },

  listen: function(aTCPServerSocketParent, aLocalPort, aBacklog, aBinaryType) {
    let baseSocket = Cc["@mozilla.org/tcp-socket;1"].createInstance(Ci.nsIDOMTCPSocket);
    let serverSocket = baseSocket.listen(aLocalPort, { binaryType: aBinaryType }, aBacklog);
    if (!serverSocket)
      return null;

    let localPort = serverSocket.localPort;

    serverSocket["onconnect"] = function(socket) {
      var socketParent = Cc["@mozilla.org/tcp-socket-parent;1"]
                            .createInstance(Ci.nsITCPSocketParent);
      var intermediary = new TCPSocketParentIntermediary();
      // Handlers are set to the JS-implemented socket object on the parent side,
      // so that the socket parent object can communicate data
      // with the corresponding socket child object through IPC.
      intermediary._setCallbacks(socketParent, socket);
      // The members in the socket parent object are set with arguments,
      // so that the socket parent object can communicate data 
      // with the JS socket object on the parent side via the intermediary object.
      socketParent.setSocketAndIntermediary(socket, intermediary);
      aTCPServerSocketParent.sendCallbackAccept(socketParent);
    };

    serverSocket["onerror"] = function(data) {
        var error = data.data;

        aTCPServerSocketParent.sendCallbackError(error.message, error.filename,
                                                 error.lineNumber, error.columnNumber);
    };

    return serverSocket;
  },

  sendString: function(aData) {
    return this._socket.send(aData);
  },

  sendArrayBuffer: function(aData) {
    return this._socket.send(aData, 0, aData.byteLength);
  },

  classID: Components.ID("{afa42841-a6cb-4a91-912f-93099f6a3d18}"),
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsITCPSocketIntermediary
  ])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([TCPSocketParentIntermediary]);
