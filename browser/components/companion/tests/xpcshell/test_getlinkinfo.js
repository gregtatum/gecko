/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { getLinkInfo } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

const DESCRIPTION_TEST = [
  {
    description: `https://www.yahoo.com`,
    links: [{ url: "https://www.yahoo.com/" }],
  },
  {
    description: `<a href="/">https://example.com/path</a>`,
    links: [{ url: "https://example.com/path" }],
  },
  {
    description: `<a href="https://www.example.com">text</a>`,
    links: [{ url: "https://www.example.com/", text: "text" }],
  },
  {
    description: `https://aka.ms/JoinTeamsMeeting`,
    links: [],
  },
  {
    description: `
      <a href="http://example.com">An example</a>
      Some other text
      http://www.yahoo.com
      Strange markup<https://mysettings.lync.com/pstnconferencing>
    `,
    links: [
      { url: "http://example.com/", text: "An example" },
      { url: "http://www.yahoo.com/" },
      { url: "https://mysettings.lync.com/pstnconferencing" },
    ],
  },
  {
    description: `<div>
      <p>Should de-dupe links:</p>
      <br/>
      <a href="https://example.com">https://example.com</a>
      <a href="https://example.com">https://example.com</a>
      <p>Consectetur adipiscing elit:</p>
      <br/>
      <a href="https://example.com/different">Click here</a>
      <p>Fusce eget eleifend nunc:</p>
      <br/>
      <a href="https://www.something.ca">https://www.something.ca</a>
    </div>`,
    links: [
      { url: "https://example.com/", text: "https://example.com" },
      { url: "https://example.com/different", text: "Click here" },
      { url: "https://www.something.ca/", text: "https://www.something.ca" },
    ],
  },
  // tel: links should be ignored
  {
    description: `tel:123456789`,
    links: [],
  },
  // For Microsoft events, only HTML is parsed, not text.
  {
    body: {
      content: `<html><a href="https://example.org">Example</a>https://example.com</html>`,
    },
    links: [{ url: "https://example.org/", text: "Example" }],
  },
  // Strange Microsoft markup only shows proper HTML links.
  {
    body: {
      content: `
        <a href="http://example.com">An example</a>
        Some other text
        http://www.yahoo.com
        Strange markup<https://mysettings.lync.com/pstnconferencing>
      `,
    },
    links: [{ url: "http://example.com/", text: "An example" }],
  },
  // href value differs from the link text, but both can be parsed as valid URLs
  {
    description: `<a href="https://docs.google.com/key">https://docs.google.com/blah</a>`,
    links: [
      {
        url: "https://docs.google.com/key",
        text: "https://docs.google.com/blah",
      },
    ],
  },
];

add_task(async function test_getLinkInfo() {
  for (let test of DESCRIPTION_TEST) {
    let links = getLinkInfo(test);
    equal(test.links.length, links.length);
    for (let i = 0; i < links.length; i++) {
      let linkInfo = links[i];
      let expectedLinkInfo = test.links[i];
      equal(linkInfo.url, expectedLinkInfo.url);
      equal(linkInfo.text, expectedLinkInfo.text);
    }
  }
});
