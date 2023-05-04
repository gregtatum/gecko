# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The button for "Firefox Translations" in the url bar.
urlbar-translations-button =
  .tooltiptext = Translate this page

translations-panel-settings-button =
  .aria-label = Manage translation settings

## Options in the Firefox Translations settings.

translations-panel-settings-manage-languages = Manage languages
translations-panel-settings-change-source-language = Change source language
# TODO(Bug 1831341): We still need the link for this menu item.
translations-panel-settings-about = About translations in Firefox

## The translation panel appears from the url bar, and this is the text that appears
## only on the first run of the panel.

translations-panel-intro-header = New ultra-private translations in { -brand-shorter-name }
translations-panel-intro-description =
  Our browser-based translation tool works offline without the cloud so your data stays private.
# TODO(Bug 1831341): We still need the link for this page.
translations-panel-intro-description-with-link =
  Our browser-based translation tool works offline without the cloud so your data stays private.
  <a data-l10n-name="learn-more-link">Learn more</a>
# This label is intentionally different than the default view as it mentions the "page",
# while the default view does not mention the "page".
translations-panel-intro-translate-to-label = Translate page to

## The translation panel appears from the url bar, and this view is the default
## translation view.

translations-panel-default-header = Translate this page?
translations-panel-default-description = Looks like this page is in { $pageLanguage }. Want to translate it?
translations-panel-default-translate-to-label = Translate to
translations-panel-default-translate-button = Translate
translations-panel-default-translate-cancel = Not now

translations-panel-error-translating = There was a problem translating. Please try again.
translations-panel-error-load-languages = Couldn’t load languages
translations-panel-error-load-languages-hint = Check your internet connection and try again.

## The translation panel appears from the url bar, and this view is the "dual" translate
## view that lets you choose a source language and target language for translation

translations-panel-dual-header =
  .title = Translate this page?
translations-panel-dual-from-label = Translate from
translations-panel-dual-to-label = Translate to
translations-panel-dual-cancel-button = Cancel

# Text displayed on a language dropdown when the language is in beta
# Variables:
#   $language (string) - The localized display name of the detected language
translations-panel-displayname-beta =
  .label = { $language } BETA

## The translation panel appears from the url bar, and this view is the "restore" view
## that lets a user restore a page to the original language, or translate into another
## language.

# $fromLanguage (string) - The original language of the document.
# $toLanguage (string) - The target language of the translation.
translations-panel-revisit-header = The page is translated from { $fromLanguage } to { $toLanguage }
translations-panel-revisit-label = Want to try another language?
translations-panel-revisit-select =
  .label = Choose a language
translations-panel-revisit-restore-button = Show original
translations-panel-revisit-translate-button = Translate

## Firefox Translations language management in about:preferences.

translations-manage-header = Translations
translations-manage-description = Download languages for offline translation.
translations-manage-all-language = All languages
translations-manage-download-button = Download
translations-manage-delete-button = Delete
translations-manage-error-download = There was a problem downloading the language files. Please try again.
translations-manage-error-delete = There was an error deleting the language files. Please try again.
translations-manage-error-list = Failed to get the list of available languages for translation. Refresh the page to try again.
