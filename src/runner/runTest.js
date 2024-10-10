const _runTest = require("./_runTest").default;
const path = require("path");

async function runTest(...args) {
  const testFile = args[0];
  const config = args[2];
  const globals = config.globals;

  try {
    const obj = await _runTest(...args);
    return obj;
  } catch (e) {
    if (globals.NEAT_DEBUG) throw e;
    return rerun();
  }

  function rerun() {
    // run it again in case it failed
    global._NEAT_REMOVE_CACHE = testFile;
    return _runTest(...args);
  }
}

module.exports = runTest;
