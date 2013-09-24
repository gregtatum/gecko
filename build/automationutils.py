#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import with_statement
import glob, logging, os, platform, shutil, subprocess, sys, tempfile, urllib2, zipfile
import re
from urlparse import urlparse

try:
  import mozinfo
except ImportError:
  # Stub out fake mozinfo since this is not importable on Android 4.0 Opt.
  # This should be fixed; see
  # https://bugzilla.mozilla.org/show_bug.cgi?id=650881
  mozinfo = type('mozinfo', (), dict(info={}))()
  mozinfo.isWin = mozinfo.isLinux = mozinfo.isUnix = mozinfo.isMac = False

  # TODO! FILE: localautomation :/
  # mapping from would-be mozinfo attr <-> sys.platform
  mapping = {'isMac': ['mac', 'darwin'],
             'isLinux': ['linux', 'linux2'],
             'isWin': ['win32', 'win64'],
             }
  mapping = dict(sum([[(value, key) for value in values] for key, values in mapping.items()], []))
  attr = mapping.get(sys.platform)
  if attr:
    setattr(mozinfo, attr, True)
  if mozinfo.isLinux:
    mozinfo.isUnix = True

__all__ = [
  "ZipFileReader",
  "addCommonOptions",
  "dumpLeakLog",
  "isURL",
  "processLeakLog",
  "getDebuggerInfo",
  "DEBUGGER_INFO",
  "replaceBackSlashes",
  "wrapCommand",
  'KeyValueParseError',
  'parseKeyValue',
  'systemMemory',
  'environment'
  ]

# Map of debugging programs to information about them, like default arguments
# and whether or not they are interactive.
DEBUGGER_INFO = {
  # gdb requires that you supply the '--args' flag in order to pass arguments
  # after the executable name to the executable.
  "gdb": {
    "interactive": True,
    "args": "-q --args"
  },

  "cgdb": {
    "interactive": True,
    "args": "-q --args"
  },
  "cgdb": {
    "interactive": True,
    "args": "-q --args"
  },

  "lldb": {
    "interactive": True,
    "args": "--"
  },

  # valgrind doesn't explain much about leaks unless you set the
  # '--leak-check=full' flag.
  "valgrind": {
    "interactive": False,
    "args": "--leak-check=full"
  }
}

class ZipFileReader(object):
  """
  Class to read zip files in Python 2.5 and later. Limited to only what we
  actually use.
  """

  def __init__(self, filename):
    self._zipfile = zipfile.ZipFile(filename, "r")

  def __del__(self):
    self._zipfile.close()

  def _getnormalizedpath(self, path):
    """
    Gets a normalized path from 'path' (or the current working directory if
    'path' is None). Also asserts that the path exists.
    """
    if path is None:
      path = os.curdir
    path = os.path.normpath(os.path.expanduser(path))
    assert os.path.isdir(path)
    return path

  def _extractname(self, name, path):
    """
    Extracts a file with the given name from the zip file to the given path.
    Also creates any directories needed along the way.
    """
    filename = os.path.normpath(os.path.join(path, name))
    if name.endswith("/"):
      os.makedirs(filename)
    else:
      path = os.path.split(filename)[0]
      if not os.path.isdir(path):
        os.makedirs(path)
      with open(filename, "wb") as dest:
        dest.write(self._zipfile.read(name))

  def namelist(self):
    return self._zipfile.namelist()

  def read(self, name):
    return self._zipfile.read(name)

  def extract(self, name, path = None):
    if hasattr(self._zipfile, "extract"):
      return self._zipfile.extract(name, path)

    # This will throw if name is not part of the zip file.
    self._zipfile.getinfo(name)

    self._extractname(name, self._getnormalizedpath(path))

  def extractall(self, path = None):
    if hasattr(self._zipfile, "extractall"):
      return self._zipfile.extractall(path)

    path = self._getnormalizedpath(path)

    for name in self._zipfile.namelist():
      self._extractname(name, path)

log = logging.getLogger()

def isURL(thing):
  """Return True if |thing| looks like a URL."""
  # We want to download URLs like http://... but not Windows paths like c:\...
  return len(urlparse(thing).scheme) >= 2

def addCommonOptions(parser, defaults={}):
  parser.add_option("--xre-path",
                    action = "store", type = "string", dest = "xrePath",
                    # individual scripts will set a sane default
                    default = None,
                    help = "absolute path to directory containing XRE (probably xulrunner)")
  if 'SYMBOLS_PATH' not in defaults:
    defaults['SYMBOLS_PATH'] = None
  parser.add_option("--symbols-path",
                    action = "store", type = "string", dest = "symbolsPath",
                    default = defaults['SYMBOLS_PATH'],
                    help = "absolute path to directory containing breakpad symbols, or the URL of a zip file containing symbols")
  parser.add_option("--debugger",
                    action = "store", dest = "debugger",
                    help = "use the given debugger to launch the application")
  parser.add_option("--debugger-args",
                    action = "store", dest = "debuggerArgs",
                    help = "pass the given args to the debugger _before_ "
                           "the application on the command line")
  parser.add_option("--debugger-interactive",
                    action = "store_true", dest = "debuggerInteractive",
                    help = "prevents the test harness from redirecting "
                        "stdout and stderr for interactive debuggers")

def getFullPath(directory, path):
  "Get an absolute path relative to 'directory'."
  return os.path.normpath(os.path.join(directory, os.path.expanduser(path)))

def searchPath(directory, path):
  "Go one step beyond getFullPath and try the various folders in PATH"
  # Try looking in the current working directory first.
  newpath = getFullPath(directory, path)
  if os.path.isfile(newpath):
    return newpath

  # At this point we have to fail if a directory was given (to prevent cases
  # like './gdb' from matching '/usr/bin/./gdb').
  if not os.path.dirname(path):
    for dir in os.environ['PATH'].split(os.pathsep):
      newpath = os.path.join(dir, path)
      if os.path.isfile(newpath):
        return newpath
  return None

def getDebuggerInfo(directory, debugger, debuggerArgs, debuggerInteractive = False):

  debuggerInfo = None

  if debugger:
    debuggerPath = searchPath(directory, debugger)
    if not debuggerPath:
      print "Error: Path %s doesn't exist." % debugger
      sys.exit(1)

    debuggerName = os.path.basename(debuggerPath).lower()

    def getDebuggerInfo(type, default):
      if debuggerName in DEBUGGER_INFO and type in DEBUGGER_INFO[debuggerName]:
        return DEBUGGER_INFO[debuggerName][type]
      return default

    debuggerInfo = {
      "path": debuggerPath,
      "interactive" : getDebuggerInfo("interactive", False),
      "args": getDebuggerInfo("args", "").split()
    }

    if debuggerArgs:
      debuggerInfo["args"] = debuggerArgs.split()
    if debuggerInteractive:
      debuggerInfo["interactive"] = debuggerInteractive

  return debuggerInfo


def dumpLeakLog(leakLogFile, filter = False):
  """Process the leak log, without parsing it.

  Use this function if you want the raw log only.
  Use it preferably with the |XPCOM_MEM_LEAK_LOG| environment variable.
  """

  # Don't warn (nor "info") if the log file is not there.
  if not os.path.exists(leakLogFile):
    return

  with open(leakLogFile, "r") as leaks:
    leakReport = leaks.read()

  # Only |XPCOM_MEM_LEAK_LOG| reports can be actually filtered out.
  # Only check whether an actual leak was reported.
  if filter and not "0 TOTAL " in leakReport:
    return

  # Simply copy the log.
  log.info(leakReport.rstrip("\n"))

def processSingleLeakFile(leakLogFileName, processType, leakThreshold):
  """Process a single leak log.
  """

  #                  Per-Inst  Leaked      Total  Rem ...
  #   0 TOTAL              17     192  419115886    2 ...
  # 833 nsTimerImpl        60     120      24726    2 ...
  lineRe = re.compile(r"^\s*\d+\s+(?P<name>\S+)\s+"
                      r"(?P<size>-?\d+)\s+(?P<bytesLeaked>-?\d+)\s+"
                      r"-?\d+\s+(?P<numLeaked>-?\d+)")

  processString = ""
  if processType:
    # eg 'plugin'
    processString = " %s process:" % processType

  crashedOnPurpose = False
  totalBytesLeaked = None
  leakAnalysis = []
  leakedObjectNames = []
  with open(leakLogFileName, "r") as leaks:
    for line in leaks:
      if line.find("purposefully crash") > -1:
        crashedOnPurpose = True
      matches = lineRe.match(line)
      if not matches:
        # eg: the leak table header row
        log.info(line.rstrip())
        continue
      name = matches.group("name")
      size = int(matches.group("size"))
      bytesLeaked = int(matches.group("bytesLeaked"))
      numLeaked = int(matches.group("numLeaked"))
      # Output the raw line from the leak log table if it is the TOTAL row,
      # or is for an object row that has been leaked.
      if numLeaked != 0 or name == "TOTAL":
        log.info(line.rstrip())
      # Analyse the leak log, but output later or it will interrupt the leak table
      if name == "TOTAL":
        totalBytesLeaked = bytesLeaked
      if size < 0 or bytesLeaked < 0 or numLeaked < 0:
        leakAnalysis.append("TEST-UNEXPECTED-FAIL | leakcheck |%s negative leaks caught!"
                            % processString)
        continue
      if name != "TOTAL" and numLeaked != 0:
        leakedObjectNames.append(name)
        leakAnalysis.append("TEST-INFO | leakcheck |%s leaked %d %s (%s bytes)"
                            % (processString, numLeaked, name, bytesLeaked))
  log.info('\n'.join(leakAnalysis))

  if totalBytesLeaked is None:
    # We didn't see a line with name 'TOTAL'
    if crashedOnPurpose:
      log.info("TEST-INFO | leakcheck |%s deliberate crash and thus no leak log"
               % processString)
    else:
      # TODO: This should be a TEST-UNEXPECTED-FAIL, but was changed to a warning
      # due to too many intermittent failures (see bug 831223).
      log.info("WARNING | leakcheck |%s missing output line for total leaks!"
               % processString)
    return

  if totalBytesLeaked == 0:
    log.info("TEST-PASS | leakcheck |%s no leaks detected!" % processString)
    return

  # totalBytesLeaked was seen and is non-zero.
  if totalBytesLeaked > leakThreshold:
    # Fail the run if we're over the threshold (which defaults to 0)
    prefix = "TEST-UNEXPECTED-FAIL"
  else:
    prefix = "WARNING"
  # Create a comma delimited string of the first N leaked objects found,
  # to aid with bug summary matching in TBPL. Note: The order of the objects
  # had no significance (they're sorted alphabetically).
  maxSummaryObjects = 5
  leakedObjectSummary = ', '.join(leakedObjectNames[:maxSummaryObjects])
  if len(leakedObjectNames) > maxSummaryObjects:
    leakedObjectSummary += ', ...'
  log.info("%s | leakcheck |%s %d bytes leaked (%s)"
           % (prefix, processString, totalBytesLeaked, leakedObjectSummary))

def processLeakLog(leakLogFile, leakThreshold = 0):
  """Process the leak log, including separate leak logs created
  by child processes.

  Use this function if you want an additional PASS/FAIL summary.
  It must be used with the |XPCOM_MEM_BLOAT_LOG| environment variable.
  """

  if not os.path.exists(leakLogFile):
    log.info("WARNING | leakcheck | refcount logging is off, so leaks can't be detected!")
    return

  if leakThreshold != 0:
    log.info("TEST-INFO | leakcheck | threshold set at %d bytes" % leakThreshold)

  (leakLogFileDir, leakFileBase) = os.path.split(leakLogFile)
  fileNameRegExp = re.compile(r".*?_([a-z]*)_pid\d*$")
  if leakFileBase[-4:] == ".log":
    leakFileBase = leakFileBase[:-4]
    fileNameRegExp = re.compile(r".*?_([a-z]*)_pid\d*.log$")

  for fileName in os.listdir(leakLogFileDir):
    if fileName.find(leakFileBase) != -1:
      thisFile = os.path.join(leakLogFileDir, fileName)
      processType = None
      m = fileNameRegExp.search(fileName)
      if m:
        processType = m.group(1)
      processSingleLeakFile(thisFile, processType, leakThreshold)

def replaceBackSlashes(input):
  return input.replace('\\', '/')

def wrapCommand(cmd):
  """
  If running on OS X 10.5 or older, wrap |cmd| so that it will
  be executed as an i386 binary, in case it's a 32-bit/64-bit universal
  binary.
  """
  if platform.system() == "Darwin" and \
     hasattr(platform, 'mac_ver') and \
     platform.mac_ver()[0][:4] < '10.6':
    return ["arch", "-arch", "i386"] + cmd
  # otherwise just execute the command normally
  return cmd

class KeyValueParseError(Exception):
  """error when parsing strings of serialized key-values"""
  def __init__(self, msg, errors=()):
    self.errors = errors
    Exception.__init__(self, msg)

def parseKeyValue(strings, separator='=', context='key, value: '):
  """
  parse string-serialized key-value pairs in the form of
  `key = value`. Returns a list of 2-tuples.
  Note that whitespace is not stripped.
  """

  # syntax check
  missing = [string for string in strings if separator not in string]
  if missing:
    raise KeyValueParseError("Error: syntax error in %s" % (context,
                                                            ','.join(missing)),
                                                            errors=missing)
  return [string.split(separator, 1) for string in strings]

def systemMemory():
  """
  Returns total system memory in kilobytes.
  Works only on unix-like platforms where `free` is in the path.
  """
  return int(os.popen("free").readlines()[1].split()[1])

def environment(xrePath, env=None, crashreporter=True):
  """populate OS environment variables for mochitest"""

  env = os.environ.copy() if env is None else env

  assert os.path.isabs(xrePath)

  ldLibraryPath = xrePath

  envVar = None
  if mozinfo.isUnix:
    envVar = "LD_LIBRARY_PATH"
    env['MOZILLA_FIVE_HOME'] = xrePath
  elif mozinfo.isMac:
    envVar = "DYLD_LIBRARY_PATH"
  elif mozinfo.isWin:
    envVar = "PATH"
  if envVar:
    envValue = ((env.get(envVar), str(ldLibraryPath))
                if mozinfo.isWin
                else (ldLibraryPath, env.get(envVar)))
    env[envVar] = os.path.pathsep.join([path for path in envValue if path])

  # crashreporter
  env['GNOME_DISABLE_CRASH_DIALOG'] = '1'
  env['XRE_NO_WINDOWS_CRASH_DIALOG'] = '1'
  env['NS_TRACE_MALLOC_DISABLE_STACKS'] = '1'

  if crashreporter:
    env['MOZ_CRASHREPORTER_NO_REPORT'] = '1'
    env['MOZ_CRASHREPORTER'] = '1'
  else:
    env['MOZ_CRASHREPORTER_DISABLE'] = '1'

  # Additional temporary logging while we try to debug some intermittent
  # WebRTC conditions. This is necessary to troubleshoot bugs 841496,
  # 841150, and 839677 (at least)
  # Also (temporary) bug 870002 (mediastreamgraph)
  env.setdefault('NSPR_LOG_MODULES', 'signaling:5,mtransport:3')
  env['R_LOG_LEVEL'] = '5'
  env['R_LOG_DESTINATION'] = 'stderr'
  env['R_LOG_VERBOSE'] = '1'

  # ASan specific environment stuff
  asan = bool(mozinfo.info.get("asan"))
  if asan and (mozinfo.isLinux or mozinfo.isMac):
    try:
      totalMemory = systemMemory()

      # Only 2 GB RAM or less available? Use custom ASan options to reduce
      # the amount of resources required to do the tests. Standard options
      # will otherwise lead to OOM conditions on the current test slaves.
      #
      # If we have more than 2 GB or RAM but still less than 4 GB, we need
      # another set of options to prevent OOM in some memory-intensive
      # tests.
      message = "INFO | runtests.py | ASan running in %s configuration"
      if totalMemory <= 1024 * 1024 * 2:
        message = message % 'low-memory'
        env["ASAN_OPTIONS"] = "quarantine_size=50331648:redzone=64"
      elif totalMemory <= 1024 * 1024 * 4:
        message = message % 'mid-memory'
        env["ASAN_OPTIONS"] = "quarantine_size=100663296:redzone=64"
      else:
        message = message % 'default memory'
    except OSError,err:
      log.info("Failed determine available memory, disabling ASan low-memory configuration: %s", err.strerror)
    except:
      log.info("Failed determine available memory, disabling ASan low-memory configuration")
    else:
      log.info(message)

  return env
