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

import { NOW } from "shared/date";

/**
 * Our tasks currently support relative priorities of -100k to +100k.
 */
const MAX_PRIORITY_BOOST = 99999;
const ONE_HOUR_IN_MSECS = 60 * 60 * 1000;

/**
 * Generate higher priorities for newer timestamps.
 *
 * We have the range (-100k, 100k) to play with, which is a lot of space.  For
 * now we just quantize things on an hour's granularity, giving us a range of
 * about 23 years.  Note that the current implementation depends on the
 * ever-changing NOW().  Because of this and the quantization, this is not
 * suitable for doing things like ensuring FIFO mail sending or the like.
 *
 * TODO: Consider enhancing things by quantizing to a date in the future that
 * only changes rarely.  (Although, when it does, it'll be a doozy!)
 * Additionally, using logarithmic or otherwise non-linear scaling can help us
 * save precision for newer stuff where quantization collisions are more
 * undesirable.
 */
export function prioritizeNewer(dateTS) {
  return Math.max(
    -MAX_PRIORITY_BOOST,
    MAX_PRIORITY_BOOST - (NOW() - dateTS) / ONE_HOUR_IN_MSECS
  );
}
