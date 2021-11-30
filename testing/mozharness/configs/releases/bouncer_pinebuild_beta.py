# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# lint_ignore=E501
config = {
    "products": {
        # for installers, stubs, msi (ie not updates) ...
        # products containing "latest" are for www.mozilla.org via cron-bouncer-check
        # products using versions are for release automation via release-bouncer-check-firefox
        "installer": {
            "product-name": "Pinebuild-%(version)s",
            "check_uptake": True,
            "platforms": [
                "osx",
                "win64",
            ],
        },
        "installer-latest": {
            "product-name": "Firefox-pinebuild-latest",
            "check_uptake": False,
            "platforms": [
                "osx",
                "win64",
            ],
        },
        "installer-ssl": {
            "product-name": "Pinebuild-%(version)s-SSL",
            "check_uptake": True,
            "platforms": [
                "osx",
                "win64",
            ],
        },
        "installer-latest-ssl": {
            "product-name": "Firefox-pinebuild-latest-SSL",
            "check_uptake": False,
            "platforms": [
                "osx",
                "win64",
            ],
        },
        "msi": {
            "product-name": "Pinebuild-%(version)s-msi-SSL",
            "check_uptake": True,
            "platforms": [
                "win",
                "win64",
            ],
        },
        "msi-latest": {
            "product-name": "Firefox-pinebuild-msi-latest-SSL",
            "check_uptake": False,
            "platforms": [
                "win",
                "win64",
            ],
        },
        "complete-mar": {
            "product-name": "Pinebuild-%(version)s-Complete",
            "check_uptake": True,
            "platforms": [
                "osx",
                "win64",
            ],
        },
    },
    "partials": {
        "releases-dir": {
            "product-name": "Pinebuild-%(version)s-Partial-%(prev_version)s",
            "check_uptake": True,
            "platforms": [
                "osx",
                "win64",
            ],
        },
    },
}
