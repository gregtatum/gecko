// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

// Collation information from CLDR, search for <collation> elements in
// <https://github.com/unicode-org/cldr/tree/master/common/collation>.

function collations(tag) {
  return new Intl.Locale(tag).collations;
}

// Unknown language, script, and region should all give the same results.
assertEqArray(collations("und"), ["emoji", "eor"]);
assertEqArray(collations("und-ZZ"), ["emoji", "eor"]);
assertEqArray(collations("und-Zzzz"), ["emoji", "eor"]);
assertEqArray(collations("und-Zzzz-ZZ"), ["emoji", "eor"]);

// Test some locales.
assertEqArray(collations("en"), ["emoji", "eor"]);
assertEqArray(collations("de"), ["emoji", "eor", "phonebk"]);
assertEqArray(collations("zh"), ["big5han", "emoji", "eor", "gb2312", "pinyin", "stroke", "unihan", "zhuyin"]);
assertEqArray(collations("ar"), ["compat", "emoji", "eor"]);

if (typeof reportCompare === "function")
  reportCompare(0, 0);
