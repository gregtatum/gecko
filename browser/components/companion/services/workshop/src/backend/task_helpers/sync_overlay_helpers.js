/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Common logic used by all sync_refresh/sync_grow overlays.  This has been
 * factored out because it's gotten sufficiently verbose and complex and likely
 * to change that the copy-and-paste no longer provides clarity but instead
 * would be a nighmare.
 */
export function syncNormalOverlay(id, marker, inProgress, blockedBy) {
  let status;
  if (inProgress) {
    status = "active";
  } else if (marker) {
    status = "pending";
  } else {
    return null;
  }

  let blocked = null;
  if (blockedBy) {
    // yuck
    switch (blockedBy[blockedBy.length - 1][0]) {
      case "o": // online
        blocked = "offline";
        break;
      case "c": // credentials!*
        blocked = "bad-auth";
        break;
      case "h": // happy!*
        blocked = "unknown";
        break;
      default:
        break;
    }
  }

  return { status, blocked };
}

/**
 * Like syncNormalOverlay but for prefix overlays.
 */
export function syncPrefixOverlay(
  fullId,
  binId,
  marker,
  inProgress,
  blockedBy
) {
  return syncNormalOverlay(binId, marker, inProgress, blockedBy);
}
