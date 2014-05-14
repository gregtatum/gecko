/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// vim:set ts=2 sts=2 sw=2 et cin:
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This namespace contains methods with Obj-C/Cocoa implementations. The header
// is C/C++ for inclusion in C/C++-only files.

#ifndef CocoaFileUtils_h_
#define CocoaFileUtils_h_

#include "nscore.h"
#include <CoreFoundation/CoreFoundation.h>

namespace CocoaFileUtils {

nsresult RevealFileInFinder(CFURLRef aUrl);
nsresult OpenURL(CFURLRef aUrl);
nsresult GetFileCreatorCode(CFURLRef aUrl, OSType* aCreatorCode);
nsresult SetFileCreatorCode(CFURLRef aUrl, OSType aCreatorCode);
nsresult GetFileTypeCode(CFURLRef aUrl, OSType* aTypeCode);
nsresult SetFileTypeCode(CFURLRef aUrl, OSType aTypeCode);

} // namespace CocoaFileUtils

#endif
