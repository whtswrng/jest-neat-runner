const _runTest = require("./_runTest").default;

let successTests = 0;
let failedTests = 0;

async function runTest(...args) {
  const testFile = args[0];
  const config = args[2];
  const globals = config.globals;

  try {
    const obj = await _runTest(...args);
    if (obj.failureMessage && !globals.NEAT_DEBUG) return rerun();
    successTests++;
    if (global.gc) global.gc();
    return obj;
  } catch (e) {
    if (globals.NEAT_DEBUG) throw e;
    return rerun();
  }

  function rerun() {
    if (global.gc) global.gc();
    failedTests++;

    const total = failedTests + successTests;
    const failPercentage = Math.round((failedTests / successTests) * 100);
    if (total > 7 && failPercentage > 40) {
      console.warn(
        `\x1b[33mjest_neat_runner: If this message appears repeatedly after multiple runs, it indicates that the runtime cache is not functioning properly, causing Jest to run more slowly. To resolve the issue, please visit the troubleshooting section at: https://github.com/whtswrng/jest-neat-runner?tab=readme-ov-file#troubleshooting.`
      );
    }

    // run it again in case it failed
    global._NEAT_REMOVE_CACHE = testFile;
    return _runTest(...args);
  }
}

module.exports = runTest;
