# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

pinebuild-back-button =
  .tooltiptext = Long press to scroll back through history

pinebuild-reload-button =
  .tooltiptext = Reload current view

pinebuild-companion-button-is-open =
  .tooltiptext = Close Companion

pinebuild-companion-button-is-closed =
  .tooltiptext = Open Companion

toolbar-button-setaside-session =
  .label = Set Aside Session
  .tooltiptext = Set aside this session

active-view-manager-overflow-button = +{$count}
  .title = Recent views

# Page action menu strings.
page-action-menu-button =
  .title = Open page action menu

page-action-toggle-pinning-view-unpinned =
  .label = Pin view
  .tooltiptext = Pin to save this view

page-action-toggle-pinning-view-pinned =
  .label = Unpin view
  .tooltiptext = Unpin this view

page-action-toggle-pinning-app-unpinned =
  .label = Pin app
  .tooltiptext = Pin to save this app

page-action-toggle-pinning-app-pinned =
  .label = Unpin app
  .tooltiptext = Unpin this app

page-action-copy-url =
  .label = Copy
  .tooltiptext = Copy link to clipboard
page-action-close-view =
  .label = Close view
  .tooltiptext = Close view
page-action-toggle-muting-unmuted =
  .label = Mute
  .tooltiptext = Mute media with audio
page-action-toggle-muting-muted =
  .label = Unmute
  .tooltiptext = Unmute media with audio

page-action-reader-view =
  .label = Reader View
  .tooltiptext = View in Reader Mode
page-action-more =
  .label = More
page-action-menu-site-info-edit-icon =
  .tooltiptext = Edit page title

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

# Pinebuild onboarding strings
onboarding-fxa-label = Go to Firefox Accounts
onboarding-complete-label = Complete onboarding
onboarding-flow-welcome-title = Welcome to { -brand-short-name }
onboarding-flow-welcome-text-1 = Less clutter. More focus.<br/> Always in the flow.
onboarding-flow-welcome-text-2 = Thanks for being one of the first to try out the new browser from { -vendor-short-name }.  Get set up in just a few steps.

onboarding-flow-connect-title = Connect your { -fxaccount-brand-name(capitalization: "sentence") }
onboarding-flow-connect-text = A new way to internet is just ahead. Log in or create an account to unlock { -brand-short-name }.

onboarding-flow-connected-title = { -fxaccount-brand-name(capitalization: "sentence") } connected
onboarding-flow-connected-text = Your account has been verified. Just two more steps and you’ll be on your way.

onboarding-flow-data-prefs-title = Choose what data to share with { -brand-short-name }
onboarding-flow-data-prefs-text = { -brand-short-name }’s data protection policy puts your privacy first. We will never collect data without your permission.
onboarding-learn-more-link = Learn More
onboarding-flow-data-prefs-label-firefox-suggest = Improved { -firefox-suggest-brand-name }
onboarding-flow-data-prefs-label-firefox-suggest-detail = A richer search experience by allowing { -vendor-short-name } to process your search queries.
onboarding-flow-data-prefs-label-better-browsing = Get smarter recommendations
onboarding-flow-data-prefs-label-better-browsing-detail = Improve your snapshot suggestions by sharing your browsing history with { -vendor-short-name }. We will always put your privacy first.
onboarding-flow-data-prefs-label-usage-statistics = Send usage data and telemetry
onboarding-flow-data-prefs-label-usage-statistics-detail = { -brand-short-name } sends technical and interaction data to { -vendor-short-name }.
onboarding-flow-privacy-policy-header = About { -brand-short-name }
onboarding-flow-privacy-policy-connected-header = { -brand-short-name } is a connected service
onboarding-flow-privacy-policy-placeholder =
  Lorem ipsum dolor sit amet. Sed ac accumsan sapien, vitae accumsan neque. Aliquam a tempus orci. Sed at nulla gravida, fringilla turpis eu, mattis elit. Vivamus at turpis condimentum, euismod ipsum vel, maximus nisl. Sed sapien dui, dapibus porttitor placerat sed.

  Nullam mollis sit amet tellus a viverra. Nunc fermentum, eros et dapibus rutrum, diam mauris auctor quam.

  Nullam ac magna id elit imperdiet suscipit. Aliquam convallis leo at tempor faucibus.

  Etiam aliquam, dui vitae facilisis eleifend, dolor neque ultrices lorem, non interdum metus nunc a nisi. Vivamus accumsan neque id turpis vestibulum sollicitudin. Proin tincidunt erat ligula, sit amet faucibus dolor accumsan lacinia. Phasellus molestie mollis arcu non cursus.
onboarding-flow-privacy-policy-placeholder-2 =
  Lorem ipsum dolor sit amet. Sed ac accumsan sapien, vitae accumsan neque. Aliquam a tempus orci. Sed at nulla gravida, fringilla turpis eu, mattis elit. Vivamus at turpis condimentum, euismod ipsum vel, maximus nisl. Sed sapien dui, dapibus porttitor placerat sed.

  Nullam mollis sit amet tellus a viverra. Nunc fermentum, eros et dapibus rutrum, diam mauris auctor quam.

  Nullam ac magna id elit imperdiet suscipit. Aliquam convallis leo at tempor faucibus.

  Etiam aliquam, dui vitae facilisis eleifend, dolor neque ultrices lorem, non interdum metus nunc a nisi. Vivamus accumsan neque id turpis vestibulum sollicitudin. Proin tincidunt erat ligula, sit amet faucibus dolor accumsan lacinia. Phasellus molestie mollis arcu non cursus.

onboarding-flow-complete-title = You’re ready to go!

onboarding-flow-button-next = Next
onboarding-flow-button-continue = Continue
onboarding-flow-button-back = Go back
onboarding-flow-button-complete = Start browsing

# Pinebuild private browsing coming soon dialog strings
private-window-coming-title = Private browsing
private-window-coming-title2 = coming soon
private-window-coming-soon-content = While we work to bring you this feature, <br>you can use private windows in { -brand-other-product-name }.
private-window-coming-button-label = Got it
private-window-coming-soon = Coming Soon: Private Browsing

# Pinebuild migration strings
pinebuild-import-from =
    { PLATFORM() ->
        [windows] Import Options, History, Passwords and other data from:
       *[other] Import Preferences, History, Passwords and other data from:
    }
