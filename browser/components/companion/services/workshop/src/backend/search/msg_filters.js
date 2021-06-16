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

import { DEFAULT_SEARCH_EXCERPT_SETTINGS } from '../syncbase';

import AuthorFilter from './filters/message/author_filter';
import AuthorAddressFilter from './filters/message/author_address_filter';
import RecipientsFilter from './filters/message/recipients_filter';
import SubjectFilter from './filters/message/subject_filter';
import BodyFilter from './filters/message/body_filter';

/**
 * Filters that operate on messages directly.  These also get wrapped by the
 * MessageSpreadFilter for use by the conversation filters.
 **/

export default {
  author: {
    constructor: AuthorFilter,
    params: null
  },
  authorAddress: {
    constructor: AuthorAddressFilter,
    params: null
  },
  recipients: {
    constructor: RecipientsFilter,
    params: null
  },
  subject: {
    constructor: SubjectFilter,
    params: {
      excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS
    }
  },
  body: {
    constructor: BodyFilter,
    params: {
      excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS,
      includeQuotes: false
    }
  },
  bodyAndQuotes: {
    constructor: BodyFilter,
    params: {
      excerptSettings: DEFAULT_SEARCH_EXCERPT_SETTINGS,
      includeQuotes: true
    }
  }
};
