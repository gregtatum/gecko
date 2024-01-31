/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const CLASSIFIER_REQUEST = JSON.stringify({
  queries: [
    "How many people live in Berlin?",
    "How many people live in Berlin?",
  ],
  text_pair: [
    "Berlin has a population of 3,520,031 registered inhabitants in an area of 891.82 square kilometers.",
    "New York City is famous for the Metropolitan Museum of Art.",
  ],
});

const CLASSIFIER_RESULT = JSON.stringify({
  scores: [7.210887908935547, -11.559350967407227],
});

async function setup({ disabled = false, prefs = [] } = {}) {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Enabled by default.
      ["browser.ml.enable", !disabled],
      ["browser.ml.logLevel", "All"],
      ["browser.ml.testing", true],
      ...prefs,
    ],
  });

  return {
    async cleanup() {
      await waitForCondition(
        () => EngineProcess.areAllEnginesTerminated(),
        "Waiting for all of the engines to be terminated.",
        100,
        200
      );
    },
  };
}

add_task(async function test_ml_engine_basics() {
  const { cleanup } = await setup();

  info("Get the engine process");
  const mlEngineParent = await EngineProcess.getMLEngineParent();

  info("Get summarizer");
  const summarizer = mlEngineParent.getEngine("summarizer");

  info("Run the summarizer");

  const summarizePromise = summarizer.run(CLASSIFIER_REQUEST);

  is(await summarizePromise, CLASSIFIER_RESULT, "The queries gets classified");

  ok(
    !EngineProcess.areAllEnginesTerminated(),
    "The engine process is still active."
  );

  await EngineProcess.destroyMLEngine();

  await cleanup();
});

/**
 * Tests that the SummarizerModel's internal errors are correctly surfaced.
 */
add_task(async function test_ml_engine_model_error() {
  const { cleanup } = await setup();

  info("Get the engine process");
  const mlEngineParent = await EngineProcess.getMLEngineParent();

  info("Get summarizer");
  const summarizer = mlEngineParent.getEngine("summarizer");

  info("Run the summarizer with a throwing example.");
  const summarizePromise = summarizer.run("throw");

  let error;
  try {
    await summarizePromise;
  } catch (e) {
    error = e;
  }
  is(
    error?.message,
    'Error: Received the message "throw", so intentionally throwing an error.',
    "The error is correctly surfaced."
  );

  summarizer.terminate();

  await cleanup();
});
