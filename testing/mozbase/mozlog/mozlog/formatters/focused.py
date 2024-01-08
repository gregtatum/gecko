#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


from mozlog.formatters import base
from mozterm import Terminal



class NoColors(object):
    def __init__(self):
        # Any colors used in the terminal should be added here.
        colors = [
            "cyan_reverse_bold",
            "green_bold",
            "green_reverse_bold",
            "gray",
            "gray_underline",
            "yellow_bold",
            "yellow_reverse_bold",
            "white_reverse_bold",
            "white_bold",
            "red_reverse_bold",
            "red_bold",
            "yellow_bold",
            "white_bold",
            "white_bold_underline",
        ]
        for color in colors:
            setattr(self, color, lambda x: x)

class FocusedFormatter(base.BaseFormatter):
    """A formatter for a focused local environment for writing and running tests."""

    def __init__(
        self,
        disable_colors=False,
        **kwargs
    ):
        self.term = Terminal(disable_styling=disable_colors)
        self.is_test = False
        self.is_parallel_suite = False


    def suite_start(self, data):
        if "xpcshell" in data['name']:
            self.is_parallel_suite = True
            self.is_test = True

        return f"\n{self.term.yellow_reverse_bold('    SUITE: ')} {self.term.yellow_bold(data['name'])}\n"

    def group_start(self, data):
        return f"{self.term.yellow_reverse_bold(' MANIFEST: ')} {self.term.gray_underline(data['name'])}\n"

    def group_end(self, data):
        return ""

    def test_start(self, data):
        self.is_test = True

        # Don't prepend a newline on parallel suites, as the order of tests doesn't matter.
        prepend = "" if self.is_parallel_suite else "\n"

        return f"{prepend}{self.term.cyan_reverse_bold('     TEST: ')} {self.term.white_bold_underline(data['test'])}\n"

    def test_end(self, data):
        if not self.is_parallel_suite:
            # Don't hide output between tests if this test suite is parallelized like
            # xpcshell tests.
            self.is_test = False

        status = data['status']
        key = self.term.gray_reverse_bold
        text = self.term.gray_bold

        if status == "OK" or status == "PASS":
            key = self.term.green_reverse_bold
            text = self.term.green_bold
        elif status == "FAIL" or status == "ERROR" or status == "CRASH" or status == "FAIL":
            key = self.term.red_reverse_bold
            text = self.term.red_bold

        if self.is_parallel_suite:
            # Include the test name if the suite is parallelized.
            return f"{key('   RESULT: ')} {text(status)} {data['test']}\n"

        return f"{key('   RESULT: ')} {text(status)}\n"

    def test_status(self, data):
        status = data["status"]
        message = getattr(data, 'message', '')

        if (
            status == "PASS" or
            status == "OK"
        ):
            icon = "✓"
            icon_color = self.term.green_bold
        elif (
            status == "FAIL" or
            status == "TIMEOUT" or
            status == "CRASH" or
            status == "PRECONDITION_FAILED" or
            status == "ERROR"
        ):
            icon = "✕"
            icon_color = self.term.red_bold
        else: # status == "SKIP"
            icon = "○"
            icon_color = self.term.yellow_bold

        return f"  {icon_color(icon)} {data['subtest']} {message}\n"

    def process_output(self, data):
        if not self.is_test:
            return ""

        line = data['data']

        # Ignore logspam:
        if line.startswith("MEMORY STAT"):
            return ""

        return f"    {self.term.gray(line)}\n"


    def log(self, data):
        if not self.is_test:
            return ""

        message = data['message']
        if message.startswith("Entering test bound"):
            message = message.replace("Entering test bound ", "")
            return f"\n  {self.term.yellow_bold(message)}\n"

        if message.startswith("Leaving test bound"):
            return ""


        level = data["level"]
        icon = "·"
        if level == "INFO":
            icon = self.term.white_bold("i")

        lines = message.split("\n")
        output = lines[0]
        for line in lines[1:]:
            output = output + "\n    " + line

        return f"  {icon} {output}\n"
