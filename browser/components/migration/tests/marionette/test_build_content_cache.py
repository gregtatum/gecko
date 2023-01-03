# -*- coding: utf-8 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import

import distutils.dir_util
import json
import os
import shutil
import subprocess
import tempfile
import textwrap
import time
import urllib
from urllib.parse import urlparse

from marionette_harness.marionette_test import MarionetteTestCase


class TestBuildContentCache(MarionetteTestCase):
    def setUp(self):
        super(TestBuildContentCache, self).setUp()

    @property
    def viewport_dimensions(self):
        return self.marionette.execute_script(
            "return [window.innerWidth, window.innerHeight];"
        )

    def save_text_contents(self, url, hash_number, overwrite=False):
        script = """
            return document.body.innerText
        """
        hash = hex(hash_number)[2:]
        screen_path = os.path.join(
            "/Users/greg/lem/sqlite-reader/data/screenshot",
            hash + "-" + urlparse(url).netloc + ".png",
        )
        content_path = os.path.join(
            "/Users/greg/lem/sqlite-reader/data/text",
            hash + "-" + urlparse(url).netloc + ".txt",
        )

        if not overwrite and os.path.exists(content_path):
            return

        self.marionette.navigate(url)

        time.sleep(1)
        with open(screen_path, "wb") as fh:
            self.marionette.save_screenshot(fh, full=False)

        content = self.marionette.execute_script(
            textwrap.dedent(script), sandbox="system"
        )

        with open(content_path, "w") as f:
            f.write(content)

    def test_collection(self):
        with open("/Users/greg/lem/sqlite-reader/data/list/arstechnica.com.json") as f:
            entries = json.load(f)
            f.close()

        for entry in entries:
            print("Loading", entry["url"])
            self.save_text_contents(entry["url"], entry["url_hash"])

        self.assertTrue(True)
