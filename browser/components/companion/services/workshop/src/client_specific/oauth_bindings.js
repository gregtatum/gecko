/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains Application / Client specific OAuth identifiers.
 *
 * This is information that's necessary for the front-end to have available
 * prior to creating any accounts in order to begin creating accounts.  The
 * format is driven by what was already in use by `OnlineServices.jsm`.
 */

export default {
  // Google for "mozilla.com" domain email addresses
  google: {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "913967847322-m8ij544g2i23pssvchhru1hceg08irud.apps.googleusercontent.com",
    clientSecret: "G7bg5a1bahnVWxd6GKQcO4Ro",
    // Pedantically, the scopes should probably live closer to the account
    // definition, but engine_glue isn't the right place for this info right
    // now because we need the information before we talk to the backend about
    // creating the account currently.
    //
    // But this is an okay place for this information for now.
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
    ],
  },
};
