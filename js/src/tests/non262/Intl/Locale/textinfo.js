// |reftest| skip-if(!this.hasOwnProperty("Intl")||release_or_beta)

// Character order information from CLDR, search for <characterOrder> element in
// <https://github.com/unicode-org/cldr/blob/master/common/main>.

function textInfo(tag) {
  return new Intl.Locale(tag).textInfo;
}

// Unknown language, script, and region should all give the same results.
assertDeepEq(textInfo("und"), {direction: "ltr"});
assertDeepEq(textInfo("und-ZZ"), {direction: "ltr"});
assertDeepEq(textInfo("und-Zzzz"), {direction: "ltr"});
assertDeepEq(textInfo("und-Zzzz-ZZ"), {direction: "ltr"});

// Test some locales.
assertDeepEq(textInfo("en"), {direction: "ltr"});
assertDeepEq(textInfo("de"), {direction: "ltr"});
assertDeepEq(textInfo("ar"), {direction: "rtl"});

if (typeof reportCompare === "function")
  reportCompare(0, 0);
