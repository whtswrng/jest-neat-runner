const fs = require("fs-extra");
const path = require("path");

(async function () {
  const runnerDir = path.join(__dirname, "node_modules/jest-runner/build");
  const buildDir = path.join(__dirname, "build");
  const jestRunnerBuildDir = path.join(__dirname, "build", "runner");
  const sourceDir = path.join(__dirname, "src");

  // copy runner
  await fs.remove(buildDir);
  await fs.copy(runnerDir, jestRunnerBuildDir);
  await fs.move(path.join(jestRunnerBuildDir, "runTest.js"), path.join(jestRunnerBuildDir, "_runTest.js"));
  await fs.copy(path.join(sourceDir, "runner", "runTest.js"), path.join(jestRunnerBuildDir, "runTest.js"));

  // copy runtime
  await fs.copy(path.join(sourceDir, "runtime"), path.join(buildDir, "runtime"));

  console.log("Files copied and runTest renamed to baseRunTest.");
})();
