# logic.js log accumulation and hierarchy building

## Context

The `logic.js` logging library is a re-invention of the `loggest` framework
which provided for a (tightly coupled, stateful) mechanism to allow tests to be
written against expected logs using a manually defined logging schema.
`logic.js` side-stepped the coupling by eliminating explicit schemas and having
any semantic hierarchies (or assertions) resulting from consuming the naive log
stream.  `logic.js` also opted, similar to many other modern structured logging
approaches, to potentially redundantly encode any state/identifying values into
every message rather than depending on a log processor to have seen the entire
prior log stream (or lifecycle messages).

## Overview

The files in this directory handle:
- Receiving / Retrieving the logs from the backend and frontend.
  - Currently this is handled through naive use of `BroadcastChannel`.  In the
    past for Firefox OS, a circular buffer could be enabled that was in-memory
    only and retrieved from the back-end on demand.
- Limited hierarchy building for slicing/dicing purposes.
  - The linear view of all log entries displayed sequentially is useful, but
    there are several ways the logs can be sliced/diced to be more useful:
    - Tasks can create an explicit task graph.
    - Requests from the front-end can be explicitly linked-up with their
      responses from the back-end, both for single-shot request/response plus
      the list view/proxy persistent subscriptions.

## Hierarchy Derivation

### logic.js primitives

Logic only has scopes.  There's a concept of subscopes, but this is effectively
just a means of currying additional properties that can be used by convention
to introduce an additional level of hierarchy by including additional id
information.  Logic does not assign unique identifiers to scope instances;
those have to come from the caller.  Accordingly, building up hierarchies
requires callers to explicitly indicate their own identifiers and relationships
to other logger callers.

Code in this directory then needs to dervive those semantic relationships
either via heuristics (ex: `fooParentId` will establish an upward link to
`fooId`) or explicit namespace awareness.

### Containment and Causality

