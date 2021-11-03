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

### Parser tests

- The two first articles in test_hfeed.html come from [microformats.org](http://microformats.org/wiki/h-feed#Publisher_Compatibility) and are licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/legalcode).
- The file test_jsonfeed.json contains a json from [wikipedia](https://en.wikipedia.org/wiki/JSON_Feed#Example) which is licensed under [CC BY-SA](https://en.wikipedia.org/wiki/Wikipedia:Text_of_Creative_Commons_Attribution-ShareAlike_3.0_Unported_License)
and has been slightly modified in adding some "wrong" fields.
