# Calendar

## Dataflow

### CompanionParent / CompanionChild

`CompanionParent.jsm` and `CompanionChild.jsm` establish a communication bridge
between the parent process and window globals.  Currently these connect to:
- Per-window companion sidebars.  These will exist in the privileged content
  process.
- The `about:preferences` UI.  This currently exists in the parent process
  instead of the privileged content process.  This is unlikely to change because
  the UI in general likes to talk to XPCOM services that are only accessible
  in the parent process.

These communicate using messages that have names like `Companion:Foo`.  The
actor mapping is [defined in BrowserGlue.jsm](https://searchfox.org/mozilla-pine/rev/62ca671af7d48f8b0ac4e4d144c4fd9e7779ff34/browser/components/BrowserGlue.jsm#1307-1321)
and defines what URL patterns the actor should match.  (It's set to match both
the companion file and `about:preferences`.)

Because there can be multiple companion sidebars, parent process logic that
wants to relay information to all sidebars needs a broadcast mechanism.  The
observer service accessed via `Services.obs` is used for this.

#### Observer Notifications

- "companion-signin" => "Companion:SignIn"
- "companion-signout" => "Companion:SignOut"
- "companion-services-refresh" => "Companion:RegisterCalendarEvents"
- "oauth-refresh-token-received" => "Companion:OAuthRefreshTokenReceived"
- "oauth-access-token-error" => "Companion:OAuthAccessTokenError"

#### Companion Parent to Child

Note that these message also get re-broadcast as
[custom events on the window](https://searchfox.org/mozilla-pine/rev/62ca671af7d48f8b0ac4e4d144c4fd9e7779ff34/browser/components/companion/CompanionChild.jsm#169,174,177)
and are handled in `browser/components/companion/content/calendar.js`.

- "Companion:Setup": Multi-consumer, relevant calendar field is
  `connectedServices: OnlineServices.connectedServiceTypes`.
- "Companion:SignIn" => document event "refresh-events"
- "Companion:RegisterCalendarEvents" => document event "refresh-events"
  - Note: Also propagates hacky data URI favicon cache as it runs.

#### Companion Child to Parent

- "Companion:AccountCreated" => observer "companion-signin"
- "Companion:AccountDeleted" => observer "companion-signout"
- "Companion:CalendarPainted" => Glean telemetry logged
- "Companion:ConnectService" => OnlineServices.createService
- "Companion:GetOAuth2Tokens" => new OAuth2(), connect() => reply with JSON
  - Workshop-supporting dataflow.

### UI

#### about:preferences

This code runs in the parent process!

##### Refresh Button

- Workshop enabled: Uses `Workshop.refreshServices()`
- Workshop not enabled: Directly reaches into OnlineServices to call
  `fetchEvents()`.


### Timers

- In every companion window every 1 minute (but it really shouldn't be in every
  window):
  - Workshop enabled:
    - document event "refresh-view" => calls `refresh()` on the list view if it
      exists.  This has the back-end check for changed/modified calendars but
      without rebuilding the listview (which "refresh-events" would do).
  - Workshop disabled:
    - document event "refresh-events"

### Document Events

- "refresh-events":
  - Workshop: Dispatched when the set of accounts has changed.  This includes
    destroying the Workshop listview and re-querying it.  This is not necessary
    during general operation, so "refresh-view" was created for the less
    dramatic situation where we want to check with the server but without
    completing resetting all UI state.
  - Non-workshop: Dispatched whenever the calendar UI should refresh.
- "refresh-view":
  - Workshop: Dispatched whenever workship should check with the server for
    changes.
  - Non-workshop: Not dispatched.

