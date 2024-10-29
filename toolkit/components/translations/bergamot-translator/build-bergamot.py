#!/usr/bin/env python3
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
Builds the Bergamot translations engine for integration with Firefox.

If you wish to test the Bergamot engine locally, then uncomment the .wasm line in
the toolkit/components/translations/jar.mn after building the file. Just make sure
not to check the code change in.
"""

import argparse
import os
import shutil
import subprocess
from collections import namedtuple
from typing import List

import yaml

DIR_PATH = os.path.realpath(os.path.dirname(__file__))
THIRD_PARTY_PATH = os.path.join(DIR_PATH, "thirdparty")
MOZ_YAML_PATH = os.path.join(DIR_PATH, "moz.yaml")
REPO_PATH = os.path.join(THIRD_PARTY_PATH, "firefox-translations-training")
INFERENCE_PATH = os.path.join(REPO_PATH, "inference")
BUILD_PATH = os.path.join(INFERENCE_PATH, "build-wasm")
WASM_PATH = os.path.join(BUILD_PATH, "bergamot-translator-worker.wasm")
JS_PATH = os.path.join(BUILD_PATH, "bergamot-translator-worker.js")
FINAL_JS_PATH = os.path.join(DIR_PATH, "bergamot-translator.js")
ROOT_PATH = os.path.join(DIR_PATH, "../../../..")

parser = argparse.ArgumentParser(
    description=__doc__,
    # Preserves whitespace in the help text.
    formatter_class=argparse.RawTextHelpFormatter,
)
parser.add_argument(
    "--clobber", action="store_true", help="Clobber the build artifacts"
)
parser.add_argument(
    "--debug",
    action="store_true",
    help="Build with debug symbols, useful for profiling",
)

ArgNamespace = namedtuple("ArgNamespace", ["clobber", "debug"])


def git_clone_update(name: str, repo_path: str, repo_url: str, revision: str):
    if not os.path.exists(repo_path):
        print(f"\n⬇️ Clone the {name} repo into {repo_path}\n")
        subprocess.check_call(
            ["git", "clone", repo_url],
            cwd=THIRD_PARTY_PATH,
        )

    def run(command):
        return subprocess.check_call(command, cwd=repo_path)

    local_head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_path,
        text=True,
    ).strip()

    if local_head != revision:
        print(f"The head ({local_head}) and revision ({revision}) don't match.")
        print(f"\n🔎 Fetching revision {revision} from {name}.\n")
        run(["git", "fetch", "--recurse-submodules", "origin", revision])

        print(f"🛒 Checking out the revision {revision}")
        run(["git", "checkout", revision])
        run(["git", "submodule", "update", "--init", "--recursive"])


def fetch_bergamot_source():
    with open(MOZ_YAML_PATH, "r", encoding="utf8") as file:
        text = file.read()

    moz_yaml = yaml.safe_load(text)

    git_clone_update(
        name="translations",
        repo_path=REPO_PATH,
        repo_url=moz_yaml["origin"]["url"],
        revision=moz_yaml["origin"]["revision"],
    )


def create_command(allow_run_on_host: bool, task_args: List[str]):
    if allow_run_on_host:
        # Attempt to build the WASM artifacts on the host computer.
        command = ["task", "inference-build-wasm"]
    else:
        # Attempt to build the WASM artifacts within a Docker container.
        command = [
            "task",
            "docker-run",
            "--",
            "task",
            "inference-build-wasm",
            "--volume",
            f"{REPO_PATH}/inference/build-wasm:/inference/build-wasm",
            "--",
            "-j",
            "1",
        ]

    # Append task arguments if they exist
    if task_args:
        command.append("--")
        command.extend(task_args)

    return command


def build_bergamot(args: ArgNamespace):
    """
    Builds the inference engine by calling the 'inference-build-wasm' task.

    If the ALLOW_RUN_ON_HOST environment variable is set to 1, then the build
    will attempt to run locally on the host system.

    Otherwise, by default, the WASM artifacts will be built with a Docker container
    using the Docker image specified by the repository.
    """

    allow_run_on_host = os.getenv("ALLOW_RUN_ON_HOST", "0") == "1"

    task_args = []
    if args.clobber:
        task_args.append("--clobber")
    if args.debug:
        task_args.append("--debug")

    command = create_command(
        allow_run_on_host,
        task_args,
    )

    print("\n🛠️  Building inference engine WASM...\n")
    return subprocess.run(command, cwd=REPO_PATH, shell=False, check=True)


def write_final_bergamot_js_file():
    """
    The generated JS file requires some light patching for integration.
    """

    source = "\n".join(
        [
            "/* This Source Code Form is subject to the terms of the Mozilla Public",
            " * License, v. 2.0. If a copy of the MPL was not distributed with this",
            " * file, You can obtain one at http://mozilla.org/MPL/2.0/. */",
            "",
            "function loadBergamot(Module) {",
            "",
        ]
    )

    with open(JS_PATH, "r", encoding="utf8") as file:
        for line in file.readlines():
            source += "  " + line

    source += "  return Module;\n}"

    # Use the Module's printing.
    source = source.replace("console.log(", "Module.print(")

    # Add some instrumentation to the module's memory size.
    source = source.replace(
        "function updateGlobalBufferAndViews(buf) {",
        """
        function updateGlobalBufferAndViews(buf) {
          const mb = (buf.byteLength / 1_000_000).toFixed();
          Module.print(
            `Growing wasm buffer to ${mb}MB (${buf.byteLength} bytes).`
          );
    """,
    )

    print("\n Formatting the final bergamot file")
    # Create the file outside of this directory so it's not ignored by eslint.
    temp_path = os.path.join(DIR_PATH, "../temp-bergamot.js")
    with open(temp_path, "w", encoding="utf8") as file:
        file.write(source)

    subprocess.run(
        f"./mach eslint --fix {temp_path} --rule 'curly:error'",
        cwd=ROOT_PATH,
        check=True,
        shell=True,
        capture_output=True,
    )

    print(f"\n Writing out final bergamot file: {FINAL_JS_PATH}")
    shutil.move(temp_path, FINAL_JS_PATH)


def main():
    args: ArgNamespace = parser.parse_args()

    if not os.path.exists(THIRD_PARTY_PATH):
        os.mkdir(THIRD_PARTY_PATH)

    fetch_bergamot_source()
    build_bergamot(args)
    write_final_bergamot_js_file()


if __name__ == "__main__":
    main()
