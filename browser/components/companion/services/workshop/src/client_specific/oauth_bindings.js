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

const OauthBindings = {
  // Google for "mozilla.com" domain email addresses
  google: {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "290111995646-hrdpn27kp4jl0r6gej8540cg3cc4i0g6.apps.googleusercontent.com",
    clientSecret: "mjlcpD5iiSNABCq_3PRtUglS",
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
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  },
  microsoft: {
    endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: "2d165c7b-a525-45c6-b4dc-3039db1e7f85",
    scopes: [
      // This is required or we don't get a refreshToken
      "offline_access",
      "https://graph.microsoft.com/Calendars.Read",
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Files.Read.All",
    ],
  },
};

export { OauthBindings };
