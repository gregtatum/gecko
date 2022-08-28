/* Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The specification of JSON feed format can be found here:
 *   https://www.jsonfeed.org/version/1.1
 *
 * The code here helps to sanitize and validate the JSON we
 * get over the network.
 */

// Check from headers if the content type corresponds to a json feed.
export function isJsonFeed(headers) {
  return (headers.get("content-type") || "")
    .toLowerCase()
    .split(";")
    .map(e => e.trim())
    .some(e => ["application/json", "application/feed+json"].includes(e));
}

class MissingRequiredError extends Error {
  constructor(name) {
    super(`"${name}" is a required property`);
    this.name = "JSONFeedMissingRequired";
  }
}

class InvalidValueError extends Error {
  constructor(name) {
    super(`Invalid value for ${name} property`);
    this.name = "JSONFeedInvalidValue";
  }
}

// Validate that obj has a correct format as defined
// in the validator.
// The validator must contain a property "properties" which
// is an object containing legal field names and their validator.
// For example, if foo is a required String and bar an optional integer,
// validator will have the form:
// { properties: { foo: { ..., optional: false }, bar: { ..., optional: true}}}.
// The objects associated with foo and bar must have a function validate
// used to validate and transform the entry or null if something is wrong.
// Sometimes, the resulting object must be post-processed in order to check
// that it's globally correct (e.g. two fields haven't conflicting values),
// so in order to achieve that optional function finalCheck in the validator
// is called.
function validate(obj, validator) {
  const newObj = Object.create(null);

  for (const [name, valueValidator] of Object.entries(validator.properties)) {
    if (!obj.hasOwnProperty(name)) {
      if (!valueValidator.optional) {
        throw new MissingRequiredError(name);
      }
      continue;
    }
    const value = obj[name];
    const result = valueValidator.validate(value, name);
    if (result !== null) {
      newObj[name] = result;
    }
  }

  if (validator.finalCheck && !validator.finalCheck(newObj)) {
    return null;
  }

  return Object.getOwnPropertyNames(newObj).length !== 0 ? newObj : null;
}

// A required value is required and we can potentially rely on it
// so if something is wrong with a required value we throw.
// At the opposite, an optional value can be missing and consequently
// we won't rely on it, so if something is wrong we just skip it
// (in returning null) because it very likely doesn't matter.
function makeOptionalOrRequired(validator, optional) {
  return {
    validate: (data, name) => {
      if (optional) {
        try {
          return validator.validate(data);
        } catch {
          return null;
        }
      }
      const result = validator.validate(data);
      if (result !== null) {
        return result;
      }
      throw new InvalidValueError(name);
    },
    optional,
  };
}

const StringValidator = {
  validate: x => (typeof x === "string" ? x : null),
};
const OptionalString = makeOptionalOrRequired(StringValidator, true);
const RequiredString = makeOptionalOrRequired(StringValidator, false);

const OptionalInteger = makeOptionalOrRequired(
  {
    validate: x => (!isNaN(x) && x >= 0 ? parseInt(x) : null),
  },
  true
);

const OptionalBoolean = makeOptionalOrRequired(
  {
    validate: x => (x === !!x ? x : null),
  },
  true
);

const OptionalDate = makeOptionalOrRequired(
  {
    validate: x => {
      const date = new Date(x);
      return isNaN(date) ? null : date;
    },
  },
  true
);

function OptionalArray(validator) {
  return {
    validate: x => {
      if (!Array.isArray(x)) {
        return null;
      }
      const result = [];
      for (const el of x) {
        try {
          const r = validate(el, validator);
          if (r !== null) {
            result.push(r);
          }
        } catch {}
      }
      return result;
    },
    optional: true,
  };
}

function Optional(validator) {
  return {
    validate: x => {
      try {
        return validate(x, validator);
      } catch {
        return null;
      }
    },
    optional: true,
  };
}

const AuthorValidator = {
  properties: {
    name: OptionalString,
    url: OptionalString,
    avatar: OptionalString,
  },
};

const HubValidator = {
  properties: {
    type: RequiredString,
    url: RequiredString,
  },
};

// https://www.jsonfeed.org/version/1.1/#attachments-a-name-attachments-a
const AttachmentValidator = {
  properties: {
    url: RequiredString,
    mime_type: RequiredString,

    title: OptionalString,
    size_in_bytes: OptionalInteger,
    duration_in_seconds: OptionalInteger,
  },
};

// https://www.jsonfeed.org/version/1.1/#items-a-name-items-a
const ItemValidator = {
  properties: {
    id: RequiredString,

    url: OptionalString,
    external_url: OptionalString,
    title: OptionalString,
    content_html: OptionalString,
    content_text: OptionalString,
    summary: OptionalString,
    image: OptionalString,
    banner_image: OptionalString,
    date_published: OptionalDate,
    date_modified: OptionalDate,
    authors: OptionalArray(AuthorValidator),
    author: Optional(AuthorValidator),
    tags: OptionalArray(StringValidator),
    language: OptionalString,
    attachments: OptionalArray(AttachmentValidator),
  },
  finalCheck(obj) {
    // An item must have one of these values.
    if (!obj.content_html && !obj.content_text) {
      return false;
    }

    // Compatibility with version 1.0.
    if (obj.author) {
      if (!obj.authors) {
        obj.authors = [];
      }
      obj.authors.push(obj.author);
      delete obj.author;
    }
    return true;
  },
};

// https://www.jsonfeed.org/version/1.1/#top-level-a-name-top-level-a
const MainValidator = {
  properties: {
    version: RequiredString,
    title: RequiredString,

    home_page_url: OptionalString,
    feed_url: OptionalString,
    description: OptionalString,
    user_comment: OptionalString,
    next_url: OptionalString,
    icon: OptionalString,
    favicon: OptionalString,
    authors: OptionalArray(AuthorValidator),
    language: OptionalString,
    expired: OptionalBoolean,
    hubs: OptionalArray(HubValidator),
    items: OptionalArray(ItemValidator),
  },
  finalCheck(obj) {
    // Avoid to have an infinite loop.
    if (obj.feed_url && obj.next_url === obj.feed_url) {
      delete obj.next_url;
    }
    return true;
  },
};

export function parseJsonFeed(str) {
  const obj = JSON.parse(str);
  return validate(obj, MainValidator);
}
