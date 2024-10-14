const fs = require("fs-extra");
const path = require("path");

(async function () {
  const nodeModulesRunnerDir = path.join(__dirname, "node_modules/jest-runner/build");
  const buildDir = path.join(__dirname, "build");
  const jestRunnerBuildDir = path.join(__dirname, "build", "runner");
  const sourceDir = path.join(__dirname, "src");

  // copy runner
  await fs.remove(buildDir);
  await fs.copy(nodeModulesRunnerDir, jestRunnerBuildDir);
  // copy src
  await fs.copy(sourceDir, buildDir);
  await fs.copy(path.join(nodeModulesRunnerDir, "runTest.js"), path.join(jestRunnerBuildDir, "_runTest.js"));

  console.log("Files copied and runTest renamed to baseRunTest.");
})();
