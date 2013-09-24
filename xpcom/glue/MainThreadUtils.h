/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MainThreadUtils_h_
#define MainThreadUtils_h_

#include "nscore.h"
#include "mozilla/threads/nsThreadIDs.h"

class nsIThread;

/**
 * Get a reference to the main thread.
 *
 * @param result
 *   The resulting nsIThread object.
 */
extern NS_COM_GLUE NS_METHOD
NS_GetMainThread(nsIThread **result);

#if defined(MOZILLA_INTERNAL_API) && defined(XP_WIN)
bool NS_IsMainThread();
#elif defined(MOZILLA_INTERNAL_API) && defined(NS_TLS)
// This is defined in nsThreadManager.cpp and initialized to `Main` for the
// main thread by nsThreadManager::Init.
extern NS_TLS mozilla::threads::ID gTLSThreadID;
#ifdef MOZ_ASAN
// Temporary workaround, see bug 895845
MOZ_ASAN_BLACKLIST static
#else
inline
#endif
bool NS_IsMainThread()
{
  return gTLSThreadID == mozilla::threads::Main;
}
#else
/**
 * Test to see if the current thread is the main thread.
 *
 * @returns true if the current thread is the main thread, and false
 * otherwise.
 */
extern NS_COM_GLUE bool NS_IsMainThread();
#endif

#endif // MainThreadUtils_h_
