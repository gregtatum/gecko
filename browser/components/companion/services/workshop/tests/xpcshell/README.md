## General Test Operation

### Workshop Background

Services Workshop operates with a front-end/back-end split.  The back-end
operates in a SharedWorker and communicates with one or more front-end API
instances over the MessagePorts exposed via the SharedWorker binding in the
front-end and by the "connect" event in the back-end SharedWorker.

### Test Globals and Isolation

## Test Flow

- Iterate over list of supported account types for the given coverage.
- Create a testing task for each.
- Add the account.
-
