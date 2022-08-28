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

const RE_DOMAIN = /@(.+)$/;

/**
 * Extract the author's email domain, favoring their reply-to domain over their
 * actual sending domain.  That choice is currently arbitrary.
 */
export default function AuthorDomain(/* params, args */) {}
AuthorDomain.prototype = {
  gather(gathered) {
    const { message } = gathered;

    const address = message.replyTo
      ? message.replyTo[0].address
      : message.author.address;
    const match = RE_DOMAIN.exec(address);

    return Promise.resolve(match && match[1].toLowerCase());
  },
};
