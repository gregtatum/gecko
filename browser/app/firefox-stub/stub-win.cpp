/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <windows.h>
#include <processthreadsapi.h>
#include <winbase.h>
#include <shlwapi.h>
#include <string>

// Max command line length, per CreateProcessW docs
#define MAX_CMD_LENGTH 32767

int WINAPI wWinMain(HINSTANCE, HINSTANCE, LPWSTR aCmdLine, int) {
  wchar_t app[MAX_PATH];
  DWORD ret = GetModuleFileNameW(nullptr, app, MAX_PATH);
  if (!ret ||
      (ret == MAX_PATH && ::GetLastError() == ERROR_INSUFFICIENT_BUFFER)) {
    return ::GetLastError();
  }
  if (!PathRemoveFileSpecW(app)) {
    return 1;
  }
  if (!PathAppendW(app, TARGET_BINARY)) {
    return 1;
  }

  std::wstring cmdLine(L"\"");
  cmdLine += app;
  cmdLine += L"\"";
  if (wcslen(aCmdLine) > 0) {
    cmdLine += L" ";
    cmdLine += aCmdLine;
  }

  DWORD creationFlags = CREATE_UNICODE_ENVIRONMENT;
  // Mainly used to pass along shortcut information to ensure
  // launch_method Telemetry will be accurate.
  STARTUPINFOW startupInfo = {0};
  startupInfo.cb = sizeof(STARTUPINFOW);
  GetStartupInfoW(&startupInfo);
  PROCESS_INFORMATION pi;

  bool rv =
      ::CreateProcessW(app, cmdLine.data(), nullptr, nullptr, FALSE,
                       creationFlags, nullptr, nullptr, &startupInfo, &pi);

  if (!rv) {
    return ::GetLastError();
  }

  ::CloseHandle(pi.hProcess);
  ::CloseHandle(pi.hThread);

  return 0;
}
