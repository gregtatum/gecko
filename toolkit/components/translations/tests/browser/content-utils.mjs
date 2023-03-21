/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */

/* eslint-disable no-shadow */

/**
 * Select all relevant elements on the content page.
 *
 * @param {Object} args
 * @param {Document} args.document
 * @param {Window} args.window
 */
export function selectElements({ document, window }) {
  Services.scriptloader.loadSubScript(
    "chrome://mochikit/content/tests/SimpleTest/SimpleTest.js",
    window
  );

  return {
    document,
    window,
    /** @type {HTMLHeadingElement} */
    pageHeader: document.querySelector(
      '[data-l10n-id="about-translations-header"]'
    ),
    /** @type {HTMLSelectElement} */
    fromSelect: document.querySelector("select#language-from"),
    /** @type {HTMLSelectElement} */
    toSelect: document.querySelector("select#language-to"),
    /** @type {HTMLTextAreaElement} */
    translationTextarea: document.querySelector("textarea#translation-from"),
    /** @type {HTMLDivElement} */
    translationResult: document.querySelector("#translation-to"),
    /** @type {HTMLDivElement} */
    translationResultBlank: document.querySelector("#translation-to-blank"),
  };
}

/**
 * Gets the computed style to check if an element is visible.
 *
 * @param {HTMLElement} element
 * @param {string} name
 */
export function checkElementIsVisible(element, name) {
  const window = element.ownerGlobal.defaultView;
  window.ok(Boolean(element), `Element ${name} was found.`);
  const { visibility } = window.getComputedStyle(element);
  window.is(visibility, "visible", `Element ${name} was visible.`);
}

/**
 * Gets the computed style to check if an element is invisible.
 *
 * @param {HTMLElement} element
 * @param {string} name
 */
export function checkElementIsInvisible(element, name) {
  const window = element.ownerGlobal.defaultView;
  window.ok(Boolean(element), `Element ${name} was found.`);
  const { visibility } = window.getComputedStyle(element);
  window.is(visibility, "hidden", `Element ${name} was invisible.`);
}

/**
 * Some languages can be marked as hidden in the dropbdown. This function
 * asserts the configuration of the options.
 *
 * @param {object} args
 * @param {string} args.message
 * @param {HTMLSelectElement} args.select
 * @param {string[]} args.availableOptions
 * @param {string} args.selectedValue
 */
export function assertOptions({
  message,
  select,
  availableOptions,
  selectedValue,
}) {
  const options = [...select.options]
    .filter(option => !option.hidden)
    .map(option => option.value);

  window.info(message);
  Assert.deepEqual(options, availableOptions, "The available options match.");
  window.is(selectedValue, select.value, "The selected value matches.");
}

/**
 * @param {HTMLDivElement} translationResult
 * @param {string} translation
 */
export async function assertTranslationResult(translationResult, translation) {
  try {
    await ContentTaskUtils.waitForCondition(
      () => translation === translationResult.innerText,
      `Waiting for: "${translation}"`
    );
  } catch (error) {
    // The result wasn't found, but the assertion below will report the error.
    console.error(error);
  }

  is(
    translation,
    translationResult.innerText,
    "The text runs through the mocked translations engine."
  );
}

/**
 * Changes the values and dispatches an "input" event for a form element.
 *
 * @param {HTMLSelectElement | HTMLTextAreaElement} input
 * @param {string} value
 */
export function inputValue(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}
