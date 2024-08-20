/* eslint-disable no-console */
// @ts-check
/*eslint-env node*/

import { createRequire } from "module";
import path from "node:path";
import fs from "node:fs";
import { ArgumentParser } from "argparse";
// @ts-ignore
import { select, input } from "@inquirer/prompts";

// eslint-disable-next-line no-shadow
const require = createRequire(import.meta.url);

// eslint-disable-next-line no-shadow
const Worker = /** @type {Worker} */ (require("web-worker"));

const BERGAMOT_MAJOR_VERSION = 1;
const LANGUAGE_MODEL_MAJOR_VERSION = 1;

// import Worker from "web-worker";

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    console.error(response);
    throw new Error("Response failed.");
  }

  return await response.json();
}

/**
 * @template {{ attachment: Attachment }} R
 * @param {string} destination
 * @param {() => Promise<R>} getRecord
 * @returns {Promise<ArrayBuffer>}
 */
async function getAttachment(destination, getRecord) {
  if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
  }
  if (!fs.existsSync(path.dirname(destination))) {
    fs.mkdirSync(path.dirname(destination));
  }
  if (fs.existsSync(destination)) {
    const { buffer } = fs.readFileSync(destination);
    return buffer;
  }

  const record = await getRecord();
  const url = `https://firefox-settings-attachments.cdn.mozilla.net/${record.attachment.location}`;
  console.log("Fetching attachment:", url);
  const response = await fetch(url);

  if (!response.body) {
    throw new Error("No response body");
  }

  console.log("Saving attachment:", destination);

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destination, Buffer.from(buffer));
  return buffer;
}

/**
 * @typedef {object} ModelEntry
 * @property {string} lang
 * @property {string} display
 * @property {ModelRecord[]} fromEn
 * @property {ModelRecord[]} toEn
 */

/**
 * Verifies the structure of the downloaded model files.
 *
 * @param {Record<string, LanguageTranslationModelFile>} modelFilesUnchecked
 * @returns {LanguageTranslationModelFiles}
 */
function verifyModelFiles(modelFilesUnchecked) {
  /** @type {LanguageTranslationModelFiles} */
  const modelFiles = /** @type {any} */ (modelFilesUnchecked);
  if (!modelFiles.model) {
    throw new Error("The model was not present in the files");
  }
  if (!modelFiles.lex) {
    throw new Error("The model was not present in the files");
  }
  if (!modelFiles.vocab && !(!modelFiles.srcvocab || !modelFiles.trgvocab)) {
    throw new Error("The model was not present in the files");
  }
  return modelFiles;
}

/**
 * @param {string} fromLang
 * @param {string} toLang
 * @returns {boolean}
 */
function isModelCached(fromLang, toLang) {
  if (fromLang !== "en" && toLang !== "en") {
    return isModelCached(fromLang, "en") && isModelCached("en", toLang);
  }
  const { recordsPath } = getModelPaths(fromLang, toLang);
  return fs.existsSync(recordsPath);
}

/**
 * @param {string} fromLang
 * @param {string} toLang
 */
function getModelPaths(fromLang, toLang) {
  const modelFolder = path.join("data", `model-${fromLang}-${toLang}`);
  const recordsPath = path.join(modelFolder, "records.json");
  return { modelFolder, recordsPath };
}

/**
 * @param {string} fromLang
 * @param {string} toLang
 * @returns {Promise<LanguageTranslationModelFiles>}
 */
async function getModelFiles(fromLang, toLang) {
  const { modelFolder, recordsPath } = getModelPaths(fromLang, toLang);

  /** @type {Record<string, LanguageTranslationModelFile>} */
  const modelFiles = {};

  // Try to load the files from a local source.
  if (fs.existsSync(recordsPath)) {
    /** @type {ModelRecord[]} */
    const records = JSON.parse(
      fs.readFileSync(recordsPath, { encoding: "utf-8" })
    );
    for (const record of records) {
      const { filename } = record.attachment;
      checkFilename(filename);
      modelFiles[record.fileType] = {
        record,
        buffer: fs.readFileSync(path.join(modelFolder, filename)).buffer,
      };
    }
    return verifyModelFiles(modelFiles);
  }

  // Look up the models and download the attachments.

  let records = await fetchModelRecords();

  // Filter to just the language pair.
  records = records.filter(r => r.fromLang === fromLang && r.toLang === toLang);

  if (!fs.existsSync(modelFolder)) {
    fs.mkdirSync(modelFolder);
  }

  console.log("Saving records:", recordsPath);
  fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2));

  for (const record of records) {
    const { filename } = record.attachment;
    checkFilename(filename);
    const destination = path.join(modelFolder, filename);
    modelFiles[record.fileType] = {
      record,
      buffer: await getAttachment(destination, async () => record),
    };
  }

  return verifyModelFiles(modelFiles);
}

/**
 * @param {string} filename
 */
function checkFilename(filename) {
  if (!filename.match(/^[\w\.-]+\.\w+$/)) {
    throw new Error("Filename was malformed");
  }
}

/**
 * @returns {Promise<ArrayBuffer>}
 */
async function getEngineWasm() {
  return getAttachment(
    path.join("data", "bergamot-translator-worker.wasm"),
    async () => {
      /** @type {{ data: WasmRecord[] }} */
      const { data } = await fetchJSON(
        "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-wasm/records"
      );

      const records = filterToLatestRecords(
        data.filter(record => record.name === "bergamot-translator"),
        BERGAMOT_MAJOR_VERSION
      );
      if (records.length !== 1) {
        throw new Error("Expected to only receive one record.");
      }
      return records[0];
    }
  );
}

/**
 * Retrieves the maximum major version of each record in the RemoteSettingsClient.
 *
 * If the client contains two different-version copies of the same record (e.g. 1.0 and 1.1)
 * then only the 1.1-version record will be returned in the resulting collection.
 *
 * @template {{ version: string, name: string }} R
 * @param {Array<R>} records
 * @param {number} majorVersion
 * @param {(record: R) => string} [lookupKey]
 *   The function to use to extract a lookup key from each record.
 *   This function should take a record as input and return a string that represents the
 *   lookup key for the record. For most record types, the name (default) is sufficient,
 *   however if a collection contains records with non-unique name values, it may be
 *   necessary to provide an alternative function here.
 * @returns {Array<R>}
 */
function filterToLatestRecords(
  records,
  majorVersion,
  lookupKey = record => record.name
) {
  if (!majorVersion) {
    throw new Error("Expected the records to have a major version.");
  }

  // Create a mapping to only the max version of each record discriminated by
  // the result of the lookupKey() function.

  /** @type {Map<string, R>} */
  const keyToRecord = new Map();

  for (const record of records) {
    const key = lookupKey(record);
    const existing = keyToRecord.get(key);

    if (!record.version) {
      console.error(record);
      throw new Error("Expected the record to have a version.");
    }
    if (
      isBetterRecordVersion(majorVersion, record.version, existing?.version)
    ) {
      keyToRecord.set(key, record);
    }
  }

  return Array.from(keyToRecord.values());
}

/**
 * Applies the constraint of matching for the best matching major version.
 *
 * @param {number} majorVersion
 * @param {string} nextVersion
 * @param {string} [existingVersion]
 */
function isBetterRecordVersion(majorVersion, nextVersion, existingVersion) {
  return (
    // Check that this is a major version record we can support.
    versionCompare(`${majorVersion}.0a`, nextVersion) <= 0 &&
    versionCompare(`${majorVersion + 1}.0a`, nextVersion) > 0 &&
    // Check that the new record is bigger version number
    (!existingVersion || versionCompare(existingVersion, nextVersion) < 0)
  );
}

/**
 * @param {string} fromLanguage
 * @param {string} toLanguage
 * @param {TranslationsEnginePayload} enginePayload
 */
function getTranslationsWorker(fromLanguage, toLanguage, enginePayload) {
  const resolvers = Promise.withResolvers();
  /** @type {Promise<typeof translate>} */
  const translateFnPromise = resolvers.promise;
  /** @type {(value: typeof translate) => void} */
  const translateFnResolve = resolvers.resolve;
  const translateFnReject = resolvers.reject;

  const url = new URL(
    "../../content/translations-engine.worker.js",
    /** @type {any} */ (import.meta).url
  );

  /** @type {Worker} */
  const worker = new /** @type {any} */ (Worker)(url);

  /** @type {Promise<void>} */
  let isReady = new Promise((resolve, reject) => {
    /**
     * @param {object} message
     * @param {object} message.data
     * @param {string} message.data.type
     * @param {string} [message.data.error]
     */
    function onMessage({ data }) {
      if (data.type === "initialization-success") {
        resolve();
      } else if (data.type === "initialization-error") {
        reject(data.error);
      }
      worker.removeEventListener("message", onMessage);
    }
    worker.addEventListener("message", onMessage);
  });

  let messageId = 0;

  worker.postMessage({
    type: "initialize",
    fromLanguage,
    toLanguage,
    enginePayload,
    messageId: messageId++,
    logLevel: "Error",
  });

  const innerWindowId = 0;

  /**
   * @param {string} sourceText
   * @returns {Promise<string>}
   */
  function translate(sourceText) {
    // eslint-disable-next-line no-shadow
    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        if (
          data.type === "translations-discarded" &&
          data.innerWindowId === innerWindowId
        ) {
          // The page was unloaded, and we no longer need to listen for a response.
          worker.removeEventListener("message", onMessage);
          return;
        }

        if (data.messageId !== messageId) {
          // Multiple translation requests can be sent before a response is received.
          // Ensure that the response received here is the correct one.
          return;
        }

        if (data.type === "translation-response") {
          resolve(data.targetText);
        }
        if (data.type === "translation-error") {
          reject(data.error);
        }
        worker.removeEventListener("message", onMessage);
      };

      worker.addEventListener("message", onMessage);

      worker.postMessage({
        type: "translation-request",
        isHTML: false,
        sourceText,
        messageId,
        innerWindowId,
      });
    });
  }

  isReady.then(() => void translateFnResolve(translate), translateFnReject);

  return translateFnPromise;
}

/**
 * @typedef {object} Choice
 * @property {string} name
 * @property {string} value
 */

async function promptLanguages() {
  const dn = new Intl.DisplayNames(undefined, { type: "language" });
  const records = await fetchModelRecords();
  const fromLangs = new Set();
  const toLangs = new Set();
  const pageSize = 30;
  /**
   * @param {Set<string>} langs
   * @returns {Choice[]}
   */
  function getChoices(langs) {
    const choices = [...langs].map(langCode => ({
      name: dn.of(langCode) ?? langCode,
      value: langCode,
    }));
    choices.sort((a, b) => a.name.localeCompare(b.name));
    return choices;
  }

  for (const record of records) {
    fromLangs.add(record.fromLang);
  }

  /** @type {string} */
  const fromLang = await select({
    message: 'Choose a "from" language:',
    choices: getChoices(fromLangs),
    pageSize,
  });

  for (const record of records) {
    if (record.fromLang === fromLang || record.fromLang === "en") {
      toLangs.add(record.toLang);
    }
  }

  /** @type {string} */
  const toLang = await select({
    message: 'Choose a "to" language:',
    choices: getChoices(toLangs),
    pageSize,
  });

  return { fromLang, toLang };
}

/**
 * Compare the remote settings versions
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function versionCompare(a, b) {
  const aLessThanB = -1;
  const aGreaterThanB = 1;
  const aEqualToB = 0;

  /** @type {string[]} */
  const aPartsStr = a.split(".");
  /** @type {string[]} */
  const bPartsStr = b.split(".");

  while (aPartsStr.length < 3) {
    aPartsStr.unshift("0");
  }
  while (bPartsStr.length < 3) {
    bPartsStr.unshift("0");
  }

  const [, aEnd, aBeta] = aPartsStr[2].match(/(\d+)([a-z]\d?)?/) ?? [
    undefined,
    "0",
    "",
  ];
  const [, bEnd, bBeta] = bPartsStr[2].match(/(\d+)([a-z]\d?)?/) ?? [
    undefined,
    "0",
    "",
  ];

  aPartsStr.pop();
  bPartsStr.pop();
  aPartsStr.push(aEnd);
  bPartsStr.push(bEnd);

  const aParts = [
    Number(aPartsStr[0]),
    Number(aPartsStr[1]),
    Number(aPartsStr[2]),
  ];

  const bParts = [
    Number(bPartsStr[0]),
    Number(bPartsStr[1]),
    Number(bPartsStr[2]),
  ];

  for (const part of aParts) {
    if (isNaN(part)) {
      console.error(aParts);
      throw new Error(a + " had an NaN.");
    }
  }
  for (const part of bParts) {
    if (isNaN(part)) {
      console.error(bParts);
      throw new Error(b + " had an NaN.");
    }
  }

  for (let i = 0; i < 3; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];
    if (aPart > bPart) {
      return aGreaterThanB;
    }
    if (aPart < bPart) {
      return aLessThanB;
    }
  }
  if (!aBeta && !bBeta) {
    return aEqualToB;
  }
  if (!aBeta) {
    return aGreaterThanB;
  }
  if (!bBeta) {
    return aLessThanB;
  }

  return aBeta.localeCompare(bBeta);
}

async function fetchModelRecords() {
  /** @type {{ data: ModelRecord[] }} */
  const { data } = await fetchJSON(
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models/records"
  );

  return filterToLatestRecords(
    data,
    LANGUAGE_MODEL_MAJOR_VERSION,
    record => `${record.name}-${record.fromLang},${record.toLang}`
  );
}

async function main() {
  const parser = new ArgumentParser({
    description: "Argparse example",
  });

  parser.add_argument("--from", {
    help: "BCP 47 language tag",
    default: "",
  });
  parser.add_argument("--to", {
    help: "BCP 47 language tag",
    default: "",
  });
  parser.add_argument("--no_cache", { help: "Skip the local cache" });

  const args = parser.parse_args();

  let fromLang = args.from;
  let toLang = args.to;
  if (!fromLang || !toLang) {
    const langs = await promptLanguages();
    fromLang = langs.fromLang;
    toLang = langs.toLang;
  }

  const enginePayload = {
    bergamotWasmArrayBuffer: await getEngineWasm(),
    languageModelFiles:
      fromLang !== "en" && toLang !== "en"
        ? // Pivot language:
          [
            await getModelFiles(fromLang, "en"),
            await getModelFiles("en", toLang),
          ]
        : // Direct translation
          [await getModelFiles(fromLang, toLang)],
    isMocked: false,
  };
  const translate = await getTranslationsWorker(
    fromLang,
    toLang,
    enginePayload
  );

  // eslint-disable-next-line no-constant-condition
  let sourceText;
  while ((sourceText = await input({ message: `[${fromLang}-${toLang}]` }))) {
    console.log(await translate(sourceText));
  }
}

main();
