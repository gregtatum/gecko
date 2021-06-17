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
 * Tracks and represents the continuous (sub)range of an ordering space that is
 * currently "live" from the query's perspective.  That is, this is the range
 * that we have already issued reads for from the database.  We care about
 * changes in this range and do not care about changes outside this range.
 * This also then allows us TODO: COMPLETE THIS COMMENT.
 */
export default function QueryRange() {}
QueryRange.prototype = {};
