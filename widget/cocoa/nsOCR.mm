/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsOCR.h"

using namespace mozilla;
using namespace mozilla::widget;

NS_IMPL_ISUPPORTS(nsOCR, nsIOCR)

NS_IMETHODIMP
nsOCR::GetIsAvailable(bool* aIsAvailable) {
  *aIsAvailable = true;
  return NS_OK;
}
