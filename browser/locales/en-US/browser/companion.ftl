# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

companion-join-meeting = Join meeting
companion-email-late = Running late
companion-open-calendar = Open in calendar
companion-event-document-and-links = Documents & Links
companion-event-host = Host
companion-event-organizer = Organizer
companion-event-creator = Creator
companion-refresh-services-button =
    .title = Refresh services
companion-refresh-services-button-syncing =
    .title = Syncing services

# This is a short label to show how many more links are available to be
# shown for a calendar event in the companion.
# Variables:
#   $linkCount (Number) - number of links hidden for an event
companion-expand-event-links-button = +{ $linkCount }
    .title = Show all links

# This is a short label to show when the start of an event is happening in less
# than an hour (eg: In 10 mins).
# Variables:
#   $minutes (Number) - Minutes until the event starts.
companion-until-event-minutes =
    { $minutes ->
        [0] Now
        [one] In { $minutes } min
       *[other] In { $minutes } mins
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

companion-event-finished = Finished

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
