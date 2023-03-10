# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The following feature name must be treated as a brand.
#
# They cannot be:
# - Transliterated.
# - Translated.
#
# Declension should be avoided where possible, leaving the original
# brand unaltered in prominent UI positions.
#
# For further details, consult:
# https://mozilla-l10n.github.io/styleguides/mozilla_general/#brands-copyright-and-trademark
-translations-brand-name = Firefox Translations

# The title of the about:translations page, referencing the translations feature.
about-translations-title = Translations
about-translations-header = { -translations-brand-name }
about-translations-results-placeholder = Translation
# Text displayed on from-language dropdown when no language is selected
about-translations-detect = Detect language
# Text displayed on from-language dropdown when a language is detected
# Variables:
#   $language (string) - The localized display name of the detected language
about-translations-detect-lang = Detect language ({ $language })
# Text displayed on to-language dropdown when no language is selected
about-translations-select = Select language
about-translations-textarea =
  .placeholder = Add text to translate
