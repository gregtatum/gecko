# Google API Account Type ("Gapi")

## The Name: "Gapi"

The singular goal was to avoid the verbosity of the much longer "GoogleAPI" and
the recognition that searching for "google" and "API" is usually not going to be
a productive search.

## Heterogeneous Account

Google API is our first heterogeneous account type, potentially handling a
combination of calendar and email as primary data sources, as well as
supplementary data lookups, for example document titles from their URLs.  This
is different from the original Firefox OS accounts (just email! Calendar was a
different app!) and the Bugzilla and Phabricator accounts which each had single
data types.

The current plan to deal with this is:
- Partition the conversation id space with single-letter prefixes for sanity
  purposes.
  - "c" for calendar events
  - "e" for emails.
- Have folders be internally homogeneous, introducing "calendar" as a new folder
  type which only contains calendar conversations/events.
- Not actually do anything with email yet.
- Namespace the tasks with "cal" and "email"

An alternate approach would have been to create separate accounts for the
calendar and email approaches, but that seems confusing and likely to introduce
additional coordination issues.

## Identifiers

### Folder Id's

We issue our own a64 one-up encoded folder identifiers.

### Calendar Identifiers

#### Conversation

We use the `id` of the calendar event for non-recurrences, and the
`recurrentEventId` of recurrence instances as the conversation id.  While not
as short as one-up id's, this eliminates the need to establish extra mappings.

Because we are using `singleEvents` expansion instead of performing expansions
ourselves, it's not actually necessary for us to structure the conversation
aggregation in this way for recurrences.  However, we do so because:
- This provides consistency with the iCal implementation where this organization
  is load-bearing.
- For sync purposes, this provides a beneficial slicing of calendar events to
  support optimization thanks to likely content and attendee overlaps.
- For UI purposes it does also seem likely that it might be interesting what
  the next or previous meetings might be, so the potential for aggregations here
  as well as easy access to next/previous events is beneficial.

#### Message

We use the full `id` of the calendar event.  For root recurrence events, this
will be the same as the conversation id.  For recurrence instances, this will
likely be the `recurrenceId` plus a suffixed transformation of the
`originalStartTime` if the id was issued by the Google Calendar API, but there's
nothing stopping other clients/API users for doing something that does not
follow this standard.

### Email Identifiers

TODO.

## Sync

### API Realities

- Calendar sync seems to be inherently per-calendar, although potentially with
  magical data propagation characteristics between calendars.  That is, the
  (accessible to user X) organizer's version of a calendar event is not
  semantically equivalent to user X's received copy of the calendar invite,
  although the UID at least should be the same.
  - Sync tokens are generated that seem to be unique tokens.
- Gmail seems to be surfacing a variation of global MODSEQ, where threads /
  messages have associated `historyId` fields and then `history.list` can be
  used to obtain the changes that happened since that history.
  - Both `messages.list` and `history.list` can take a list of labels of
    interest which means that it's possible to perform filtered synchronization.
- Gmail's ability to generate `history.list` entries is time-bounded, which
  seems to stem from the history encoding deltas rather than MODSEQ xrefs.

#### Relationship to Gmail IMAP Impl

Because of inherent limitations in the IMAP protocol around folder-centric
identifiers (particularly UIDs) and for general performance/consistency
concerns, we ended up using the "All Mail" folder as our only view into
(message) synchronization.

This isn't a concern under the API where identifiers are stable and (account)
global, making it feasible to synchronize on a per folder (label) basis if
desired.  However, synchronizing on a per-folder basis potentially creates
garbage collection and synchronization issues because that implies the different
folders can have different `historyId` views of the underlying data, which is
potentially awkward, especially since the history mechanism allows our sync
logic to be lazy and be spoon-fed the operations.

This suggests that the IMAP All Mail styled strategy is likely most pragmatic.
Specifically:
- Keep track of the labels we're interested in and how far back in time we are
  interested.
- Use a single sync task for all mail folders.
- Changes to messages would be bundled by the "thread" for consideration by a
  `sync_conv` task which would handle the actual manipulations and figuring out
  whether the conversation and its messages have now fallen out of the sync
  window and therefore if the conversation and its related messages should be
  dropped.
  - The "should this conversation and its messages be delisted" then likely
    becomes an intersection tests between the synchronized label time ranges and
    all of the messages in the conversation.  (That is, even if messages are
    stored on the messages and sparse, we would use the converastion's union of
    the labels, as I believe that to be Google's behavior and certainly the
    likely expected user view.)
    - This could potentially be configurable though if the user isn't using
      conversation view and/or our use case doesn't care.

### Calendar Folder Sync

#### Reccurencesm, singleEvents, and syncTokens

The `events/list` endpoint provides an option `singleEvents` that allows for the
server to expand recurring events so that this doesn't need to be done locally.
From limited experimentation for the "htmlLink and eids" section below, it seems
this mechanism generates cached phantom events that are stored somewhere such
that the `eid` is active for htmlLink purposes, but doesn't actually contaminate
the canonical events by creating a ton of no-op RECCURENCE-ID's.

These expanded `singleEvents` are conceptually fantastic, as they shield us from
doing recurrence expansions and needing to deal with the edge cases.  The main
stumbling block is that we practically need to specify `timeMax` since most
recurring events are defined in an open-ended fashion until the end of time,
resulting in infinite events.  However, optimizing to use the `syncToken`
mechanism to only be told deltas locks down the `timeMin` and `timeMax` for
sync purposes.  This means that expanding the sync window into the future, as
is inherently necessary for our use-cases, requires some combination of adding
additional sync windows with their own syncTokens and/or abandoning old sync
windows and reconciling the redundantly reported events when requesting a new
syncToken as well as dropping events that are no longer in the sync window.

Thankfully, reconciling redundantly reported events is a trivial concern, as
each event has an `updated` timestamp and this allows us to easily detect
whether it has changed or not.  And this need not involve checking each message
on disk; as long as we can safely choose a timestamp that's not vulnerable to
clock skew as a threshold, we can discard consideration of any events that
pre-date our `updated` threshold for syncing.

Evicting the moot events is made tractable by our folder-message index which
allow us to issue a query on all messages in a now-abandoned time range,
accumulating the list of impacted conversations, then issuing sync directives
for the conversations which convey the new time range.  The conversation handles
deleting any of its messages which fall outside the time range.  Alternately,
we could also try and ask the server for this information, but this has
potential for inconsistencies that leave around old data.  Correctness would
demand we both reuse our old syncToken to hear about deletions for the range
plus a new query for the current messages in that time range.  The new query
would likely want to occur first followed by the old syncToken for deletion
checking as otherwise there's a potential race where a deletion could occur
after the deletion check and the new "what's alive" check.

##### Trade-offs between singleEvents and manual expansion

singleEvents good:
- The side-effect of the `eid` links working is an important feature that could
  be annoying to attempt to re-create manually.  Especially since our
  mitigations might require mutations to the canonical state or otherwise
  require being online, such as synthetically inducing the caching side-effects
  of `singleEvents`.
- Having the Google server do the expansions for is appealing from a correctness
  perspective as it limits the potential for inconsistencies between Google's
  exposed UI and our UI.
  - That said, the underlying mechanism using existing iCal semantics does
    reduce the potential for this to be a real problem.
- Arguably the sync logic will be somewhat more straightforward by not having
  the recurrence logic integrated.

Recurring expansion good:
- We can expand recurrences while offline.
  - This is mitigated by just ensuring our time window sync extends far enough
    into the future that we don't care.
- Potentially reduced API traffic by being able to use a single syncToken over
  an extended period of time because we can issue an open-ended query into the
  future because we manage the recurrence expansions ourselves.
- If we wanted a feature to better report on changes to events, being the source
  of the generated recurring events likely would make it slightly easier to
  avoid getting confused by changes to the recurring event versus the
  extrapolated events.  (We'd need to post-filter for the single events.)
- It's not clear if we can easily tell whether a `singleEvents` expansion is
  actually a diverging recurrence for data reasons or it exists simply because
  we asked for it, which could lead to ambiguity about the optimal action to
  take when editing calendars.
  - HOWEVER, it's not clear we ever plan to have UI to edit a Google Calendar
    entry locally in our UI where we'll need to be the steward of the data.
    So far it seems like the only mutation we'd have is the RSVP yes/no/maybe
    scenario where our manipulation would very explicitly be for a single
    instance.
- For manual expansions, it's potentially a little easier for us to avoid
  scraping URL's redundantly if we can pre-compute the links for the base
  recurrence and the data-flow is aligned to this.

Neutral:
- Because the expanded `singleEvents` name their `recurringEventId` and the
  naming scheme is also very straightforward (instances just have an
  `_INSTANCEDATE` suffix added), there isn't really a concern about semantics.

Current sync decisions:
- Use `singleEvents` because:
  - The `htmlLink` issue is a key aspect of our core UX functionality.
  - Avoiding the complexity of reccurrence expansion and potential subtle bugs
    is a major upside even if it's offset by other sync engine complexity.
  - Any link-lookup caching seems like it can and should be handled by some
    combination of in-conversation content-awareness or an explicit additional
    task lookup layer.
    - But we don't need this now and there's the general question of also
      whether we should be trying to move URL lookup stuff closer to places and
      snapshots, possibly as data we push into them.
- Use a single active sync window with syncToken at a given time with logic that
  knows how to move the sync window.
  - It's not immediately clear whether it's better for sync_refresh to be in
    charge of its own floating window or whether there should be a separate
    sync_grow.  I'm leaning towards having sync_refresh handle this and
    potentially just be split out into a few methods internally.
  - When moving the sync window, we can potentially use `updatedMin` in order to
    further reduce the churn.
#### Calendar Sync Tasks

- `cal_sync_refresh.js`: per-folder/per-calendar sync.  Receives new, changed,
  and deleted calendar events as deltas and packages them for `cal_sync_conv.js`
  which is partially a misnomer but captures what's going on.
- `cal_sync_conv.js`: receives the new/changed/deleted calendar events.  Task
  planning is able to merge these deltas on a per-id basis.

#### Recurrence Mappings

The REST API still exposes all of the iCal semantics from under the hood, just
with different names.  Specifically, the iCal/vCal properties translate to the
Google values this way:

- `UID` for recurrence purposes of naming the root id is `recurringEventId`.
- `RRULE` is `recurrence` in gapi.
- `RECURRENCE-ID` is `recurrenceId` as exposed by icaljs and is
  `originalStartTime` in gapi.

#### htmlLink and eids

Here are two eids that are the payload of `htmlLink` properties as returned by
gapi:
- "bnBvYWduZHQyamxlbzE1dTdkYnRrdHYzZm9fMjAwNjA3MjYgbXZ1cTh1Z3NsOGRkOWUxN25tZGtkbGk1N2dAZw"
- "bnBvYWduZHQyamxlbzE1dTdkYnRrdHYzZm9fMjAxNDA3MjYgbXZ1cTh1Z3NsOGRkOWUxN25tZGtkbGk1N2dAZw"

If we base64 decode them with `atob` we get:
- "npoagndt2jleo15u7dbtktv3fo_20060726 mvuq8ugsl8dd9e17nmdkdli57g@g"
- "npoagndt2jleo15u7dbtktv3fo_20140726 mvuq8ugsl8dd9e17nmdkdli57g@g"

The key bits here:
- "npoagndt2jleo15u7dbtktv3fo" is the gapi id for the root recurrence event.
- "npoagndt2jleo15u7dbtktv3fo_20060726" is the gapi id for the recurrence with
  properties:
```json
   "recurringEventId": "npoagndt2jleo15u7dbtktv3fo",
   "originalStartTime": {
    "date": "2006-07-26"
   },
```

Note that this appears to be a naming convention and not some kind of automagic
way to create events on demand.  If we have a recurrence that exists by
expansion but does not yet exist as a sync record, then it becomes necessary for
us to either construct the event first, or potentially use "eventedit".

For example, if I click on "edit" for a similar nonexistent event, I end up at
`eventedit/Z2xkbG0zbTY2ZW5qazZzOWI4YmUyM20zZ2tfMjAyMTA3MjcgbXZ1cTh1Z3NsOGRkOWUxN25tZGtkbGk1N2dAZw`
which atob's into
`gldlm3m66enjk6s9b8be23m3gk_20210727 mvuq8ugsl8dd9e17nmdkdli57g@g`
where `gldl...` is actually a successor event to the example above (due to
a discontinuity in the recurring event).

Clicking on the edit UI to get there resulted in a POST to
`https://calendar.google.com/calendar/u/0/scheduler` of the following
form-encoded payload:

```json
{
	"emf": "mvuq8ugsl8dd9e17nmdkdli57g@group.calendar.google.com 20210727/20210728 0",
	"ctz": "America/New_York",
	"eid": "Z2xkbG0zbTY2ZW5qazZzOWI4YmUyM20zZ2tfMjAyMTA3MjcgbXZ1cTh1Z3NsOGRkOWUxN25tZGtkbGk1N2dAZw",
	"cwuik": "10",
	"hl": "en",
	"secid": "cqZx0zRsBpDzjcif2lOWDgCQx1g"
}
```

where that eid is exactly the subsequent path segment to `eventedit` which
suggests a general AJAX mechanism in use.

In fact, the response to that request was:
```json
{
	"schedule": [
		{
			"id": "mvuq8ugsl8dd9e17nmdkdli57g@group.calendar.google.com",
			"type": "GROUP",
			"resolved": [
				{
					"id": "mvuq8ugsl8dd9e17nmdkdli57g@group.calendar.google.com",
					"type": "GROUP",
					"self": true,
					"status": "OK",
					"parentGroups": []
				}
			]
		}
	],
	"freshness": "63762674914"
}
```

