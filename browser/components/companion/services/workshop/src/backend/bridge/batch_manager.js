/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import logic from "logic";

/**
 * As EntireListProxy and WindowedListProxy have things to tell their MailAPI
 * counterpart they tell the BatchManager and it controls when they actually
 * trigger the flush.
 *
 * Originally SliceBridgeProxy instances would make these decisions themselves
 * and just use a combination of a size limit and a setZeroTimeout to schedule
 * their delivery.  However, the v1 sync mechanism was both 1) much more likely
 * to generate a bunch of events in a single turn of the event loop and 2)
 * unable to perform any type of consolidation or avoid generating waste.  Under
 * the v3 task architecture, sync is much more granular and the event loop will
 * turn a lot and the WindowedListProxy can avoid telling the front-end things
 * it doesn't need to know or telling it the same thing multiple times.
 *
 * For now this just uses a fixed 100ms timeout for batching.  Tests will
 * probably want to put things in a "flush immediately" mode or "flush
 * explicitly when I say/after some other stuff has happened".
 *
 * TODO: Adapt root cause id mechanism to allow flushing to occur exactly when
 * appropriate and thereby cancel the timeout.  We will still always want
 * timeouts, however, since unbounded feedback delays suck.
 */
export class BatchManager {
  constructor(db) {
    logic.defineScope(this, "BatchManager");

    this._db = db;
    this._pendingProxies = new Set();
    /**
     * When null, there's no timer scheduled.  When `true`, it means we scheduled
     * a Promise to do the flush.  Otherwise it's a number that's a timer handle
     * that we can use to invoke clearTimeout on.
     */
    this._timer = null;

    this._bound_timerFired = this._flushPending.bind(this, true, false);
    this._bound_dbFlush = this._flushPending.bind(this, false, false);

    // Originally this was set to 100ms with the rationale that we should update
    // the UI in a timely fashion but avoid DOM churn for efficiency reasons.
    //
    // We've now increased the value to 5sec because the `BridgeContext` now
    // triggers flushes via `flushBecauseTaskGroupCompleted` when tasks
    // complete in the interest of reducing visual churn for users.  We maintain
    // a time-based delay right now so that in failure modes the UI doesn't
    // completely break and when a lot of stuff is happening the UI still
    // updates.  I initially thought 1sec but that's still pretty frequent and
    // could potentially trigger in automated testing situations under debug
    // builds (or rr), so adjusted it upwards to 5sec.  We might want to adjust
    // even further upwards but should re-evaluate after trying this.
    this.flushDelayMillis = 5000;

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
      // TODO: this is arguably expensive; investigate logic on-demand funcs
      tocTypes: Array.from(this._pendingProxies).map(proxy => {
        return proxy.toc.type;
      }),
      timerFired,
      coherentSnapshot,
    });
    for (let proxy of this._pendingProxies) {
      // Skip this proxy if it's not dirty and this isn't a coherent flush.  We
      // keep the proxy around because it still needs a coherent snapshot, but
      // there's no point sending an update without any information in it.
      if (!proxy.dirty && !coherentSnapshot) {
        continue;
      }
      const payload = proxy.flush();

      // If a database load is required, this will already be false.
      payload.coherentSnapshot &&= coherentSnapshot;
      proxy.ctx.sendMessage("update", payload);

      // If this was a coherent snapshot, we can clear the bit on the proxy and
      // stop tracking the proxy until it re-dirties itself in the future (and
      // simultaneously sets `needCoherentFlush` to true as well).
      if (payload.coherentSnapshot) {
        proxy.needsCoherentFlush = false;
        this._pendingProxies.delete(proxy);
      }
    }
  }

  flushBecauseTaskGroupCompleted() {
    this._flushPending(false, true);
  }

  /**
   * Register a dirty view, potentially accelerating the flush.
   *
   *
   * @param {false|'soon'|'immediate'} [flushMode=false]
   *   If false, we will use our regular flushing semantics.  If 'soon', we will
   *   use a setTimeout(0) in order to schedule it as soon as we can after
   *   letting all Promise/micro-task-based things run to completion.  If
   *   'immediate' we do it right now.  You would want an immediate flush when
   *   servicing a request from the front-end and where you are certain that the
   *   result answer is one of: final/stable, latency-sensitive, or preliminary
   *   but the final answer will take at least a user-perceptible amount of
   *   time.
   */
  registerDirtyView(proxy, flushMode) {
    logic(this, "dirtying", {
      tocType: proxy.toc.type,
      ctxName: proxy.ctx.name,
      flushMode,
      alreadyDirty: this._pendingProxies.has(proxy),
    });

    this._pendingProxies.add(proxy);

    if (flushMode) {
      if (flushMode === "immediate") {
        this._flushPending(false);
      } else if (this._timer !== true) {
        // therefore: flushMode === 'soon'
        // Our conditioanl means we're only in here if a promise isn't already
        // scheduled.
        if (this._timer) {
          // which means this is a timer we need to clear if truthy.
          globalThis.clearTimeout(this._timer);
        }
        Promise.resolve().then(() => {
          this._flushPending(false);
        });
        this._timer = true;
      }
    } else if (!this._timer) {
      this._timer = globalThis.setTimeout(
        this._bound_timerFired,
        this.flushDelayMillis
      );
    }
  }
}
