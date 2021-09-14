// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

// Calendar preference information from CLDR, search for the <calendarPreferenceData> element in
// <https://github.com/unicode-org/cldr/blob/master/common/supplemental/supplementalData.xml>.

function calendars(tag) {
  return new Intl.Locale(tag).calendars;
}

// Unknown language, script, and region should all give the same results.
assertEqArray(calendars("und"), ["gregory"]);
assertEqArray(calendars("und-ZZ"), ["gregory"]);
assertEqArray(calendars("und-Zzzz"), ["gregory"]);
assertEqArray(calendars("und-Zzzz-ZZ"), ["gregory"]);

// Simple tests using "en".
assertEqArray(calendars("en"), ["gregory"]);
assertEqArray(calendars("en-US"), ["gregory"]);
assertEqArray(calendars("en-ZZ"), ["gregory"]);

// Simple tests using "de".
assertEqArray(calendars("de"), ["gregory"]);
assertEqArray(calendars("de-DE"), ["gregory"]);
assertEqArray(calendars("de-ZZ"), ["gregory"]);

// Test region "001".
assertEqArray(calendars("und-001"), ["gregory"]);
assertEqArray(calendars("en-001"), ["gregory"]);
assertEqArray(calendars("ar-001"), ["gregory"]);

// Locales which don't use just the Gregorian calendar.
assertEqArray(calendars("und-CN"), ["gregory", "chinese"]);
assertEqArray(calendars("und-EG"), ["gregory", "coptic", "islamic", "islamic-civil", "islamic-tbla"]);
assertEqArray(calendars("und-ET"), ["gregory", "ethiopic"]);
assertEqArray(calendars("und-IL"), ["gregory", "hebrew", "islamic", "islamic-civil", "islamic-tbla"]);
assertEqArray(calendars("und-IN"), ["gregory", "indian"]);
assertEqArray(calendars("und-IR"), ["persian", "gregory", "islamic", "islamic-civil", "islamic-tbla"]);
assertEqArray(calendars("und-JP"), ["gregory", "japanese"]);
assertEqArray(calendars("und-KR"), ["gregory", "dangi"]);
assertEqArray(calendars("und-SA"), ["islamic-umalqura", "gregory", "islamic", "islamic-rgsa"]);
assertEqArray(calendars("und-TH"), ["buddhist", "gregory"]);
assertEqArray(calendars("und-TW"), ["gregory", "roc", "chinese"]);

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

const regions = [
  "001", // UN M.49 code for the World.
  ...territories,
  "ZZ", // Identifier for the unknown region.
];

// Smoke test using some regions.
for (let region of regions) {
  assertEq(calendars(`und-${region}`).length > 0, true);
}

if (typeof reportCompare === "function")
  reportCompare(0, 0);
