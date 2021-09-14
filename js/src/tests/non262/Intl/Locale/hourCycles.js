// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

// Hour cycle information from CLDR, search for the <timeData> element in
// <https://github.com/unicode-org/cldr/blob/master/common/supplemental/supplementalData.xml>.

function hourCycles(tag) {
  return new Intl.Locale(tag).hourCycles;
}

// Unknown language, script, and region should all give the same results.
assertEqArray(hourCycles("und"), ["h12", "h23"]);
assertEqArray(hourCycles("und-ZZ"), ["h12", "h23"]);
assertEqArray(hourCycles("und-Zzzz"), ["h12", "h23"]);
assertEqArray(hourCycles("und-Zzzz-ZZ"), ["h12", "h23"]);

// Simple tests using "en".
assertEqArray(hourCycles("en"), ["h12", "h23"]);
assertEqArray(hourCycles("en-US"), ["h12", "h23"]);
assertEqArray(hourCycles("en-ZZ"), ["h12", "h23"]);
assertEqArray(hourCycles("en-GB"), ["h23", "h12"]);

// Simple tests using "de".
assertEqArray(hourCycles("de"), ["h23", "h12"]);
assertEqArray(hourCycles("de-DE"), ["h23", "h12"]);
assertEqArray(hourCycles("de-ZZ"), ["h23", "h12"]);

// Locales without multiple additional allowed hour cycles.
assertEqArray(hourCycles("und-DK"), ["h23"]);
assertEqArray(hourCycles("da-DK"), ["h23"]);

// Locales with more than two additional allowed hour cycles.
assertEqArray(hourCycles("und-JP"), ["h23", "h12", "h11"]);
assertEqArray(hourCycles("ja-JP"), ["h23", "h12", "h11"]);

// Locales where preferred hour cycle doesn't match first allowed hour cycle.
assertEqArray(hourCycles("und-IR"), ["h23", "h12"]);
assertEqArray(hourCycles("fa-IR"), ["h23", "h12"]);

// Locales where language changes the preferred hour cycle.
assertEqArray(hourCycles("und-CA"), ["h12", "h23"]);
assertEqArray(hourCycles("en-CA"), ["h12", "h23"]);
assertEqArray(hourCycles("fr-CA"), ["h23", "h12"]);

// Region "001" has language overrides, too.
assertEqArray(hourCycles("und-001"), ["h23", "h12"]);
assertEqArray(hourCycles("en-001"), ["h12", "h23"]);
assertEqArray(hourCycles("ar-001"), ["h12", "h23"]);

// Locale whose maximized form has an unknown region.
assertEq(new Intl.Locale("aai").maximize().region, "ZZ");
assertEqArray(hourCycles("aai"), ["h23"]);
assertEqArray(hourCycles("aai-ZZ"), ["h23"]);

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
  assertEq(hourCycles(`und-${region}`).length > 0, true);
}

if (typeof reportCompare === "function")
  reportCompare(0, 0);
