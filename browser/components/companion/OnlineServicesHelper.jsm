/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = [
  "getLinkInfo",
  "getConferenceInfo",
  "parseGoogleCalendarResult",
  "parseMicrosoftCalendarResult",
  "sanitizeHTML",
  "convertHTMLToPlainText",
];

const parserUtils = Cc["@mozilla.org/parserutils;1"].getService(
  Ci.nsIParserUtils
);

const URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

// Some common links provide nothing useful in the companion,
// so we just ignore them.
let linksToIgnore = [
  // This link is in every Teams invite and just provides information
  // on how to join a Teams meeting.
  "https://aka.ms/JoinTeamsMeeting",
];

function processLink(url, text) {
  try {
    url = new URL(url);
  } catch (e) {
    // We might have URLS without protocols.
    // Just add https://
    try {
      url = new URL(`https://${url}`);
    } catch (e2) {
      // This link doesn't appear to be valid, could be totally wrong, or a just
      // a path (like "/foo") but we don't have a domain. Ignore it.
      return null;
    }
  }
  if (linksToIgnore.includes(url.href) || url.protocol === "tel:") {
    return null;
  }
  // Tag conferencing URLs in case we need them, but just return.
  if (conferencingInfo.find(info => url.host.endsWith(info.domain))) {
    return {
      url: url.href,
      type: "conferencing",
    };
  }
  let link = {};
  link.url = url.href;

  if (text && url.href != text) {
    link.text = text;
  }
  return link;
}

/**
 * Parse any links out of a service-specific calendar event.
 *
 * @param {Object} result
 *     This is the service-specific calendar event. Expected to come from the
 *     Microsoft or Google API directly and unmodified.
 * @returns {Array<Object>}
 *     Returns an array of links with keys `url`, `text` and `type`. Only `url`
 *     is required, `type` is undefined or "conferencing" for video call links.
 */
function getLinkInfo(result) {
  let doc;
  let links = new Map();
  let parser = new DOMParser();
  let description;
  if ("body" in result) {
    // This is Microsoft specific
    description = result.body.content;
  } else {
    description = result.description;
  }
  // Descriptions from both providers use HTML entities in some URLs.
  // The only ones that seem to affect us are &amp; and &nbsp;
  // We also remove wordbreak tags as Google inserts them in URLs.
  description = description
    ?.replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<wbr>/g, "");
  doc = parser.parseFromString(description, "text/html");
  let anchors = doc.getElementsByTagName("a");
  if (anchors.length) {
    for (let anchor of anchors) {
      // We explicitly ignore anchors with empty text content
      // as they wouldn't show up in the calendar UI anyway.
      if (!anchor.href || anchor.textContent === "") {
        continue;
      }
      let link = processLink(anchor.href, anchor.textContent);
      if (link && link.text !== "") {
        links.set(link.url, link);
      }
    }
  }
  // We only parse the description as text for Google events
  if ("description" in result) {
    let descriptionURLs = description?.match(URL_REGEX);
    if (descriptionURLs?.length) {
      for (let descriptionURL of descriptionURLs) {
        let descriptionLink = processLink(descriptionURL);
        if (
          !descriptionLink ||
          descriptionLink.text === "" ||
          links.get(descriptionLink.url)
        ) {
          continue;
        }
        links.set(descriptionLink.url, descriptionLink);
      }
    }
  }

  return [...links.values()];
}
const conferencingInfo = [
  {
    name: "Zoom",
    domain: "zoom.us",
    icon: "chrome://browser/content/companion/zoom.png",
  },
  {
    name: "Teams",
    domain: "teams.microsoft.com",
    icon: "chrome://browser/content/companion/teams.png",
  },
  {
    name: "Meet",
    domain: "meet.google.com",
    icon: "chrome://browser/content/companion/meet.png",
  },
  {
    name: "Jitsi",
    domain: "meet.jit.si",
    icon: "chrome://browser/content/companion/jitsi.png",
  },
  {
    name: "GoToMeeting",
    domain: ".gotomeeting.com",
    icon: "chrome://browser/content/companion/gotomeeting.png",
  },
  {
    name: "WebEx",
    domain: ".webex.com",
    icon: "chrome://browser/content/companion/webex.png",
  },
];

function getConferencingDetails(url) {
  try {
    url = new URL(url);
  } catch (e) {
    url = new URL(`https://${url}`);
  }

  let domainInfo = conferencingInfo.find(info =>
    url.host.endsWith(info.domain)
  );
  if (domainInfo) {
    return {
      icon: domainInfo.icon,
      name: domainInfo.name,
      url,
    };
  }
  return null;
}

/**
 * Parses a providers calendar event to get conferencing information.
 * Currently works with Google and Microsoft.
 * Only looks at conferencing data and location.
 * @param result Object Service specific response from server
 * @param links Array Links parsed out of the description
 * @returns { icon, name, url }
 */
function getConferenceInfo(result, links) {
  // conferenceData is a Google specific field
  if (result.conferenceData?.conferenceSolution) {
    let locationURL;

    for (let entry of result.conferenceData.entryPoints) {
      if (entry.uri.startsWith("https:")) {
        locationURL = new URL(entry.uri);
        break;
      }
    }

    let conferencingDetails = getConferencingDetails(locationURL);
    return (
      conferencingDetails || {
        icon: result.conferenceData.conferenceSolution.iconUri,
        name: result.conferenceData.conferenceSolution.name,
        url: locationURL,
      }
    );
  }
  // onlineMeeting is a Microsoft specific field
  if (result.onlineMeeting) {
    let locationURL = new URL(result.onlineMeeting.joinUrl);
    return getConferencingDetails(locationURL);
  }
  // Check to see if location contains a conferencing URL
  if (result.location) {
    try {
      let locationURL;
      if (result.location.displayName) {
        // Microsoft
        locationURL = new URL(result.location.displayName);
      } else {
        // Google
        locationURL = new URL(result.location);
      }
      return getConferencingDetails(locationURL);
    } catch (e) {
      // Location didn't contain a URL
    }
  }
  // If we didn't get any conferencing data in server response, see if there
  // is a link in the document that has conferencing. We grab the first one.
  let conferenceLink = links.find(link => link.type == "conferencing");
  if (conferenceLink) {
    return getConferencingDetails(conferenceLink.url);
  }
  return null;
}

function parseGoogleCalendarResult(result, primaryEmail) {
  let event = {};
  event.summary = result.summary;
  event.start = new Date(result.start?.dateTime);
  event.end = new Date(result.end?.dateTime);
  let links = getLinkInfo(result);
  event.conference = getConferenceInfo(result, links);
  event.links = links.filter(link => link.type != "conferencing");
  event.attendees =
    result.attendees?.filter(a => !a.self && a.responseStatus !== "declined") ||
    [];
  event.organizer = result.organizer;
  event.creator = result.creator;
  // Secondary calendars don't use the same email as
  // the primary, so we manually mark the "self" entries
  if (event.organizer?.email == primaryEmail) {
    event.organizer.self = true;
  }
  if (event.creator?.email == primaryEmail) {
    event.creator.self = true;
  }
  event.url = result.htmlLink;
  return event;
}

function parseMicrosoftCalendarResult(result) {
  function _normalizeUser(user, { self } = {}) {
    return {
      email: user.emailAddress.address,
      name: user.emailAddress.name,
      self: !!self,
    };
  }

  let event = {};
  event.summary = result.subject;
  event.start = new Date(result.start?.dateTime + "Z");
  event.end = new Date(result.end?.dateTime + "Z");
  let links = getLinkInfo(result);
  event.conference = getConferenceInfo(result, links);
  event.links = links.filter(link => link.type != "conferencing");
  event.url = result.webLink;
  event.creator = null; // No creator seems to be available.
  event.organizer = _normalizeUser(result.organizer, {
    self: result.isOrganizer,
  });
  event.attendees = result.attendees
    .filter(a => a.status.response != "declined")
    .map(a => _normalizeUser(a));
  return event;
}

const SanitizerFlags =
  parserUtils.SanitizerDropForms |
  parserUtils.SanitizerDropMedia |
  parserUtils.SanitizerDropNonCSSPresentation;

function sanitizeHTML(str) {
  return parserUtils.sanitize(str, SanitizerFlags);
}

function convertHTMLToPlainText(str, wrapCol = 0) {
  return parserUtils.convertToPlainText(str, SanitizerFlags, wrapCol);
}
