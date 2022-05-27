# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import unittest
import os
import sys
import subprocess
import tempfile
from mozunit import main, MockedOpen

def run_script(files):
    python_path = list(sys.path)
    python_path.append(os.path.join(__file__, '..', '..', '..', 'xpcom', 'idl-parser'))
    python_path.append(os.path.join(__file__, '..', '..', '..', 'xpcom', 'idl-parser', 'xpidl'))

    target = tempfile.mkdtemp()

    script = os.path.join(__file__, '..', 'build_xpcom_defs.py')
    bindings = os.path.join(__file__, 'ExampleBindings.conf')

    append_env = {
        b'PYTHONDONTWRITEBYTECODE': str('1'),
        b'PYTHONPATH': os.pathsep.join(python_path)
    }

    process = subprocess.Popen([sys.executable, script, bindings, target],
                                stdin=subprocess.PIPE, env=append_env)

    for file_name in files:
        process.stdin.write(('%s\n' % file_name).encode('utf-8'))

    process.stdin.close()
    process.wait()

    import glob
    return [f for f in glob.glob("%s*" % target)]



class TestTests(unittest.TestCase):

    def test_pass(self):
        assert True

    def test_parser(self):
        print("About to run")
        assert run_script(['nsIExample.idl']) == False



if __name__ == '__main__':
    main()
