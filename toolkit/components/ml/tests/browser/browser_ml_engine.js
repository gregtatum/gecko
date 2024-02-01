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

function removeMetrics(inputJsonString) {
  let jsonObject = JSON.parse(inputJsonString);
  delete jsonObject.metrics;
  return JSON.stringify(jsonObject);
}

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

  info("Get the classifier");
  const classifier = mlEngineParent.getEngine("text-classification");

  info("Run the classifier");
  const classifyPromise = classifier.run(CLASSIFIER_REQUEST);

  is(
    removeMetrics(await classifyPromise),
    CLASSIFIER_RESULT,
    "The queries gets classified"
  );

  ok(
    !EngineProcess.areAllEnginesTerminated(),
    "The engine process is still active."
  );

  await EngineProcess.destroyMLEngine();

  await cleanup();
});

add_task(async function test_ml_engine_unknown_task() {
  const { cleanup } = await setup();

  info("Get the engine process");
  const mlEngineParent = await EngineProcess.getMLEngineParent();
  const classifier = mlEngineParent.getEngine("unknown");
  const classifierPromise = classifier.run(CLASSIFIER_REQUEST);

  let error;
  try {
    await classifierPromise;
  } catch (e) {
    error = e;
  }

  is(
    error?.message,
    "Error: Unknown task: unknown",
    "The error is correctly surfaced."
  );

  await cleanup();
});

/**
 * Tests that the internal errors are correctly surfaced.
 */
add_task(async function test_ml_engine_model_error() {
  const { cleanup } = await setup();

  info("Get the engine process");
  const mlEngineParent = await EngineProcess.getMLEngineParent();

  info("Get the classifier");
  const classifier = mlEngineParent.getEngine("text-classification");

  info("Run the classifier with a throwing example.");
  const classifierPromise = classifier.run("throw");

  let error;
  try {
    await classifierPromise;
  } catch (e) {
    error = e;
  }
  is(
    error?.message,
    'Error: Received the message "throw", so intentionally throwing an error.',
    "The error is correctly surfaced."
  );

  classifier.terminate();

  await cleanup();
});
