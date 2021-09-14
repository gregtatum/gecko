// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

// Week information from CLDR, search for the <weekData> element in
// <https://github.com/unicode-org/cldr/blob/master/common/supplemental/supplementalData.xml>.

const Weekday = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const testData = {
  "001": {
    firstDay: Weekday.Monday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 1,
  },
  "US": {
    firstDay: Weekday.Sunday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 1,
  },
  "DE": {
    firstDay: Weekday.Monday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 4,
  },
  "FR": {
    firstDay: Weekday.Monday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 4,
  },
  "GB": {
    firstDay: Weekday.Monday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 4,
  },
  "MV": {
    firstDay: Weekday.Friday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 1,
  },
  "EG": {
    firstDay: Weekday.Saturday,
    weekend: [Weekday.Friday, Weekday.Saturday],
    minimalDays: 1,
  },
  "CN": {
    firstDay: Weekday.Sunday,
    weekend: [Weekday.Saturday, Weekday.Sunday],
    minimalDays: 1,
  },
  "IL": {
    firstDay: Weekday.Sunday,
    weekend: [Weekday.Friday, Weekday.Saturday],
    minimalDays: 1,
  },
  "IR": {
    firstDay: Weekday.Saturday,
    weekend: [Weekday.Friday],
    minimalDays: 1,
  },
  "AF": {
    firstDay: Weekday.Saturday,
    weekend: [Weekday.Thursday, Weekday.Friday],
    minimalDays: 1,
  },
  "IN": {
    firstDay: Weekday.Sunday,
    weekend: [Weekday.Sunday],
    minimalDays: 1,
  },
};

for (let [region, weekInfo] of Object.entries(testData)) {
  assertDeepEq(new Intl.Locale(`und-${region}`).weekInfo, weekInfo);
}

// "ca" Unicode extensions are ignored.
{
  let {weekInfo} = new Intl.Locale("en-US");
  let {weekInfo: gregory} = new Intl.Locale("en-US-u-ca-gregory");
  let {weekInfo: iso8601} = new Intl.Locale("en-US-u-ca-iso8601");

  assertDeepEq(weekInfo, {
    firstDay: Weekday.Sunday, weekend: [Weekday.Saturday, Weekday.Sunday], minimalDays: 1,
  });
  assertDeepEq(gregory, weekInfo);
  assertDeepEq(iso8601, weekInfo);
}

// Test large "ca" Unicode extensions.
{
  // The third locale's language tag exceeds |ULOC_KEYWORD_AND_VALUES_CAPACITY|, which causes
  // ICU to create a "bogus" locale (cf. |icu::Locale::isBogus()|).
  //
  // Should we ever enable "ca" Unicode extensions, we must sanitise the input before passing it to
  // ICU to avoid running into these ICU internal limits.

  let {weekInfo: one} = new Intl.Locale("de-u-ca" + "-aaaaaaaa".repeat(1));
  let {weekInfo: ten} = new Intl.Locale("de-u-ca" + "-aaaaaaaa".repeat(10));
  let {weekInfo: hundred} = new Intl.Locale("de-u-ca" + "-aaaaaaaa".repeat(100));

  assertDeepEq(ten, one);
  assertDeepEq(hundred, one);
}

// "rg" Unicode extensions are ignored.
{
  let {weekInfo: weekInfo_en_US} = new Intl.Locale("en-US");
  let {weekInfo: weekInfo_en_GB} = new Intl.Locale("en-GB");
  let {weekInfo} = new Intl.Locale("en-US-u-rg-gbzzzz");

  assertDeepEq(weekInfo_en_US, {
    firstDay: Weekday.Sunday, weekend: [Weekday.Saturday, Weekday.Sunday], minimalDays: 1,
  });
  assertDeepEq(weekInfo_en_GB, {
    firstDay: Weekday.Monday, weekend: [Weekday.Saturday, Weekday.Sunday], minimalDays: 4,
  });
  assertDeepEq(weekInfo, weekInfo_en_US);
}

// "fw" Unicode extensions are ignored.
{
  let {weekInfo: weekInfo_en_US} = new Intl.Locale("en-US");
  let {weekInfo: weekInfo_en_GB} = new Intl.Locale("en-GB");
  let {weekInfo} = new Intl.Locale("en-US-u-fw-mon");

  assertDeepEq(weekInfo_en_US, {
   firstDay: Weekday.Sunday, weekend: [Weekday.Saturday, Weekday.Sunday], minimalDays: 1,
  });
  assertDeepEq(weekInfo_en_GB, {
   firstDay: Weekday.Monday, weekend: [Weekday.Saturday, Weekday.Sunday], minimalDays: 4,
  });
  assertDeepEq(weekInfo, weekInfo_en_US);
}

// All possible calendars from <https://github.com/unicode-org/cldr/blob/master/common/bcp47/calendar.xml>.
const calendars = [
  "buddhist",
  "chinese",
  "coptic",
  "dangi",
  "ethioaa",
  "ethiopic-amete-alem",
  "ethiopic",
  "gregory",
  "hebrew",
  "indian",
  "islamic",
  "islamic-umalqura",
  "islamic-tbla",
  "islamic-civil",
  "islamic-rgsa",
  "iso8601",
  "japanese",
  "persian",
  "roc",
  "islamicc",
];

// List of all supported territories in ICU 69.
const territories = [
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ",
  "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD",
  "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO",
  "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC",
  "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO",
  "CP", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DG",
  "DJ", "DK", "DM", "DO", "DZ", "EA", "EC", "EE", "EG", "EH",
  "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA",
  "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN",
  "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "IC", "ID", "IE", "IL", "IM", "IN",
  "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE",
  "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV",
  "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML",
  "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV",
  "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI",
  "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF",
  "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW",
  "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC",
  "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN",
  "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TA", "TC",
  "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY",
  "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS",
  "XK", "YE", "YT", "ZA", "ZM", "ZW",
];

// Test all Unicode calendar extension.
for (let region of territories) {
  let map = new Map();
  for (let calendar of calendars) {
    let {weekInfo} = new Intl.Locale(`und-${region}-u-ca-${calendar}`);

    let key = JSON.stringify(weekInfo);
    if (!map.has(key)) {
      map.set(key, {weekInfo, calendars: []});
    }
    map.get(key).calendars.push(calendar);
  }

  // All weekInfo objects must have the same content.
  assertEq(map.size, 1, "unexpected weekInfo elements");
}

if (typeof reportCompare === "function")
  reportCompare(0, 0);
