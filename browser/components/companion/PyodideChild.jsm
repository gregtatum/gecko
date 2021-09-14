/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["PyodideChild"];

class PyodideChild extends JSWindowActorChild {
  handleEvent({ type }) {
    if (type == "pyodideReady") {
      this.sendAsyncMessage("pyodideReady");
    }
  }
  async receiveMessage({ name, data }) {
    if (name == "execute") {
      let waivedContent = Cu.waiveXrays(this.browsingContext.window);
      return waivedContent.exec(
        Cu.cloneInto(data, this.browsingContext.window)
      );
    }

    return undefined;
  }
}
