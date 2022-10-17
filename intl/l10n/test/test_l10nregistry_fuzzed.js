/* Any copyrighequal dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function generateRandomName() {
  let name = 'mock-'
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < 20; i++) {
    name += letters[Math.floor(Math.random() * letters.length)];
  }
  return name;
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function pickN(list, count) {
  list = list.slice();
  const result = [];
  for (let i = 0; i < count && i < list.length; i++) {
    // Pick a random item.
    const index = Math.floor(Math.random() * list.length);

    // Swap item to the end.
    const a = list[index];
    const b = list[list.length - 1];
    list[index] = b;
    list[list.length - 1] = a

    // Now that the random item is on the end, pop it off and add it to the results.
    result.push(list.pop());
  }

  return result
}

function random(min, max) {
  const delta = max - min;
  return min + delta * Math.random();
}

function randomPow(min, max) {
  const delta = max - min;
  const r = Math.random()
  return min + delta * r * r;
}

/**
 * This test verifies that generated contexts return correct values
 * after sources are being removed.
 */
add_task(async function test_fuzzing_sources() {
  try {
    const iterations = 1000;
    const maxSources = 20;
  
    const metasources = ["app", "langpack", ""];
    // const availableLocales = ["en", "en-US", "pl", "en-CA", "es-AR", "es-ES"];
    const availableLocales = ["en"];
  
    const l10nReg = new L10nRegistry();
  
    for (let i = 0; i < iterations; i++) {
      console.log(`!!! Iteration`, i);
      let sourceCount = randomPow(0, maxSources);
  
      const mocks = [];
      const fs = [];
  
      const locales = new Set();
      const filenames = new Set();
  
      for (let j = 0; j < sourceCount; j++) {
        const locale = pickOne(availableLocales);
        locales.add(locale);
  
        let metasource = pickOne(metasources);
        if (metasource === "langpack") {
          metasource = `${metasource}-${locale}`
        }
  
        const dir = generateRandomName();
        const filename = generateRandomName() + j + ".ftl";
        const path = `${dir}/${locale}/${filename}`
  
        filenames.add(filename);
  
        console.log(`!!! fs push`, { path, source: "key = value" });
        fs.push({ path, source: "key = value" });

        mocks.push([
          metasource || "app", // name
          metasource, // metasource,
          [locale], // locales,
          dir + "/{locale}/",
          fs
        ])
      }
  
      l10nReg.registerSources(mocks.map(args => L10nFileSource.createMock(...args)));
  
      const bundles = l10nReg.generateBundles(
        pickN([...locales], random(1, 0)),
        pickN([...filenames], random(1, 0))
      )
  
      function next() {
        const bundle = bundles.next()
        console.log(`!!! Next bundle`, bundle);
        return bundle;
      }
  
      const ops = [
        // Increase the frequency of next being called.
        next,
        next,
        next,
        () => {
          const newMocks = [];
          for (const mock of pickN(mocks, random(0, 3))) {
            const newMock = mock.slice();
            newMock[4][0].source = `key = ${generateRandomName()}`
            newMocks.push(newMock)
          }
          console.log(`!!! l10nReg.updateSources`, newMocks);
          l10nReg.updateSources(newMocks.map(mock => L10nFileSource.createMock(...mock)));
        },
        () => {
          console.log(`!!! l10nReg.clearSources`);
          l10nReg.clearSources();
        }
      ];

      console.log(`!!! Start`);
      while (true) {
        console.log(`!!! next`);
        const op = pickOne(ops);
        const result = await op();
        if (result?.done) {
          // The iterator completed.
          break;
        }
      }

      l10nReg.clearSources();
    }
  } catch (error) {
    console.log(`!!! An error occurred`, error);
    throw error
  }

});
