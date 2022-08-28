# The Plan

This is currently speculative.

## Use Case

This feed account type is useful to synchronize with an Atom feed or a RSS one.
Atom or RSS are some details of implementation of the same thing: feeds so all
the different kind of feeds live in the same account.

## Data Model

### Conversation / Message Hierarchy

#### Entries in feed as message

Each atom:entry or rss:item are a single message with an author, a date and
a description (and possibly some contents) and this message is the element of
one single conversation..

## Sync Strategy

### Network

Just get data from the given feed url and add only the new messages:
  - each message has a guid and this one is used to create a conversation id and then
    a new message is one which hasn't an associated conversation.
    
So for now it's pretty basic but in the future it could interesting to check if contents
are the same for two identical messages (identical from a guid point of view).
