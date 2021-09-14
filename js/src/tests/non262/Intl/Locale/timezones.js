// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

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

// List of all supported continents in ICU 69.
const continents = [
  "002", "009", "019", "142", "150",
];

// List of all supported subcontinents in ICU 69.
const subcontinents = [
  "005", "011", "013", "014", "015", "017", "018", "021", "029", "030",
  "034", "035", "039", "053", "054", "057", "061", "143", "145", "151",
  "154", "155", "QO",
];

// List of all grouping region identifiers in ICU 69.
const groupings = [
  "003", "202", "419", "EU", "EZ", "UN",
];

// List of all deprecated region identifiers in ICU 69.
const deprecated = [
  "062", "172", "200", "530", "532", "536", "582", "810", "830", "890",
  "891", "958", "959", "960", "962", "963", "964", "965", "966", "968",
  "969", "970", "971", "972", "973", "974", "975", "976", "977", "978",
  "979", "980", "981", "982", "984", "985", "986", "987", "988", "989",
  "990", "991", "992", "993", "994", "995", "996", "997", "998", "AN",
  "CS", "FQ", "NT", "PC", "SU", "YU",
];

// Unsupported region identifiers.
const unsupported = [
  "QX", "QY", "QZ"
];

const regions = [
  "001", // UN M.49 code for the World.
  ...continents,
  ...subcontinents,
  ...territories,
  ...groupings,
  ...deprecated,
  ...unsupported,
  "ZZ", // Identifier for the unknown region.
];

function canonicalizeTimeZone(timeZone) {
  // Temporal.TimeZone will provide an easier interface to canonicalize time zone names.
  return new Intl.DateTimeFormat("und", {timeZone}).resolvedOptions().timeZone;
}

// Ensure all time zones are sorted alphabetically, don't contain duplicates, and they use their
// canonical name.
for (let region of regions) {
  let {timeZones} = new Intl.Locale(`und-${region}`);
  let sorted = [...timeZones].sort();

  assertEqArray(timeZones, sorted);
  assertEq(timeZones.length, new Set(timeZones).size);

  for (let timeZone of timeZones) {
    assertEq(timeZone, canonicalizeTimeZone(timeZone));
  }
}

// "tz" Unicode extensions are ignored.
assertEqArray(new Intl.Locale("fr-FR-u-tz-deber").timeZones, ["Europe/Paris"]);

// Returns |undefined| when no region subtag is present.
assertEq(new Intl.Locale("en").timeZones, undefined);

// Ensure region subtags in transform extension sequences are ignored.
assertEq(new Intl.Locale("en-t-en-US").timeZones, undefined);

if (typeof reportCompare === "function")
  reportCompare(0, 0);
