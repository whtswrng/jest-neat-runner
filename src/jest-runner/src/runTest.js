/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const { runInContext } = require('node:vm');
const chalk = require('chalk');
const fs = require('graceful-fs');
const sourcemapSupport = require('source-map-support');
const {
  BufferedConsole,
  CustomConsole,
  NullConsole,
  getConsoleOutput,
} = require('@jest/console');
const docblock = require('jest-docblock');
const { formatExecError } = require('jest-message-util');
const LeakDetector = require('jest-leak-detector');
const Resolver = require('jest-resolve');
const {
  ErrorWithStack,
  interopRequireDefault,
  setGlobal,
} = require('jest-util');
const { createScriptTransformer } = require('@jest/transform');
const { resolveTestEnvironment } = require('jest-resolve');

async function runTestInternal(
  path,
  globalConfig,
  projectConfig,
  resolver,
  context,
  sendMessageToJest,
  previousRunFailed = false
) {
  const testSource = fs.readFileSync(path, 'utf8');
  const docblockPragmas = docblock.parse(docblock.extract(testSource));
  const customEnvironment = docblockPragmas['jest-environment'];

  let testEnvironment = projectConfig.testEnvironment;

  if (customEnvironment) {
    if (Array.isArray(customEnvironment)) {
      throw new TypeError(
        `You can only define a single test environment, got "${customEnvironment.join(
          ', '
        )}"`
      );
    }
    testEnvironment = resolveTestEnvironment({
      ...projectConfig,
      requireResolveFunction: (module) => require.resolve(module),
      testEnvironment: customEnvironment,
    });
  }

  const cacheFS = new Map([[path, testSource]]);
  const transformer = await createScriptTransformer(projectConfig, cacheFS);
  const TestEnvironment = await transformer.requireAndTranspileModule(
    testEnvironment
  );
  const testFramework = await transformer.requireAndTranspileModule(
    process.env.JEST_JASMINE === '1'
      ? require.resolve('jest-jasmine2')
      : projectConfig.testRunner
  );
  const Runtime = interopRequireDefault(
    projectConfig.runtime
      ? require(projectConfig.runtime)
      : require('jest-runtime')
  ).default;

  const consoleOut = globalConfig.useStderr ? process.stderr : process.stdout;
  const consoleFormatter = (type, message) =>
    getConsoleOutput(
      BufferedConsole.write([], type, message, 4),
      projectConfig,
      globalConfig
    );

  let testConsole;

  if (globalConfig.silent) {
    testConsole = new NullConsole(consoleOut, consoleOut, consoleFormatter);
  } else if (globalConfig.verbose) {
    testConsole = new CustomConsole(consoleOut, consoleOut, consoleFormatter);
  } else {
    testConsole = new BufferedConsole();
  }

  const docblockEnvironmentOptions =
    docblockPragmas['jest-environment-options'];
  let extraTestEnvironmentOptions;

  if (typeof docblockEnvironmentOptions === 'string') {
    extraTestEnvironmentOptions = JSON.parse(docblockEnvironmentOptions);
  }

  const environment = new TestEnvironment(
    {
      globalConfig,
      projectConfig: extraTestEnvironmentOptions
        ? {
            ...projectConfig,
            testEnvironmentOptions: {
              ...projectConfig.testEnvironmentOptions,
              ...extraTestEnvironmentOptions,
            },
          }
        : projectConfig,
    },
    {
      console: testConsole,
      docblockPragmas,
      testPath: path,
    }
  );

  if (typeof environment.getVmContext !== 'function') {
    console.error(
      `Test environment found at "${testEnvironment}" does not export a "getVmContext" method.`
    );
    process.exit(1);
  }

  const leakDetector = projectConfig.detectLeaks
    ? new LeakDetector(environment)
    : null;

  setGlobal(environment.global, 'console', testConsole);

  const runtime = new Runtime(
    projectConfig,
    environment,
    resolver,
    transformer,
    cacheFS,
    {
      changedFiles: context.changedFiles,
      collectCoverage: globalConfig.collectCoverage,
      collectCoverageFrom: globalConfig.collectCoverageFrom,
      coverageProvider: globalConfig.coverageProvider,
      sourcesRelatedToTestsInChangedFiles:
        context.sourcesRelatedToTestsInChangedFiles,
      previousRunFailed: previousRunFailed,
    },
    path,
    globalConfig
  );

  let isTornDown = false;

  const tearDownEnv = async () => {
    if (!isTornDown) {
      runtime.teardown();
      runInContext(
        "Error.prepareStackTrace = () => '';",
        environment.getVmContext()
      );
      sourcemapSupport.resetRetrieveHandlers();
      await environment.teardown();
      isTornDown = true;
    }
  };

  try {
    await environment.setup();

    let result;
    const collectV8Coverage =
      globalConfig.collectCoverage &&
      globalConfig.coverageProvider === 'v8' &&
      typeof environment.getVmContext === 'function';

    if (collectV8Coverage) {
      await runtime.collectV8Coverage();
    }

    result = await testFramework(
      globalConfig,
      projectConfig,
      environment,
      runtime,
      path,
      sendMessageToJest
    );

    freezeConsole(testConsole, projectConfig);

    if (runtime.done) runtime.done();

    const end = Date.now();
    const testRuntime = end - Date.now();
    result.perfStats = {
      end,
      runtime: testRuntime,
      start: Date.now(),
    };
    result.console = testConsole.getBuffer();
    result.testFilePath = path;
    result.displayName = projectConfig.displayName;

    const coverage = runtime.getAllCoverageInfoCopy();
    if (coverage) {
      const coverageKeys = Object.keys(coverage);
      if (coverageKeys.length > 0) {
        result.coverage = coverage;
      }
    }

    if (collectV8Coverage) {
      const v8Coverage = runtime.getAllV8CoverageInfoCopy();
      if (v8Coverage && v8Coverage.length > 0) {
        result.v8Coverage = v8Coverage;
      }
    }

    if (globalConfig.logHeapUsage) {
      global.gc?.();
      result.memoryUsage = process.memoryUsage().heapUsed;
    }

    await tearDownEnv();
    return { leakDetector, result };
  } finally {
    await tearDownEnv();
  }
}

async function runTest(
  path,
  globalConfig,
  config,
  resolver,
  context,
  sendMessageToJest,
  previousRunFailed = false
) {
  try {
    const { leakDetector, result } = await runTestInternal(
      path,
      globalConfig,
      config,
      resolver,
      context,
      sendMessageToJest,
      previousRunFailed
    );

    if (leakDetector) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      result.leaks = await leakDetector.isLeaking();
    } else {
      result.leaks = false;
    }

    if (result.failureMessage)
      return runTest(
        path,
        globalConfig,
        config,
        resolver,
        context,
        sendMessageToJest,
        true
      );
    return result;
  } catch (e) {
    if (!previousRunFailed) {
      return runTest(
        path,
        globalConfig,
        config,
        resolver,
        context,
        sendMessageToJest,
        true
      );
    }
    throw e;
  }
}

module.exports = runTest;

function freezeConsole(testConsole, config) {
  testConsole._log = function fakeConsolePush(type, message) {
    const error = new ErrorWithStack(
      `${chalk.red(`Cannot log after tests are done. Log "${message}".`)}`,
      fakeConsolePush
    );
    const formattedError = formatExecError(
      error,
      config,
      { noStackTrace: false },
      undefined,
      true
    );
    process.stderr.write(`\n${formattedError}\n`);
    process.exitCode = 1;
  };
}
