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

const URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

// Some common links provide nothing useful in the companion,
// so we just ignore them.
const linksToIgnore = [
  // This link is in every Teams invite and just provides information
  // on how to join a Teams meeting.
  "https://aka.ms/JoinTeamsMeeting",
];

const conferencingInfo = [
  {
    name: "Zoom",
    domain: "zoom.us",
    icon: "chrome://browser/content/companion/zoom.svg",
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

function processLink(url, text) {
  try {
    url = new URL(url);
  } catch {
    // We might have URLS without protocols.
    // Just add https://
    try {
      url = new URL(`https://${url}`);
    } catch {
      // This link doesn't appear to be valid, could be totally wrong, or a just
      // a path (like "/foo") but we don't have a domain. Ignore it.
      return null;
    }
  }
  if (linksToIgnore.includes(url.href) || url.protocol === "tel:") {
    return null;
  }

  const link = {
    url: url.href,
  };

  // Tag conferencing URLs in case we need them, but just return.
  if (conferencingInfo.find(info => url.host.endsWith(info.domain))) {
    link.type = "conferencing";
    return link;
  }

  if (text && url.href !== text) {
    link.text = text;
  }
  return link;
}

export function processLinks(links, descriptions) {
  const map = new Map();
  const anchorText = new Set();
  for (const [href, content] of Object.entries(links)) {
    const link = processLink(href, content);
    if (link && link.text !== "") {
      map.set(link.url, link);
      anchorText.add(link.text);
    }
  }

  for (const description of descriptions) {
    if (description) {
      _processLinks(description, map, anchorText);
    }
  }

  return Array.from(map.values());
}

function _processLinks(description, map, anchorText) {
  const descriptionURLs = description.match(URL_REGEX);
  if (descriptionURLs?.length) {
    for (const descriptionURL of descriptionURLs) {
      // skip processing if URL is the textContent of an anchor element
      if (anchorText.has(descriptionURL)) {
        continue;
      }
      const descriptionLink = processLink(descriptionURL);
      if (
        descriptionLink &&
        descriptionLink.text !== "" &&
        !map.has(descriptionLink.url)
      ) {
        map.set(descriptionLink.url, descriptionLink);
      }
    }
  }
}

function getConferencingDetails(url) {
  if (!url) {
    return null;
  }

  try {
    url = new URL(url);
  } catch {
    try {
      url = new URL(`https://${url}`);
    } catch {
      return null;
    }
  }

  const domainInfo = conferencingInfo.find(info =>
    url.host.endsWith(info.domain)
  );
  if (!domainInfo) {
    return null;
  }

  return {
    icon: domainInfo.icon,
    name: domainInfo.name,
    url: url.toString(),
  };
}

/**
 * Parses a providers calendar event to get conferencing information.
 * Currently works with Google and Microsoft.
 * Only looks at conferencing data and location.
 * @param data Object Service specific response from server
 * @param links Array Links parsed out of the description
 * @returns { icon, name, url }
 */
export function getConferenceInfo(data, links) {
  // conferenceData is a Google specific field
  if (data.conferenceData?.conferenceSolution) {
    let locationURL;

    for (const entry of data.conferenceData.entryPoints) {
      if (entry.uri.startsWith("https:")) {
        locationURL = new URL(entry.uri);
        break;
      }
    }

    const conferencingDetails = getConferencingDetails(locationURL);
    return (
      conferencingDetails || {
        icon: data.conferenceData.conferenceSolution.iconUri,
        name: data.conferenceData.conferenceSolution.name,
        url: locationURL.toString(),
      }
    );
  }
  // onlineMeeting is a Microsoft specific field
  if (data.onlineMeeting) {
    const locationURL = new URL(data.onlineMeeting.joinUrl);
    return getConferencingDetails(locationURL);
  }
  // Check to see if location contains a conferencing URL
  if (data.location) {
    try {
      let locationURL;
      if (data.location.displayName) {
        // Microsoft
        locationURL = new URL(data.location.displayName);
      } else {
        // Google
        locationURL = new URL(data.location);
      }
      return getConferencingDetails(locationURL);
    } catch {
      // Location didn't contain a URL
    }
  }
  // If we didn't get any conferencing data in server response, see if there
  // is a link in the document that has conferencing. We grab the first one.
  const conferenceLink = links.find(link => link.type == "conferencing");
  if (conferenceLink) {
    return getConferencingDetails(conferenceLink.url);
  }
  return null;
}

// Must catch type and id for:
//  - /document/u/0/d/Whatever_ID/edit
//  - /spreadcheets/d/Whatever_ID/edit
const DOCS_PAT = new RegExp("/([^/]+)/(?:u/[^/]+/)?d/([^/]+)");

/**
 * Get document title for a given url.
 * @param {URL} url - the url to parse to guess a title.
 * @param {Object} gapiClient - the google api stuff with a client and a backoff.
 * @param {Map<string, Promise>} docTitleCache - a cache to use which maps
 * apiTarget and the fetch Promise.
 * @returns {Promise<Object|null>} containing the type of the document and its title
 * if any.
 */
async function getDocumentTitleFromGoogle(url, gapiClient, docTitleCache) {
  let type, id;

  if (url.hostname === "drive.google.com") {
    type = "drive";
    id = url.searchParams.get("id");
  } else {
    const match = url.pathname.match(DOCS_PAT);
    if (!match) {
      return null;
    }

    [, type, id] = match;
  }

  if (!id || !type) {
    return null;
  }

  let apiTarget;
  switch (type) {
    case "document":
      apiTarget = `https://docs.googleapis.com/v1/documents/${id}?fields=title`;
      break;
    case "spreadsheets":
      apiTarget = `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`;
      break;
    case "presentation":
      apiTarget = `https://slides.googleapis.com/v1/presentations/${id}?fields=title`;
      break;
    case "drive":
    case "file":
      apiTarget = `https://www.googleapis.com/drive/v3/files/${id}?fields=name`;
      break;
    default:
      return null;
  }

  if (!gapiClient) {
    return { type, title: null };
  }

  const cached = docTitleCache.get(apiTarget);
  if (cached) {
    return cached;
  }

  const resultPromise = gapiClient
    .apiGetCall(apiTarget, /* params */ {}, "document-title")
    .then(results => {
      if (!results || results.error) {
        return { type, title: null };
      }

      let title;
      switch (type) {
        case "spreadsheets":
          title = results.properties.title;
          break;
        case "file":
        case "drive":
          title = results.name;
          break;
        default:
          title = results.title;
      }

      return { type, title: title || null };
    });
  docTitleCache.set(apiTarget, resultPromise);
  return resultPromise;
}

/**
 * Encode an url to be used as an id to get file info in using graph api.
 * See https://docs.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0&tabs=http#encoding-sharing-urls.
 * @param {string} url
 * @returns {string} the encoded url.
 */
function encodeURLForGraph(url) {
  const base64Url = globalThis.btoa(encodeURI(url));
  const encodedUrl = base64Url.replace(
    /(\/)|(\+)|(=+$)/g,
    (_, p1, p2) => (p1 && "_") || (p2 && "-") || ""
  );

  return `u!${encodedUrl}`;
}

/**
 * Get document title for a given url.
 * @param {URL} url - the url to parse to guess a title.
 * @param {Object} mapiClient - the ms api stuff with a client and a backoff.
 * @param {Map<string, Promise>} docTitleCache - a cache to use which maps
 * apiTarget and the fetch Promise.
 * @returns {Promise<Object|null>} containing the type of the document and its title
 * if any.
 */
async function getDocumentTitleFromMicrosoft(url, mapiClient, docTitleCache) {
  if (!mapiClient) {
    return null;
  }

  if (url.hostname === "onedrive.live.com") {
    // We could have an url to edit the file:
    // https://onedrive.live.com/edit?...
    // So just get resid and authkey parameters in order to build a "redir" url.
    const resid = url.searchParams.get("resid");
    const authkey = url.searchParams.get("authkey");
    if (!resid || !authkey) {
      return null;
    }
    url = `https://onedrive.live.com/redir?resid=${resid}&authkey=${authkey}`;
  } else {
    url = url.toString();
  }

  const encoded = encodeURLForGraph(url);
  const apiTarget = `https://graph.microsoft.com/v1.0/shares/${encoded}`;
  const cached = docTitleCache.get(apiTarget);
  if (cached) {
    return cached;
  }

  const resultPromise = mapiClient
    .apiGetCall(apiTarget, /* params */ {}, "document-title")
    .then(results => {
      let type = "ms-drive";
      if (!results || results.error || !results.name) {
        return { type, title: null };
      }

      const { name } = results;
      const fileParts = name.split(".");
      if (fileParts.length === 1) {
        return { type, title: name };
      }

      const extension = fileParts.at(-1);
      switch (extension) {
        case "docx":
          type = "ms-document";
          break;
        case "xlsx":
          type = "ms-spreadsheet";
          break;
        case "pptx":
          type = "ms-presentation";
          break;
      }

      return { type, title: name };
    });
  docTitleCache.set(apiTarget, resultPromise);
  return resultPromise;
}

/**
 * Get document title for a given url.
 * @param {string} url - the url to parse to guess a title.
 * @param {Array<Object>} clients - the clients to use.
 * @param {Map<string, Promise>} docTitleCache - a cache to use which maps
 * apiTarget and the fetch Promise.
 * @returns {Promise<Object|null>} containing the type of the document and its title
 * if any.
 */
export async function getDocumentTitle(url, clients, docTitleCache) {
  url = new URL(url);
  if (url.hostname.endsWith(".google.com")) {
    return getDocumentTitleFromGoogle(url, clients.get("gapi"), docTitleCache);
  }

  if (
    ["1drv.ms", "onedrive.live.com"].includes(url.hostname) ||
    url.hostname.endsWith(".sharepoint.com")
  ) {
    return getDocumentTitleFromMicrosoft(
      url,
      clients.get("mapi"),
      docTitleCache
    );
  }

  return null;
}
