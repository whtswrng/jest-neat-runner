const path = require("path");
const { simpleHash } = require("../utils/utils");
const { writeFileSync } = require("fs");
const _runTest = require("./_runTest").default;

let successTests = 0;
let failedTests = 0;

async function runTest(...args) {
  const testFile = args[0];
  const config = args[2];
  const globals = config.globals;

  let obj;
  try {
    obj = await _runTest(...args);
    if (obj.failureMessage && !globals.NEAT_DEBUG) {
      return rerun(config, testFile);
    }
    successTests++;
    return obj;
  } catch (e) {
    if (globals.NEAT_DEBUG) throw e;
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
    return _runTest(...newArgs);
  }
}

async function waitFor(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = runTest;
