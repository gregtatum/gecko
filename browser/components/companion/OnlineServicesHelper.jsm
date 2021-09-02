/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["getLinkInfo", "getConferenceInfo"];

const URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

let linksToIgnore = ["https://aka.ms/JoinTeamsMeeting"];

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
  if (linksToIgnore.includes(url.href)) {
    return null;
  }
  // Tag conferencing URLs in case we need them,but just return.
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

function getLinkInfo(result) {
  let doc;
  let links = [];
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
      if (link) {
        links.push(link);
      }
    }
  }
  let descriptionURLs = description?.match(URL_REGEX);
  if (descriptionURLs?.length) {
    for (let descriptionURL of descriptionURLs) {
      let descriptionLink = processLink(descriptionURL);
      if (
        links.some(
          link =>
            link.url == descriptionLink.url || link.text == descriptionLink
        )
      ) {
        continue;
      }
      links.push(descriptionLink);
    }
  }

  return [...new Map(links.map(item => [item.url, item])).values()].filter(
    link => link.text !== ""
  );
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
  // If we didn't get any conferencing data in servert response, see if there
  // is a link in the document that has conferencing. We grab the first one.
  let conferenceLink = links.find(link => link.type == "conferencing");
  if (conferenceLink) {
    return getConferencingDetails(conferenceLink.url);
  }
  return null;
}
