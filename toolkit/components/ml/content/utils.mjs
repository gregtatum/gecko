/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.ml.logLevel",
    prefix: "ML",
  });
});

function sentenceIterator(text) {
  let useSegmenter = typeof Intl.Segmenter !== "undefined";
  let sentences;

  if (useSegmenter) {
    lazy.console.debug("using Intl.Segmenter");
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segments = segmenter.segment(text);
    sentences = Array.from(segments).map(segment => segment.segment);
  } else {
    // Fallback to regex-based sentence splitting
    sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  }

  let current = 0;
  let num_sentences = 1;

  // Return an iterator
  return {
    next() {
      if (current < sentences.length) {
        // Collect up to 3 sentences
        const chunk = sentences
          .slice(current, current + num_sentences)
          .join(" ")
          .trim();
        current += num_sentences;
        return { value: chunk, done: false };
      }
      // No more sentences, mark as done
      return { done: true };
    },
  };
}

function cleanUpEntity(entity) {
  return entity.replace(/^[\s-]+|[\s-]+$/g, "");
}

function recreateEntities(entities) {
  let reconstructedEntities = new Map();
  let currentEntity = "";
  let currentType = "";
  let totalScore = 0;
  let wordCount = 0;

  entities.forEach(entity => {
    const entityType = entity.entity.startsWith("B-")
      ? entity.entity.substring(2)
      : currentType;

    if (entity.entity.startsWith("B-")) {
      if (currentEntity.length && wordCount > 0) {
        let averageScore = totalScore / wordCount;
        if (averageScore >= 0.9) {
          reconstructedEntities.set(cleanUpEntity(currentEntity), currentType);
        }
      }
      currentEntity = entity.word;
      currentType = entityType;
      totalScore = entity.score;
      wordCount = 1;
    } else if (entity.entity.startsWith("I-")) {
      currentEntity += entity.word.startsWith("##")
        ? entity.word.slice(2)
        : " " + entity.word;
      totalScore += entity.score;
      wordCount++;
    }
  });

  if (currentEntity.length && wordCount > 0) {
    let averageScore = totalScore / wordCount;
    if (averageScore >= 0.9) {
      reconstructedEntities.set(cleanUpEntity(currentEntity), currentType);
    }
  }

  const finalEntities = [];
  reconstructedEntities.forEach((type, ename) => {
    if (
      !Array.from(reconstructedEntities.keys()).some(
        key => key !== ename && key.includes(ename)
      )
    ) {
      finalEntities.push(`${ename} (${type})`);
    }
  });

  return finalEntities;
}

function softmax(arr) {
  const maxVal = max(arr)[0];
  const exps = arr.map(x => Math.exp(x - maxVal));
  const sumExps = exps.reduce((acc, val) => acc + val, 0);
  const softmaxArr = exps.map(x => x / sumExps);
  return softmaxArr;
}

// eslint-disable-next-line
function max(arr) {
  if (arr.length === 0) {
    throw Error("Array must not be empty");
  }
  // eslint-disable-next-line
  let max = arr[0];
  let indexOfMax = 0;
  for (let i = 1; i < arr.length; ++i) {
    if (arr[i] > max) {
      max = arr[i];
      indexOfMax = i;
    }
  }
  return [Number(max), indexOfMax];
}

function extractEntities(model, tokenizer, logits, input_ids) {
  const ignore_labels = ["O"];
  const id2label = model.config.id2label;
  let toReturn = [];
  for (let i = 0; i < logits.dims[0]; ++i) {
    const ids = input_ids[i];
    const batch = logits[i];
    const tokens = [];
    for (let j = 0; j < batch.dims[0]; ++j) {
      const tokenData = batch[j];
      const topScoreIndex = max(tokenData.data)[1];

      const entity = id2label
        ? id2label[topScoreIndex]
        : `LABEL_${topScoreIndex}`;

      if (ignore_labels.includes(entity)) {
        continue;
      }
      const word = tokenizer.decode([ids[j].item()], {
        skip_special_tokens: true,
      });
      if (word === "") {
        continue;
      }

      const scores = softmax(tokenData.data);

      tokens.push({
        entity,
        score: scores[topScoreIndex],
        index: j,
        word,
      });
    }
    toReturn.push(tokens);
  }

  return recreateEntities(toReturn[0]);
}

function cleanOutput(text, maxLength = 10) {
  let sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
  if (sentences == null) {
    return text.trim();
  }
  sentences = sentences.slice(0, maxLength);
  const capitalizedSentences = sentences.map(sentence => {
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  });
  return capitalizedSentences.join(" ");
}

function cleanText(text) {
  text = text.replace(/\xA0/g, " ");
  text = text.replace(/\r\n|\n|\r/g, " ");
  text = text.replace(/\s\s+/g, " ");
  text = text.replace(/[^\w\s.,\/#!\?$%\^&\*;:{}=\-_`~()]/g, "");
  return text.trim();
}

export { sentenceIterator, extractEntities, cleanOutput, cleanText };
