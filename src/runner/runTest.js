const _runTest = require("./_runTest").default;
const path = require("path");

let successTests = 0;
let failedTests = 0;

const memoryLimitInGb = 0.1;
const cpuLimitInPerc = 10;

async function runTest(...args) {
  // const memoryUsage = getMemoryUsage();
  // const memoryPerc = memoryUsage.memoryUsagePercentage;
  // const memoryLeftGb = memoryUsage.totalMemory - memoryUsage.usedMemory;
  // const cpuLoadPerc = getCpuLoad();

  // if(100-cpuLoadPerc <= cpuLimitInPerc || memoryLeftGb <= memoryLimitInGb) {
  //   await waitFor(20);
  //   return runTest(...args);
  // }

  // console.log("Memory Left:", memoryLeftGb);
  // console.log("Overall CPU Load:", getCpuLoad(), "%");

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

async function waitFor(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const os = require("os");

// Function to get overall CPU load
function getCpuLoad() {
  const cpus = os.cpus();

  let userTime = 0;
  let niceTime = 0;
  let sysTime = 0;
  let idleTime = 0;
  let irqTime = 0;

  cpus.forEach((cpu) => {
    userTime += cpu.times.user;
    niceTime += cpu.times.nice;
    sysTime += cpu.times.sys;
    idleTime += cpu.times.idle;
    irqTime += cpu.times.irq;
  });

  const totalTime = userTime + niceTime + sysTime + idleTime + irqTime;
  const loadTime = totalTime - idleTime;

  const loadPercentage = (loadTime / totalTime) * 100;
  return loadPercentage.toFixed(2);
}

function getMemoryUsage() {
  const totalMemory = os.totalmem(); // Total system memory in bytes
  const freeMemory = os.freemem(); // Free system memory in bytes

  const usedMemory = totalMemory - freeMemory; // Used memory in bytes
  const memoryUsagePercentage = (usedMemory / totalMemory) * 100;

  return {
    totalMemory: (totalMemory / (1024 * 1024 * 1024)).toFixed(2), // Convert to GB
    usedMemory: (usedMemory / (1024 * 1024 * 1024)).toFixed(2), // Convert to GB
    memoryUsagePercentage: memoryUsagePercentage.toFixed(2), // Memory usage percentage
  };
}

module.exports = runTest;
