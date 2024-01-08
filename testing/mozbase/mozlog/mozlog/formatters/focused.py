#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


from mozterm import Terminal

from mozlog.formatters import base


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

    def __init__(self, disable_colors=False, **kwargs):
        self.term = Terminal(disable_styling=disable_colors)
        self.suppress_output = True
        self.is_parallel_suite = False
        self.test_bound_failed = False
        self.test_bound = ""
        self.test_failed = False

    def suite_start(self, data):
        if "xpcshell" in data["name"]:
            self.is_parallel_suite = True
            self.suppress_output = False

        return f"\n{self.term.yellow_reverse_bold('    SUITE: ')} {self.term.yellow_bold(data['name'])}\n"

    def group_start(self, data):
        return f"{self.term.yellow_reverse_bold(' MANIFEST: ')} {self.term.gray_underline(data['name'])}\n"

    def group_end(self, data):
        return ""

    def test_start(self, data):
        self.suppress_output = False
        self.test_failed = False

        # Don't prepend a newline on parallel suites, as the order of tests doesn't matter.
        prepend = "" if self.is_parallel_suite else "\n"

        return f"{prepend}{self.term.cyan_reverse_bold('     TEST: ')} {self.term.white_bold_underline(data['test'])}\n"

    def test_end(self, data):
        if not self.is_parallel_suite:
            # Show the output between tests if this test suite is parallelized like
            # xpcshell tests.
            self.suppress_output = True

        status = "FAIL" if self.test_failed else data["status"]
        key = self.term.gray_reverse_bold
        text = self.term.gray_bold

        if (
            self.test_failed
            or status == "FAIL"
            or status == "ERROR"
            or status == "CRASH"
            or status == "FAIL"
        ):
            key = self.term.red_reverse_bold
            text = self.term.red_bold
        elif status == "OK" or status == "PASS":
            key = self.term.green_reverse_bold
            text = self.term.green_bold

        if self.is_parallel_suite:
            # Include the test name if the suite is parallelized.
            return f"{key('   RESULT: ')} {text(status)} {data['test']}\n"

        return f"{key('   RESULT: ')} {text(status)}\n"

    def test_status(self, data):
        status = data["status"]
        message = dict.get(data, "message", "")

        if status == "PASS" or status == "OK":
            icon = "✓"
            icon_color = self.term.green_bold
        elif (
            status == "FAIL"
            or status == "TIMEOUT"
            or status == "CRASH"
            or status == "PRECONDITION_FAILED"
            or status == "ERROR"
        ):
            self.test_bound_failed = True
            self.test_failed = True

            icon = "✕"
            icon_color = self.term.red_bold
        else:  # status == "SKIP"
            icon = "○"
            icon_color = self.term.yellow_bold

        return f"  {icon_color(icon)} {data['subtest']} {message}\n"

    def process_output(self, data):
        if self.suppress_output:
            return ""

        line = data["data"]

        # Ignore logspam:
        if line.startswith("MEMORY STAT"):
            return ""

        if (
            line.startswith("console.error") or line.startswith("JavaScript error:")
        ) and (
            # Ignore errors with the word "intentionally".
            "Intentionally" not in line
            and "intentionally" not in line
        ):
            return f"    {self.term.red(line)}\n"

        return f"    {self.term.gray(line)}\n"

    def log(self, data):
        if self.suppress_output:
            return ""

        message = data["message"]
        if message.startswith("Entering test bound"):
            self.test_bound = message.replace("Entering test bound ", "")
            return f"\n  {self.term.yellow_bold(self.test_bound)}\n"

        if message.startswith("Leaving test bound"):
            if self.test_bound_failed:
                self.test_bound_failed = False
                return f"{self.term.red_reverse_bold('   FAILED: ')} {self.term.red_bold(self.test_bound)}\n"

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

    def crash(self, data):
        if (
            "Missing chrome or resource URLs" in data["reason"]
            or "Attempting to connect to non-local address!" in data["reason"]
        ):
            # These crashes are from loading invalid URLs. Simplify the output by
            # not including any crash stacks.
            return self.term.red_bold(f"  ✕ {data['reason']}\n")

        test = data.get("test", "unknown")

        if data.get("stackwalk_returncode", 0) != 0 and not data.get(
            "stackwalk_stderr"
        ):
            success = True
        else:
            success = False

        rv = [
            "pid:%s. Process type: %s. Test:%s. Minidump analysed:%s. Signature:[%s]"
            % (
                data.get("pid", "unknown"),
                data.get("process_type", None),
                test,
                success,
                data["signature"],
            )
        ]

        if data.get("java_stack"):
            rv.append("Java exception: %s" % data["java_stack"])
        else:
            if data.get("reason"):
                rv.append("Mozilla crash reason: %s" % data["reason"])

            if data.get("minidump_path"):
                rv.append("Crash dump filename: %s" % data["minidump_path"])

            if data.get("stackwalk_returncode", 0) != 0:
                rv.append(
                    "minidump-stackwalk exited with return code %d"
                    % data["stackwalk_returncode"]
                )

            if data.get("stackwalk_stderr"):
                rv.append("stderr from minidump-stackwalk:")
                rv.append(data["stackwalk_stderr"])
            elif data.get("stackwalk_stdout"):
                rv.append(data["stackwalk_stdout"])

            if data.get("stackwalk_errors"):
                rv.extend(data.get("stackwalk_errors"))

        return "\n".join(rv)
