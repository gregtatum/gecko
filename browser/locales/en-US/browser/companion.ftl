# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

companion-join-meeting = Join meeting
companion-email-late = Running late
companion-open-calendar = Open in calendar
companion-hide-event = Dismiss event
companion-copy-invite = Copy invite link
companion-message-host = Message host
companion-message-attendees = Message attendees
companion-event-document-and-links = Documents & Links
companion-event-host = Host
companion-event-organizer = Organizer
companion-event-creator = Creator
companion-refresh-services-button =
    .title = Refresh services
companion-refresh-services-button-syncing =
    .title = Syncing services
companion-fake-time = Fake time to 10m:10 before
calendar-event-hide-details =
    .aria-label = Hide details
calendar-event-show-details =
    .aria-label = Show details

# This is a short label to show how many more links are available to be
# shown for a calendar event in the companion.
# Variables:
#   $linkCount (Number) - number of links hidden for an event
companion-expand-event-links-button = +{ $linkCount }
    .title = Show all links
companion-collapse-event-links-button = +{ $linkCount }
    .title = Hide extra links

# This is a short label to show when the start of an event is happening in less
# than an hour (eg: In 10 minutes).
# Variables:
#   $minutes (Number) - Minutes until the event starts.
companion-until-event-minutes =
    { $minutes ->
        [0] Now
        [one] In { $minutes } minute
       *[other] In { $minutes } minutes
    }

# This is a short label to show when the start of an event is happening in over
# an hour (eg: In 1 hour and 10 mins).
# Variables:
#   $hours   (Number) - Hours until the event starts
#   $minutes (Number) - Minutes until the event starts
companion-until-event-both =
    In { $hours ->
        [one] { $hours } hour
       *[other] { $hours } hours
    } and { $minutes ->
        [one] { $minutes } min
       *[other] { $minutes } mins
    }

# This is a short label to show when the start of the event is happening in over
# an hour, but there are no remaining minutes (eg: In 1 hour).
# Variables:
#   $hours   (Number) - Hours remaining until the event ends
companion-until-event-hours =
    { $hours ->
        [0] Now
        [one] In { $hours } hour
       *[other] In { $hours } hours
    }


# This is a short label to show the remaining time left of an event ending in
# over an hour. (eg: Now (1 hour and 20 mins left) ).
# Variables:
#   $hours   (Number) - Hours remaining until the event ends
#   $minutes (Number) - Minutes remaining until the event ends
companion-happening-now-both =
    Now ({ $hours ->
        [one] { $hours } hour
       *[other] { $hours } hours
    } and { $minutes ->
        [one] { $minutes } min
       *[other] { $minutes } mins
    } left)

# This is a short label to show the remaining time left of an event ending in
# over an hour, but with no remaining minutes (eg: Now (1 hour left) ).
# Variables:
#   $hours   (Number) - Hours remaining until the event ends
companion-happening-now-hours =
    { $hours ->
        [0] Now
        [one] Now ({ $hours } hour left)
       *[other] Now ({ $hours } hours left)
    }

# This is a short label to show the remaining time left of an event ending in
# minutes (eg: Now (5 mins left) ).
# Variables:
#   $minutes (Number) - Minutes remaining until the event ends
companion-happening-now-minutes =
    { $minutes ->
        [0] Now
        [one] Now ({ $minutes } min left)
       *[other] Now ({ $minutes } mins left)
    }

companion-up-next = Up next
companion-starting-soon = Starting soon
companion-happening-now = Happening now
companion-ending-soon = Ending soon
companion-almost-over = Almost over
companion-event-finished = Finished

# This is used to show the number of minutes between two events indicating that
# there is a small break (eg: 10 minute break).
# Variables:
#   $duration (Number) - Length of the break in minutes
companion-event-break = { $duration } minute break

# Shown on the companion onboarding card when visiting a site that we support
# integrations for, but the user hasn't signed in. Ex: Google [Connect]
companion-onboarding-service-connect = Connect
# Shown on the companion onboarding card when a user has signed in to Flowstate
# with a service.
companion-onboarding-service-connected = Connected
# Shown on the companion onboarding card when a user has started to connect to a
# service and they are currently logging in.
companion-onboarding-service-connecting = Connecting…

# This string is used in the page action menu to indicate the
# security status of a view.
companion-page-action-secure-page = This website is using a secure connection.

companion-pocket-interesting-reads = Interesting Reads
companion-pocket-powered-by = Powered by Pocket

# The title of the Last Session section in the companion.
last-session-title = Last Session

# This string is used in the browse tab of the companion in a button that
# restores the users last session.
restore-session = Restore

# This string is used to describe the toggle action of the session card button
session-card-toggle =
  .aria-label = Expand session card

# This string is used session cards to display the number of sites within a session
session-pages-count =
    { $pages ->
        [one] { $pages } site
       *[other] { $pages } sites
    }

# These are shown in the now tab when the user has set aside a session and
# entered "Flow Reset" state.
session-cleared-title = Start fresh
session-cleared = Your last session has been saved in <a data-l10n-name="session-cleared-link">Browse</a>

# This is shown when you try to install an addon in Flowstate that is not on the allowed list.
# It overrides the default message that is normally used by enterprise policy.
addons-unsupported = { -brand-short-name } does not support this extension.

# These are menu items shown on snapshot cards in the companion.
snapshot-dismiss = Dismiss
snapshot-not-relevant = Not relevant
snapshot-personal = This is personal
snapshot-options =
  .aria-label = Options

# The names of sections in the Browse tab of the companion.
browse-list-snapshot-groups = Snapshot Groups
browse-list-sessions = Sessions
browse-list-downloads = Downloads
browse-list-passwords = Passwords
browse-list-calendar = Calendar
browse-list-history = History

# Titles of the browse sections.
session-section-header = Sessions
snapshot-group-section-header = Snapshot Groups

# Titles of groups displayed in the Snapshot Groups section
snapshot-group-pinned-header = Pinned

# Title of the Download section.
downloads-section-header = Downloads

# Title of the History section.
history-section-header = History

# The title of the tab buttons at the top of the companion.
companion-deck-now = Now
companion-deck-browse = Browse

# The < back arrow to go back to the root Browse view.
companion-header-back-button =
    .aria-label = Go back

# Shows the number of snapshots within a group.
# Variables:
#   $snapshotCount (Number) - Number of snapshots.
snapshot-count = { $snapshotCount } Snapshots

# Labeling for the Picture-in-Picture button in the media card
companion-picture-in-picture-label =
    .aria-label = Picture-in-Picture
    .title = Picture-in-Picture

# Labeling for the video controls in the media card
companion-videocontrols-play-button =
    .aria-label = Play
    .title = Play
companion-videocontrols-pause-button =
    .aria-label = Pause
    .title = Pause
companion-videocontrols-next-button =
    .aria-label = Next
    .title = Next
companion-videocontrols-previous-button =
    .aria-label = Previous
    .title = Previous

# Title of the calendar section in the browse companion view.
companion-browse-calendar-header = Calendar

# Message displayed in the calendar browse view when no accounts are connected.
companion-calendar-not-connected = You have no connected accounts.

# Message displayed in the calendar browse view when there are no events.
companion-calendar-no-items = You have no calendar items.

# This label should be written in all capital letters if your locale supports them.
history-recently-viewed = RECENTLY VIEWED

# Variables:
#   $totalBeforeLimit (Number) - The total number of results from a history
#                                query before limiting is applied.
history-results-total-before-limit = { $totalBeforeLimit } results
# Variables:
#   $total (Number) - The total number of results displayed with limiting applied.
#   $totalBeforeLimit (Number) - The total number of results from a history
#                                query before limiting is applied.
history-results-limit-out-of-total = Viewing 1-{ $total } out of { $totalBeforeLimit } results
history-results-refine-query = Refine your search
history-results-search-input =
  .placeholder = Search in History…
