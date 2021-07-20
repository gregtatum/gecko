/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = [
  "UrlbarProviderQuickActionsFilter",
  "UrlbarProviderQuickActionsEmpty",
];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
  KeywordTree: "resource:///modules/UrlbarQuickSuggest.jsm",
});

// These prefs are relative to the `browser.urlbar` branch.
const ENABLED_PREF = "suggest.quickactions";
const DYNAMIC_TYPE_NAME = "quickActions";

const MAX_RESULTS = 5;

const COMMANDS = {
  createmeeting: {
    commands: ["create-meeting"],
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='186 38 76 76'%3E%3Cpath fill='%23fff' d='M244 56h-40v40h40V56z'/%3E%3Cpath fill='%23EA4335' d='M244 114l18-18h-18v18z'/%3E%3Cpath fill='%23FBBC04' d='M262 56h-18v40h18V56z'/%3E%3Cpath fill='%2334A853' d='M244 96h-40v18h40V96z'/%3E%3Cpath fill='%23188038' d='M186 96v12c0 3.315 2.685 6 6 6h12V96h-18z'/%3E%3Cpath fill='%231967D2' d='M262 56V44c0-3.315-2.685-6-6-6h-12v18h18z'/%3E%3Cpath fill='%234285F4' d='M244 38h-52c-3.315 0 -6 2.685-6 6v52h18V56h40V38z'/%3E%3Cpath fill='%234285F4' d='M212.205 87.03c-1.495-1.01-2.53-2.485-3.095-4.435l3.47-1.43c.315 1.2.865 2.13 1.65 2.79.78.66 1.73.985 2.84.985 1.135 0 2.11-.345 2.925-1.035s1.225-1.57 1.225-2.635c0-1.09-.43-1.98-1.29-2.67-.86-.69-1.94-1.035-3.23-1.035h-2.005V74.13h1.8c1.11 0 2.045-.3 2.805-.9.76-.6 1.14-1.42 1.14-2.465 0 -.93-.34-1.67-1.02-2.225-.68-.555-1.54-.835-2.585-.835-1.02 0 -1.83.27-2.43.815a4.784 4.784 0 0 0 -1.31 2.005l-3.435-1.43c.455-1.29 1.29-2.43 2.515-3.415 1.225-.985 2.79-1.48 4.69-1.48 1.405 0 2.67.27 3.79.815 1.12.545 2 1.3 2.635 2.26.635.965.95 2.045.95 3.245 0 1.225-.295 2.26-.885 3.11-.59.85-1.315 1.5-2.175 1.955v.205a6.605 6.605 0 0 1 2.79 2.175c.725.975 1.09 2.14 1.09 3.5 0 1.36-.345 2.575-1.035 3.64s-1.645 1.905-2.855 2.515c-1.215.61-2.58.92-4.095.92-1.755.005-3.375-.5-4.87-1.51zM233.52 69.81l-3.81 2.755-1.905-2.89 6.835-4.93h2.62V88h-3.74V69.81z'/%3E%3C/svg%3E",
    label: "Schedule a meeting",
    callback: openUrl("https://meeting.new"),
    title: "Google Calendar",
  },
  createslides: {
    commands: ["create-slides"],
    icon:
      "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='48px' height='66px' viewBox='0 0 48 66' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3C!-- Generator: Sketch 54.1 (76490) - https://sketchapp.com --%3E%3Ctitle%3ESlides-icon%3C/title%3E%3Cdesc%3ECreated with Sketch.%3C/desc%3E%3Cdefs%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-1'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-3'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-5'%3E%3C/path%3E%3ClinearGradient x1='50.0053945%25' y1='8.58610612%25' x2='50.0053945%25' y2='100.013939%25' id='linearGradient-7'%3E%3Cstop stop-color='%23BF360C' stop-opacity='0.2' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%23BF360C' stop-opacity='0.02' offset='100%25'%3E%3C/stop%3E%3C/linearGradient%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-8'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-10'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-12'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-14'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-16'%3E%3C/path%3E%3CradialGradient cx='3.16804688%25' cy='2.71744318%25' fx='3.16804688%25' fy='2.71744318%25' r='161.248516%25' gradientTransform='translate(0.031680,0.027174),scale(1.000000,0.727273),translate(-0.031680,-0.027174)' id='radialGradient-18'%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0.1' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0' offset='100%25'%3E%3C/stop%3E%3C/radialGradient%3E%3C/defs%3E%3Cg id='Page-1' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3E%3Cg id='Consumer-Apps-Slides-Large-VD-R8' transform='translate(-449.000000, -452.000000)'%3E%3Cg id='Hero' transform='translate(0.000000, 63.000000)'%3E%3Cg id='Personal' transform='translate(277.000000, 299.000000)'%3E%3Cg id='Slides-icon' transform='translate(172.000000, 90.000000)'%3E%3Cg id='Group'%3E%3Cg id='Clipped'%3E%3Cmask id='mask-2' fill='white'%3E%3Cuse xlink:href='%23path-1'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L36.9791667,10.3541667 L29.5833333,0 Z' id='Path' fill='%23F4B400' fill-rule='nonzero' mask='url(%23mask-2)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-4' fill='white'%3E%3Cuse xlink:href='%23path-3'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M33.28125,29.5833333 L14.0520833,29.5833333 C12.8317708,29.5833333 11.8333333,30.5817708 11.8333333,31.8020833 L11.8333333,51.03125 C11.8333333,52.2515625 12.8317708,53.25 14.0520833,53.25 L33.28125,53.25 C34.5015625,53.25 35.5,52.2515625 35.5,51.03125 L35.5,31.8020833 C35.5,30.5817708 34.5015625,29.5833333 33.28125,29.5833333 Z M32.5416667,46.59375 L14.7916667,46.59375 L14.7916667,36.2395833 L32.5416667,36.2395833 L32.5416667,46.59375 Z' id='Shape' fill='%23F1F1F1' fill-rule='nonzero' mask='url(%23mask-4)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-6' fill='white'%3E%3Cuse xlink:href='%23path-5'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpolygon id='Path' fill='url(%23linearGradient-7)' fill-rule='nonzero' mask='url(%23mask-6)' points='30.8813021 16.4520313 47.3333333 32.9003646 47.3333333 17.75'%3E%3C/polygon%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-9' fill='white'%3E%3Cuse xlink:href='%23path-8'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cg id='Group' mask='url(%23mask-9)'%3E%3Cg transform='translate(26.625000, -2.958333)'%3E%3Cpath d='M2.95833333,2.95833333 L2.95833333,16.2708333 C2.95833333,18.7225521 4.94411458,20.7083333 7.39583333,20.7083333 L20.7083333,20.7083333 L2.95833333,2.95833333 Z' id='Path' fill='%23FADA80' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-11' fill='white'%3E%3Cuse xlink:href='%23path-10'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpolygon id='Path' fill-opacity='0.1' fill='%23FFFFFF' fill-rule='nonzero' mask='url(%23mask-11)' points='29.5833333 0 29.5833333 0.369791667 46.9635417 17.75 47.3333333 17.75'%3E%3C/polygon%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-13' fill='white'%3E%3Cuse xlink:href='%23path-12'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,4.80729167 C0,2.36666667 1.996875,0.369791667 4.4375,0.369791667 L29.5833333,0.369791667 L29.5833333,0 L4.4375,0 Z' id='Path' fill-opacity='0.2' fill='%23FFFFFF' fill-rule='nonzero' mask='url(%23mask-13)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-15' fill='white'%3E%3Cuse xlink:href='%23path-14'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M42.8958333,64.7135417 L4.4375,64.7135417 C1.996875,64.7135417 0,62.7166667 0,60.2760417 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,60.2760417 C47.3333333,62.7166667 45.3364583,64.7135417 42.8958333,64.7135417 Z' id='Path' fill-opacity='0.2' fill='%23BF360C' fill-rule='nonzero' mask='url(%23mask-15)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-17' fill='white'%3E%3Cuse xlink:href='%23path-16'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M34.0208333,17.75 C31.5691146,17.75 29.5833333,15.7642188 29.5833333,13.3125 L29.5833333,13.6822917 C29.5833333,16.1340104 31.5691146,18.1197917 34.0208333,18.1197917 L47.3333333,18.1197917 L47.3333333,17.75 L34.0208333,17.75 Z' id='Path' fill-opacity='0.1' fill='%23BF360C' fill-rule='nonzero' mask='url(%23mask-17)'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='Path' fill='url(%23radialGradient-18)' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E",
    label: "Create Google slides",
    callback: openUrl("https://slides.new"),
    title: "Google Slides",
  },
  createsheet: {
    commands: ["create-sheet"],
    icon:
      "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='49px' height='67px' viewBox='0 0 49 67' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3C!-- Generator: Sketch 54.1 (76490) - https://sketchapp.com --%3E%3Ctitle%3ESheets-icon%3C/title%3E%3Cdesc%3ECreated with Sketch.%3C/desc%3E%3Cdefs%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-1'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-3'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-5'%3E%3C/path%3E%3ClinearGradient x1='50.0053945%25' y1='8.58610612%25' x2='50.0053945%25' y2='100.013939%25' id='linearGradient-7'%3E%3Cstop stop-color='%23263238' stop-opacity='0.2' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%23263238' stop-opacity='0.02' offset='100%25'%3E%3C/stop%3E%3C/linearGradient%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-8'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-10'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-12'%3E%3C/path%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='path-14'%3E%3C/path%3E%3CradialGradient cx='3.16804688%25' cy='2.71744318%25' fx='3.16804688%25' fy='2.71744318%25' r='161.248516%25' gradientTransform='translate(0.031680,0.027174),scale(1.000000,0.727273),translate(-0.031680,-0.027174)' id='radialGradient-16'%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0.1' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0' offset='100%25'%3E%3C/stop%3E%3C/radialGradient%3E%3C/defs%3E%3Cg id='Page-1' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3E%3Cg id='Consumer-Apps-Sheets-Large-VD-R8-' transform='translate(-451.000000, -451.000000)'%3E%3Cg id='Hero' transform='translate(0.000000, 63.000000)'%3E%3Cg id='Personal' transform='translate(277.000000, 299.000000)'%3E%3Cg id='Sheets-icon' transform='translate(174.833333, 89.958333)'%3E%3Cg id='Group'%3E%3Cg id='Clipped'%3E%3Cmask id='mask-2' fill='white'%3E%3Cuse xlink:href='%23path-1'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L36.9791667,10.3541667 L29.5833333,0 Z' id='Path' fill='%230F9D58' fill-rule='nonzero' mask='url(%23mask-2)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-4' fill='white'%3E%3Cuse xlink:href='%23path-3'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M11.8333333,31.8020833 L11.8333333,53.25 L35.5,53.25 L35.5,31.8020833 L11.8333333,31.8020833 Z M22.1875,50.2916667 L14.7916667,50.2916667 L14.7916667,46.59375 L22.1875,46.59375 L22.1875,50.2916667 Z M22.1875,44.375 L14.7916667,44.375 L14.7916667,40.6770833 L22.1875,40.6770833 L22.1875,44.375 Z M22.1875,38.4583333 L14.7916667,38.4583333 L14.7916667,34.7604167 L22.1875,34.7604167 L22.1875,38.4583333 Z M32.5416667,50.2916667 L25.1458333,50.2916667 L25.1458333,46.59375 L32.5416667,46.59375 L32.5416667,50.2916667 Z M32.5416667,44.375 L25.1458333,44.375 L25.1458333,40.6770833 L32.5416667,40.6770833 L32.5416667,44.375 Z M32.5416667,38.4583333 L25.1458333,38.4583333 L25.1458333,34.7604167 L32.5416667,34.7604167 L32.5416667,38.4583333 Z' id='Shape' fill='%23F1F1F1' fill-rule='nonzero' mask='url(%23mask-4)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-6' fill='white'%3E%3Cuse xlink:href='%23path-5'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpolygon id='Path' fill='url(%23linearGradient-7)' fill-rule='nonzero' mask='url(%23mask-6)' points='30.8813021 16.4520313 47.3333333 32.9003646 47.3333333 17.75'%3E%3C/polygon%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-9' fill='white'%3E%3Cuse xlink:href='%23path-8'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cg id='Group' mask='url(%23mask-9)'%3E%3Cg transform='translate(26.625000, -2.958333)'%3E%3Cpath d='M2.95833333,2.95833333 L2.95833333,16.2708333 C2.95833333,18.7225521 4.94411458,20.7083333 7.39583333,20.7083333 L20.7083333,20.7083333 L2.95833333,2.95833333 Z' id='Path' fill='%2387CEAC' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-11' fill='white'%3E%3Cuse xlink:href='%23path-10'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,4.80729167 C0,2.36666667 1.996875,0.369791667 4.4375,0.369791667 L29.5833333,0.369791667 L29.5833333,0 L4.4375,0 Z' id='Path' fill-opacity='0.2' fill='%23FFFFFF' fill-rule='nonzero' mask='url(%23mask-11)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-13' fill='white'%3E%3Cuse xlink:href='%23path-12'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M42.8958333,64.7135417 L4.4375,64.7135417 C1.996875,64.7135417 0,62.7166667 0,60.2760417 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,60.2760417 C47.3333333,62.7166667 45.3364583,64.7135417 42.8958333,64.7135417 Z' id='Path' fill-opacity='0.2' fill='%23263238' fill-rule='nonzero' mask='url(%23mask-13)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-15' fill='white'%3E%3Cuse xlink:href='%23path-14'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M34.0208333,17.75 C31.5691146,17.75 29.5833333,15.7642188 29.5833333,13.3125 L29.5833333,13.6822917 C29.5833333,16.1340104 31.5691146,18.1197917 34.0208333,18.1197917 L47.3333333,18.1197917 L47.3333333,17.75 L34.0208333,17.75 Z' id='Path' fill-opacity='0.1' fill='%23263238' fill-rule='nonzero' mask='url(%23mask-15)'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3Cpath d='M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L29.5833333,0 Z' id='Path' fill='url(%23radialGradient-16)' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E",
    label: "Create a Google Sheet",
    callback: openUrl("https://sheets.new"),
    title: "Google Sheets",
  },
  createdoc: {
    commands: ["create-doc"],
    icon:
      "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='47px' height='65px' viewBox='0 0 47 65' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3C!-- Generator: Sketch 54.1 (76490) - https://sketchapp.com --%3E%3Ctitle%3EDocs-icon%3C/title%3E%3Cdesc%3ECreated with Sketch.%3C/desc%3E%3Cdefs%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-1'%3E%3C/path%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-3'%3E%3C/path%3E%3ClinearGradient x1='50.0053945%25' y1='8.58610612%25' x2='50.0053945%25' y2='100.013939%25' id='linearGradient-5'%3E%3Cstop stop-color='%231A237E' stop-opacity='0.2' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%231A237E' stop-opacity='0.02' offset='100%25'%3E%3C/stop%3E%3C/linearGradient%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-6'%3E%3C/path%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-8'%3E%3C/path%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-10'%3E%3C/path%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-12'%3E%3C/path%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='path-14'%3E%3C/path%3E%3CradialGradient cx='3.16804688%25' cy='2.71744318%25' fx='3.16804688%25' fy='2.71744318%25' r='161.248516%25' gradientTransform='translate(0.031680,0.027174),scale(1.000000,0.723077),translate(-0.031680,-0.027174)' id='radialGradient-16'%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0.1' offset='0%25'%3E%3C/stop%3E%3Cstop stop-color='%23FFFFFF' stop-opacity='0' offset='100%25'%3E%3C/stop%3E%3C/radialGradient%3E%3C/defs%3E%3Cg id='Page-1' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3E%3Cg id='Consumer-Apps-Docs-Large-VD-R8' transform='translate(-451.000000, -463.000000)'%3E%3Cg id='Hero' transform='translate(0.000000, 63.000000)'%3E%3Cg id='Personal' transform='translate(277.000000, 309.000000)'%3E%3Cg id='Docs-icon' transform='translate(174.000000, 91.000000)'%3E%3Cg id='Group'%3E%3Cg id='Clipped'%3E%3Cmask id='mask-2' fill='white'%3E%3Cuse xlink:href='%23path-1'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L36.71875,10.3409091 L29.375,0 Z' id='Path' fill='%234285F4' fill-rule='nonzero' mask='url(%23mask-2)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-4' fill='white'%3E%3Cuse xlink:href='%23path-3'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpolygon id='Path' fill='url(%23linearGradient-5)' fill-rule='nonzero' mask='url(%23mask-4)' points='30.6638281 16.4309659 47 32.8582386 47 17.7272727'%3E%3C/polygon%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-7' fill='white'%3E%3Cuse xlink:href='%23path-6'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M11.75,47.2727273 L35.25,47.2727273 L35.25,44.3181818 L11.75,44.3181818 L11.75,47.2727273 Z M11.75,53.1818182 L29.375,53.1818182 L29.375,50.2272727 L11.75,50.2272727 L11.75,53.1818182 Z M11.75,32.5 L11.75,35.4545455 L35.25,35.4545455 L35.25,32.5 L11.75,32.5 Z M11.75,41.3636364 L35.25,41.3636364 L35.25,38.4090909 L11.75,38.4090909 L11.75,41.3636364 Z' id='Shape' fill='%23F1F1F1' fill-rule='nonzero' mask='url(%23mask-7)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-9' fill='white'%3E%3Cuse xlink:href='%23path-8'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cg id='Group' mask='url(%23mask-9)'%3E%3Cg transform='translate(26.437500, -2.954545)'%3E%3Cpath d='M2.9375,2.95454545 L2.9375,16.25 C2.9375,18.6985795 4.90929688,20.6818182 7.34375,20.6818182 L20.5625,20.6818182 L2.9375,2.95454545 Z' id='Path' fill='%23A1C2FA' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-11' fill='white'%3E%3Cuse xlink:href='%23path-10'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,4.80113636 C0,2.36363636 1.9828125,0.369318182 4.40625,0.369318182 L29.375,0.369318182 L29.375,0 L4.40625,0 Z' id='Path' fill-opacity='0.2' fill='%23FFFFFF' fill-rule='nonzero' mask='url(%23mask-11)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-13' fill='white'%3E%3Cuse xlink:href='%23path-12'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M42.59375,64.6306818 L4.40625,64.6306818 C1.9828125,64.6306818 0,62.6363636 0,60.1988636 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,60.1988636 C47,62.6363636 45.0171875,64.6306818 42.59375,64.6306818 Z' id='Path' fill-opacity='0.2' fill='%231A237E' fill-rule='nonzero' mask='url(%23mask-13)'%3E%3C/path%3E%3C/g%3E%3Cg id='Clipped'%3E%3Cmask id='mask-15' fill='white'%3E%3Cuse xlink:href='%23path-14'%3E%3C/use%3E%3C/mask%3E%3Cg id='SVGID_1_'%3E%3C/g%3E%3Cpath d='M33.78125,17.7272727 C31.3467969,17.7272727 29.375,15.7440341 29.375,13.2954545 L29.375,13.6647727 C29.375,16.1133523 31.3467969,18.0965909 33.78125,18.0965909 L47,18.0965909 L47,17.7272727 L33.78125,17.7272727 Z' id='Path' fill-opacity='0.1' fill='%231A237E' fill-rule='nonzero' mask='url(%23mask-15)'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3Cpath d='M29.375,0 L4.40625,0 C1.9828125,0 0,1.99431818 0,4.43181818 L0,60.5681818 C0,63.0056818 1.9828125,65 4.40625,65 L42.59375,65 C45.0171875,65 47,63.0056818 47,60.5681818 L47,17.7272727 L29.375,0 Z' id='Path' fill='url(%23radialGradient-16)' fill-rule='nonzero'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E",
    label: "Create a Google doc",
    callback: openUrl("https://docs.new"),
    title: "Google Docs",
  },
  screenshot: {
    commands: ["screenshot"],
    icon: "chrome://browser/skin/screenshot.svg",
    label: "Take a Screenshot",
    callback: () => {
      Services.obs.notifyObservers(null, "menuitem-screenshot-extension");
    },
    title: "Pro Client",
  },
  preferences: {
    commands: ["preferences"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences",
    callback: openUrl("about:preferences"),
    title: "Pro Client",
  },
  downloads: {
    commands: ["downloads"],
    icon: "chrome://browser/skin/downloads/downloads.svg",
    label: "Open Downloads",
    callback: openUrl("about:downloads"),
    title: "Pro Client",
  },
  privacy: {
    commands: ["privacy"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences (Privacy & Security)",
    callback: openUrl("about:preferences#privacy"),
    title: "Pro Client",
  },
  viewsource: {
    commands: ["view-source"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "View Source",
    callback: () => {
      let window = BrowserWindowTracker.getTopWindow();
      let spec = window.gBrowser.selectedTab.linkedBrowser.documentURI.spec;
      openUrl("view-source:" + spec)();
    },
    title: "Pro Client",
  },
  inspect: {
    commands: ["inspector"],
    icon: "chrome://devtools/skin/images/tool-inspector.svg",
    label: "Open Inspector",
    callback: () => {
      // TODO: This is supposed to be called with an element to start inspecting.
      DevToolsShim.inspectNode(
        BrowserWindowTracker.getTopWindow().gBrowser.selectedTab
      );
    },
    title: "Pro Client",
  },
  // TODO: Included this to as I think it highlights some potential danger. It was the most
  // used command in the gcli however I expect a lot of users would be surprised if we restarted
  // the browser as soon as they typed "restart" + ENTER.
  restart: {
    commands: ["restart"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Restart Firefox",
    callback: restartBrowser,
    title: "Pro Client",
  },
};

function openUrl(url) {
  return function() {
    let window = BrowserWindowTracker.getTopWindow();
    window.gBrowser.loadOneTab(url, {
      inBackground: false,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  };
}

function restartBrowser() {
  // Notify all windows that an application quit has been requested.
  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );
  Services.obs.notifyObservers(
    cancelQuit,
    "quit-application-requested",
    "restart"
  );
  // Something aborted the quit process.
  if (cancelQuit.data) {
    return;
  }
  // If already in safe mode restart in safe mode.
  if (Services.appinfo.inSafeMode) {
    Services.startup.restartInSafeMode(Ci.nsIAppStartup.eAttemptQuit);
  } else {
    Services.startup.quit(
      Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
    );
  }
}

/**
 * A provider that returns a suggested url to the user based on what
 * they have currently typed so they can navigate directly.
 */
class ProviderQuickActionsBase extends UrlbarProvider {
  // A tree that maps keywords to a result.
  _tree = new KeywordTree();

  constructor() {
    super();
    UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);

    let children = [...Array(MAX_RESULTS).keys()].map(i => {
      return {
        name: `button-${i}`,
        tag: "span",
        attributes: {
          class: "urlbarView-quickaction-row",
          role: "button",
        },
        children: [
          {
            name: `icon-${i}`,
            tag: "img",
            attributes: { class: "urlbarView-favicon" },
          },
          {
            name: `div-${i}`,
            tag: "div",
            attributes: { flex: "1" },
            children: [
              {
                name: `title-${i}`,
                tag: "span",
                attributes: { class: "urlbarView-title" },
              },
              {
                name: `label-${i}`,
                tag: "span",
                attributes: { class: "urlbarView-label" },
              },
            ],
          },
        ],
      };
    });

    UrlbarView.addDynamicViewTemplate(DYNAMIC_TYPE_NAME, {
      children,
    });

    for (const key in COMMANDS) {
      for (const command of COMMANDS[key].commands) {
        for (let i = 0; i <= command.length; i++) {
          let prefix = command.substring(0, command.length - i);
          let result = this._tree.get(prefix);
          if (result) {
            result.push(key);
          } else {
            result = [key];
          }
          this._tree.set(prefix, result);
        }
      }
    }
  }

  /**
   * Returns the name of this provider.
   * @returns {string} the name of this provider.
   */
  get name() {
    return DYNAMIC_TYPE_NAME;
  }

  /**
   * The type of the provider.
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
  }

  getSuggestedIndex() {
    return 0;
  }

  /**
   * Whether this provider should be invoked for the given context.
   * If this method returns false, the providers manager won't start a query
   * with this provider, to save on resources.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @returns {boolean} Whether this provider should be invoked for the search.
   */
  isActive(queryContext) {
    return UrlbarPrefs.get(ENABLED_PREF);
  }

  /**
   * Starts querying.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @param {function} addCallback Callback invoked by the provider to add a new
   *        result. A UrlbarResult should be passed to it.
   * @note Extended classes should return a Promise resolved when the provider
   *       is done searching AND returning results.
   */
  async startQuery(queryContext, addCallback) {
    let results = this._tree.get(queryContext.searchString);
    if (!results) {
      return;
    }
    results.length =
      results.length > MAX_RESULTS ? MAX_RESULTS : results.length;
    const result = new UrlbarResult(
      UrlbarUtils.RESULT_TYPE.DYNAMIC,
      UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
      {
        results,
        dynamicType: DYNAMIC_TYPE_NAME,
      }
    );
    result.suggestedIndex = this.getSuggestedIndex();
    addCallback(this, result);
  }

  getViewUpdate(result) {
    let viewUpdate = {};
    [...Array(MAX_RESULTS).keys()].forEach(i => {
      let key = result.payload.results?.[i];
      let data = COMMANDS?.[key] || { icon: "", label: " " };
      viewUpdate[`button-${i}`] = { attributes: { "data-key": key } };
      viewUpdate[`icon-${i}`] = { attributes: { src: data.icon } };
      viewUpdate[`label-${i}`] = { textContent: data.label };
      viewUpdate[`title-${i}`] = { textContent: data.title };
      if (!result.payload.results?.[i]) {
        viewUpdate[`button-${i}`] = { attributes: { hidden: true, role: "" } };
      }
    });
    return viewUpdate;
  }

  async pickResult(results, itemPicked) {
    COMMANDS[itemPicked.dataset.key].callback();
  }
}

/**
 * The urlbar provider mechanism requires seperate providers for the
 * case when the urlbar is empty (priority 1) vs when a search term
 * has been entered.
 */
class ProviderQuickActionsEmpty extends ProviderQuickActionsBase {
  getSuggestedIndex() {
    return 1;
  }
  getPriority() {
    return 1;
  }
  isActive(queryContext) {
    return UrlbarPrefs.get(ENABLED_PREF) && !queryContext.searchString;
  }
}

/**
 * Handles results when a term has been entered.
 */
class ProviderQuickActionsFilter extends ProviderQuickActionsBase {}

var UrlbarProviderQuickActionsFilter = new ProviderQuickActionsFilter();
var UrlbarProviderQuickActionsEmpty = new ProviderQuickActionsEmpty();
