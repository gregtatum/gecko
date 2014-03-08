/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 sw=2 et tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_IMEContentObserver_h_
#define mozilla_IMEContentObserver_h_

#include "mozilla/Attributes.h"
#include "nsCOMPtr.h"
#include "nsIDocShell.h" // XXX Why does only this need to be included here?
#include "nsIReflowObserver.h"
#include "nsISelectionListener.h"
#include "nsIScrollObserver.h"
#include "nsIWidget.h" // for nsIMEUpdatePreference
#include "nsStubMutationObserver.h"
#include "nsWeakReference.h"

class nsIContent;
class nsINode;
class nsISelection;
class nsPresContext;

namespace mozilla {

// IMEContentObserver notifies widget of any text and selection changes
// in the currently focused editor
class IMEContentObserver MOZ_FINAL : public nsISelectionListener,
                                     public nsStubMutationObserver,
                                     public nsIReflowObserver,
                                     public nsIScrollObserver,
                                     public nsSupportsWeakReference
{
public:
  IMEContentObserver();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISELECTIONLISTENER
  NS_DECL_NSIMUTATIONOBSERVER_CHARACTERDATACHANGED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTAPPENDED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTINSERTED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTREMOVED
  NS_DECL_NSIMUTATIONOBSERVER_ATTRIBUTEWILLCHANGE
  NS_DECL_NSIMUTATIONOBSERVER_ATTRIBUTECHANGED
  NS_DECL_NSIREFLOWOBSERVER

  // nsIScrollObserver
  virtual void ScrollPositionChanged() MOZ_OVERRIDE;

  void     Init(nsIWidget* aWidget,
                nsPresContext* aPresContext,
                nsIContent* aContent);
  void     Destroy(void);
  bool     IsManaging(nsPresContext* aPresContext, nsIContent* aContent);
  bool     IsEditorHandlingEventForComposition() const;
  bool     KeepAliveDuringDeactive() const
  {
    return mUpdatePreference.WantDuringDeactive();
  }

  nsCOMPtr<nsIWidget>            mWidget;
  nsCOMPtr<nsISelection>         mSel;
  nsCOMPtr<nsIContent>           mRootContent;
  nsCOMPtr<nsINode>              mEditableNode;

private:
  void NotifyContentAdded(nsINode* aContainer, int32_t aStart, int32_t aEnd);
  void ObserveEditableNode();

  nsCOMPtr<nsIDocShell>          mDocShell;
  nsIMEUpdatePreference mUpdatePreference;
  uint32_t mPreAttrChangeLength;
};

} // namespace mozilla

#endif // mozilla_IMEContentObserver_h_