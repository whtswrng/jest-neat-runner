const path = require("path");
const { simpleHash } = require("../utils/utils");
const { writeFileSync } = require("fs");
const _runTest = require("./_runTest").default;

let successTests = 0;
let failedTests = 0;
let doneTimeout = undefined;
global._NEAT_CACHE_HIT_COUNT = 0;
global._NODE_MODULES_SKIPPED = 0;
global._SRC_MODULES_SKIPPED = 0;

async function runTest(...args) {
  const testFile = args[0];
  const config = args[2];
  const globals = config.globals;
  clearTimeout(doneTimeout);

  let obj;
  try {
    obj = await _runTest(...args);
    if (obj.failureMessage && !globals.NEAT_DEBUG) {
      return rerun(config, testFile);
    }
    successTests++;
    doneTimeout = setTimeout(done, 100);
    return obj;
  } catch (e) {
    if (globals.NEAT_DEBUG) {
      doneTimeout = setTimeout(done, 100);
      failedTests++;
      throw e;
    }
    return rerun(config, testFile);
  }

  async function rerun(config, testPath, count = 3) {
    failedTests++;

    const total = failedTests + successTests;
    const failPercentage = Math.round((failedTests / successTests) * 100);
    if (total > 7 && failPercentage > 40) {
      console.warn(
        `\x1b[33mjest_neat_runner: If this message appears repeatedly after multiple runs, it indicates that the runtime cache might not function properly as many tests failed at the first run, causing Jest to run more slowly. To resolve the issue, please visit the troubleshooting section at: https://github.com/whtswrng/jest-neat-runner?tab=readme-ov-file#troubleshooting.`
      );
    }

    const cacheFilePath = path.join(config.cacheDirectory, simpleHash(testPath));
    writeFileSync(cacheFilePath, JSON.stringify({}));

    const newArgs = [...args];
    const o = await _runTest(...newArgs);
    doneTimeout = setTimeout(done, 100);
    return o;
  }
}

function done() {
  console.log(
    ` 📢 Jest run done: ${successTests}/${
      successTests + failedTests
    } suites passed on the first run. 
    Used neat cache for ${global._NEAT_CACHE_HIT_COUNT} file(s).
    Node modules skipped: ${global._NODE_MODULES_SKIPPED}.
    Source modules skipped: ${global._SRC_MODULES_SKIPPED}.
    `
  );
}

async function waitFor(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = runTest;
