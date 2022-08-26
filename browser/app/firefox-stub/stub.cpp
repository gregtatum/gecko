/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <unistd.h>
#include <string>
#include "BinaryPath.h"

using namespace mozilla;

#define PATHSEP '/'

int main(int argc, char* argv[], char* envp[]) {
  UniqueFreePtr<char> exePath = BinaryPath::Get();
  if (!exePath.get()) {
    return 1;
  }

  // Find the last path separator.
  char* pathSepPos = strrchr(exePath.get(), PATHSEP);

  // Create our target path beginning with everything from our path up to and including the last
  // path separator.
  std::string targetBinary(exePath.get(), pathSepPos - exePath.get() + 1);
  targetBinary += TARGET_BINARY;

  argv[0] = const_cast<char*>(targetBinary.c_str());
  execve(targetBinary.c_str(), argv, envp);

  // execve does not return on success.
  return 1;
}
