/* -*- Mode: C++; tab-width: 50; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=50 et cin tw=80 : */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_nsMemoryInfoDumper_h
#define mozilla_nsMemoryInfoDumper_h

#include "nsIMemoryInfoDumper.h"
#include "nsString.h"

/**
 * This class facilitates dumping information about our memory usage to disk.
 *
 * Its cpp file also has Linux-only code which watches various OS signals and
 * dumps memory info upon receiving a signal.  You can activate these listeners
 * by calling Initialize().
 */
class nsMemoryInfoDumper : public nsIMemoryInfoDumper
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMEMORYINFODUMPER

  nsMemoryInfoDumper();
  virtual ~nsMemoryInfoDumper();

public:
  static void Initialize();

  /**
   * This function creates a new unique file based on |aFilename| in a
   * world-readable temp directory. This is the system temp directory
   * or, in the case of Android, the downloads directory. If |aFile| is
   * non-null, it is assumed to point to a folder, and that folder is used
   * instead.
   */
  static nsresult OpenTempFile(const nsACString &aFilename, nsIFile* *aFile);

private:
  static nsresult
  DumpMemoryReportsToFileImpl(const nsAString& aIdentifier);
};

#define NS_MEMORY_INFO_DUMPER_CID \
{ 0x00bd71fb, 0x7f09, 0x4ec3, \
{ 0x96, 0xaf, 0xa0, 0xb5, 0x22, 0xb7, 0x79, 0x69 } }

#endif
