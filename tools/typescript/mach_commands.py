# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, # You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import os
import sys
import subprocess

from mach.decorators import (
    CommandArgument,
    CommandProvider,
    Command,
    SubCommand,
)

from mozbuild.base import MachCommandBase
from mozbuild.util import mkdir

@CommandProvider
class TypeScriptProvider(MachCommandBase):
    @Command('typescript', category='misc',
             description='Generate TypeScript definitions.')
    def typescript_default(self):
        self.typescript_xpcom()

    @SubCommand('typescript',
                'xpcom',
                description='Generate TypeScript definitions for XPCOM.')
    def typescript_xpcom(self):
        target = os.path.join(self.topsrcdir, '@types', 'xpcom')
        mkdir(target)

        python_path = list(sys.path)
        python_path.append(os.path.join(self.topsrcdir, 'xpcom', 'idl-parser'))
        python_path.append(os.path.join(self.topsrcdir, 'xpcom', 'idl-parser', 'xpidl'))
        append_env = {
            b'PYTHONDONTWRITEBYTECODE': str('1'),
            b'PYTHONPATH': os.pathsep.join(python_path)
        }

        script = os.path.join(self.topsrcdir, 'tools', 'typescript', 'build_xpcom_defs.py')
        bindings = os.path.join(self.topsrcdir, 'dom', 'bindings', 'Bindings.conf')

        process = subprocess.Popen([sys.executable, script, bindings, target],
                                   stdin=subprocess.PIPE, env=append_env)

        contracts = []
        reader = self.mozbuild_reader(config_mode='empty')
        for context in reader.read_topsrcdir():
            if 'XPIDL_SOURCES' in context:
                for source in context['XPIDL_SOURCES']:
                    process.stdin.write('%s\n' % source.full_path)

        process.stdin.close()
        process.wait()
