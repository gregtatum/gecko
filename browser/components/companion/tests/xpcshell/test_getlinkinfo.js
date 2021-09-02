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
];

add_task(async function test_getLinkInfo() {
  for (let test of DESCRIPTION_TEST) {
    let links = getLinkInfo({ description: test.description });
    equal(test.links.length, links.length);
    for (let i = 0; i < links.length; i++) {
      equal(links[i].url, test.links[i].url);
      equal(links[i].text, test.links[i].text);
    }
  }
});
