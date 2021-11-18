/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["PageWireframeChild"];

/**
 * An object that listens to location changes on a top-level
 * frame, and sends wireframes up to the parent process before
 * the page unloads.
 */
class LocationChangeListener {
  onLocationChange(aWebProgress, aRequest, aLocation, aFlags) {
    if (!aWebProgress.isTopLevel) {
      return;
    }

    let window = aWebProgress.DOMWindow;
    let document = window.document;
    let wireframe = document.getWireframe();
    if (!wireframe) {
      return;
    }

    wireframe.rects = wireframe.rects.filter(r => {
      return r.type == "background" || r.type == "text";
    });
    wireframe.rects.reverse();
    wireframe.width = document.documentElement.clientWidth;
    wireframe.height = document.documentElement.clientHeight;
    let actor = window.windowGlobalChild.getActor("PageWireframe");
    actor.sendAsyncMessage("Wireframe", { wireframe });
  }

  QueryInterface = ChromeUtils.generateQI([
    Ci.nsIWebProgressListener,
    Ci.nsISupportsWeakReference,
  ]);
}

class PageWireframeChild extends JSWindowActorChild {
  static registeredListeners = new WeakSet();

  handleEvent(event) {
    if (
      event.type == "MozFirstContentfulPaint" &&
      !PageWireframeChild.registeredListeners.has(this)
    ) {
      let listener = new LocationChangeListener();
      let filter = Cc[
        "@mozilla.org/appshell/component/browser-status-filter;1"
      ].createInstance(Ci.nsIWebProgress);

      filter.addProgressListener(listener, Ci.nsIWebProgress.NOTIFY_LOCATION);
      let webProgress = this.docShell.QueryInterface(Ci.nsIWebProgress);
      webProgress.addProgressListener(
        listener,
        Ci.nsIWebProgress.NOTIFY_LOCATION
      );

      PageWireframeChild.registeredListeners.add(this);
    }
  }
}
