/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * @typedef {import("resource://gre/modules/PlacesUtils.jsm")["PlacesUtils"]} PlacesUtils
 */

/**
 * @typedef {Awaited<
 *  ReturnType<(PlacesUtils)["promiseDBConnection"]>
 * >} Database
 */

/**
 * @template T
 * @param {T | void | null} item
 * @param {string} [message]
 * @returns T
 */
export function ensureExists(item, message) {
  if (item === null) {
    throw new Error(message || "Expected an item to exist, and it was null.");
  }
  if (item === undefined) {
    throw new Error(
      message || "Expected an item to exist, and it was undefined."
    );
  }
  return item;
}

export class UnhandledCaseError extends Error {
  /**
   * @param {never} value - Check that
   * @param {string} typeName - A friendly type name.
   */
  constructor(value, typeName) {
    super(`There was an unhandled case for "${typeName}": ${value}`);
    this.name = "UnhandledCaseError";
  }
}

// The text is private to this module:
const sqlText = Symbol("sqlText");

class SqlState {
  /**
   * @param {string} text
   */
  constructor(text) {
    this[sqlText] = text;
  }

  /**
   * Run the query.
   * @param {Database} db
   * @param {Record<string, string>} [args]
   */
  run(db, args) {
    return db.execute(this[sqlText], args);
  }
}

/**
 * The sql template tag allows for concatenating string values for queries,
 * while guarding against SQL injections from concatenating unsafe values. The only
 * values allowed in the ${} injection points are the SqlState objects. These objects
 * are opaque wrappers over the raw text, which are never exposed to the consuming code.
 * This should eliminate the sql injection class of errors while still allowing for
 * dynamic query generation.
 *
 * See the docuentation of SqlState.prototype.run for more information on executing
 * the queries.
 *
 * For example:
 * ```js
 *   const standardLimit = sql`limit $limit`;
 *   const query = sql`
 *     select * from users
 *     where user.id = $id
 *     ${standardLimit}
 *   `;
 *   query.run(client, query, { id: 10, limit: 20 });
 * ```
 *
 * The following will result in an error, as it's an SQL injection:
 *
 * ```js
 *   const limit = 10;
 *   const query = sql`
 *     select * from users
 *     where user.id = $id
 *     limit ${limit}
 *   `;
 * ```
 * @param {TemplateStringsArray} strings
 * @param {Array<SqlState | undefined | null>} sqlStates
 * @returns {SqlState}
 */
export function sql(strings, ...sqlStates) {
  let text = "";

  // Combine the strings and args
  for (let i = 0; i < strings.length; i++) {
    const string = strings[i];
    text += string;

    const sqlState = sqlStates[i];
    if (sqlState) {
      text += sqlState[sqlText];
    }
  }

  return new SqlState(text);
}
