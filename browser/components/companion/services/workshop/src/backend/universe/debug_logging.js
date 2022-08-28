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
 * Configures the "logic" logging subsystem to conform to current user and/or
 * test settings for the back-end.  The front-end "clientapi" has its own
 * equivalent "client_debug_logging.js".
 *
 * At startup the MailUniverse tells us the config directly.  The MailUniverse
 * also binds us to "config" updates from the MailDB.
 */
export default function DebugLogging() {}
DebugLogging.prototype = {};
