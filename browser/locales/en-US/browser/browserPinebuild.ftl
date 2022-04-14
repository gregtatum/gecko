# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

pinebuild-back-button =
  .tooltiptext = Long press to scroll back through history

active-view-manager-overflow-button-text = +{$count}

# Page action menu strings.
page-action-menu-button =
  .title = Open Page Action Menu

page-action-toggle-pinning-view =
  .label = { $isPinned ->
     [true] Unpin view
    *[other] Pin view
  }
page-action-toggle-pinning-app =
  .label = { $isPinned ->
     [true] Unpin app
    *[other] Pin app
  }
page-action-copy-url =
  .label = Copy
page-action-close-view =
  .label = Close
page-action-toggle-muting =
  .label = { $isMuted ->
     [true] Unmute
    *[other] Mute
  }
page-action-reader-view =
  .label = Reader View
page-action-more =
  .label = More

last-session-saved = Last session saved in Companion

# Flowstate connection security strings.
page-action-menu-secure-page = This website is using a secure connection.
page-action-menu-reader-view = This page is in Reader View.

# This label should be written in all capital letters if your locale supports them.
active-view-manager-overflow-panel-title = RECENT

active-view-manager-context-menu-toggle-pinning =
  .label = { $isPinned ->
     [true] Unpin
    *[other] Pin
  }

active-view-manager-context-menu-close-view-group =
  .label = { $viewCount ->
     [1] Close View
    *[other] Close View Group
  }
