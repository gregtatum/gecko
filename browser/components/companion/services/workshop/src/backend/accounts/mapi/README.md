# Microsoft API Account Type ("Mapi")

## The Name: "Mapi"

The singular goal was to avoid the verbosity of the much longer "Microsoft API" and
the recognition that searching for "microsoft" and "API" is usually not going to be
a productive search.

## Identifiers

### Folder Id's

### Calendar Identifiers

#### Conversation

In order to use the delta api from Microsoft Graph, we use the calendarView option
which provides the events for a given period of time so consequently recurring
events are expanded (i.e. some events are generated from the main recurring
event with the correct period). In the retrieved events, some of them can have
the type "occurence" and make a reference to the main event through the property
`seriesMasterId`. One instance of the master event must be in the list of the events
and will contain any information that the occurences haven't.

#### Message

We use the full `id` of the calendar event.
### Email Identifiers

TODO.

## Sync

### API Realities

### Calendar Folder Sync

#### Reccurencesm, singleEvents, and syncTokens

The Microsoft Graph API provides a calendarView (https://docs.microsoft.com/en-us/graph/api/calendar-list-calendarview)
option to have only `singleEvents` which are either real single events or expanded
from a recurring event. It's possible to get real events as they're defined in the
calendar in using the events option (see https://docs.microsoft.com/en-us/graph/api/user-list-events).
The main drawback of events option is that we can't use an incremental
update (no delta): it's only available with calendarView.
See the README in gapi account to have the pros/cons about having `singleEvents`
vs `recurringEvents`.

#### Calendar Sync Tasks

- `cal_sync_refresh.js`: per-folder/per-calendar sync.  Receives new, changed,
  and deleted calendar events as deltas and packages them for `cal_sync_conv.js`
  which is partially a misnomer but captures what's going on.
- `cal_sync_conv.js`: receives the new/changed/deleted calendar events.  Task
  planning is able to merge these deltas on a per-id basis.

