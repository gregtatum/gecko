## Folder List Synchronization

We use a single task to synchronize the list of calendars and the list of mail
folders (TODO).  These might end up being split into separate tasks if the
logic gets too unwiedly, but we're not doing that yet because there's no clear
advantage to doing so because they both would want exclusive access to the list
of folders.

## Calendar Sync

Calendar sync happens on a per-calendar (folder) basis.

### Calendar Sync State

Calendar sync states are keyed with the folder id they correspond to.  If no
sync state exists for a folder, it hasn't yet been synchronized.

- syncToken: The next synchronization token to use.
- rangeOldestTS: The JS milliseconds since epoch boundary of the oldest
  event date we are synchronizing and manifesting recurrence instances for.
  This will be in the past.
- rangeNewestTS: The JS milliseconds since epoch boundary of the newest event
  date we are synchronizing and manifesting recurrence instances for.  This
  will be set in the future.
