/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const chalk = require('chalk');
const Emittery = require('emittery');
const pLimit = require('p-limit');
const { deepCyclicCopy } = require('jest-util');
const runTest = require('./runTest');
const { Worker } = require('jest-worker');
const {
  EmittingTestRunner,
  CallbackTestRunner,
  EmittingTestRunnerInterface,
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  TestRunnerContext,
  TestRunnerOptions,
  JestTestRunner,
  UnsubscribeFn,
} = require('./types');


class TestRunner extends EmittingTestRunner {
  #eventEmitter = new Emittery();

  async runTests(tests, watcher, options) {
    return options.serial
      ? this.#createInBandTestRun(tests, watcher)
      : this.#createParallelTestRun(tests, watcher);
  }

  async #createInBandTestRun(tests, watcher) {
    process.env.JEST_WORKER_ID = '1';
    const mutex = pLimit(1);
    return tests.reduce(
      (promise, test) =>
        mutex(() =>
          promise
            .then(async () => {
              if (watcher.isInterrupted()) {
                throw new CancelRun();
              }

              await this.#eventEmitter.emit('test-file-start', [test]);

              console.log('in band run!');
              return runTest(
                test.path,
                this._globalConfig,
                test.context.config,
                test.context.resolver,
                this._context,
                this.#sendMessageToJest,
              );
            })
            .then(
              result =>
                this.#eventEmitter.emit('test-file-success', [test, result]),
              error =>
                this.#eventEmitter.emit('test-file-failure', [test, error]),
            ),
        ),
      Promise.resolve(),
    );
  }

  async #createParallelTestRun(tests, watcher) {
    const resolvers = new Map();
    for (const test of tests) {
      if (!resolvers.has(test.context.config.id)) {
        resolvers.set(test.context.config.id, {
          config: test.context.config,
          serializableModuleMap: test.context.moduleMap.toJSON(),
        });
      }
    }

    const worker = new Worker(require.resolve('./testWorker'), {
      enableWorkerThreads: this._globalConfig.workerThreads,
      exposedMethods: ['worker'],
      forkOptions: { serialization: 'json', stdio: 'pipe' },
      idleMemoryLimit:
        typeof this._globalConfig.workerIdleMemoryLimit === 'number'
          ? this._globalConfig.workerIdleMemoryLimit
          : undefined,
      maxRetries: 3,
      numWorkers: this._globalConfig.maxWorkers,
      setupArgs: [{ serializableResolvers: [...resolvers.values()] }],
    });

    if (worker.getStdout()) worker.getStdout().pipe(process.stdout);
    if (worker.getStderr()) worker.getStderr().pipe(process.stderr);

    const mutex = pLimit(this._globalConfig.maxWorkers);

    const runTestInWorker = (test) =>
      mutex(async () => {
        if (watcher.isInterrupted()) {
          throw new Error();
        }

        await this.#eventEmitter.emit('test-file-start', [test]);

        const promise = worker.worker({
          config: test.context.config,
          context: {
            ...this._context,
            changedFiles: this._context.changedFiles && [
              ...this._context.changedFiles,
            ],
            sourcesRelatedToTestsInChangedFiles: this._context
              .sourcesRelatedToTestsInChangedFiles && [
              ...this._context.sourcesRelatedToTestsInChangedFiles,
            ],
          },
          globalConfig: this._globalConfig,
          path: test.path,
        });

        if (promise.UNSTABLE_onCustomMessage) {
          promise.UNSTABLE_onCustomMessage(([event, payload]) =>
            this.#eventEmitter.emit(event, payload),
          );
        }

        return promise;
      });

    const onInterrupt = new Promise((_resolve, reject) => {
      watcher.on('change', (state) => {
        if (state.interrupted) {
          reject(new CancelRun());
        }
      });
    });

    const runAllTests = Promise.all(
      tests.map((test) =>
        runTestInWorker(test).then(
          (result) =>
            this.#eventEmitter.emit('test-file-success', [test, result]),
          (error) =>
            this.#eventEmitter.emit('test-file-failure', [test, error]),
        ),
      ),
    );

    const cleanup = async () => {
      const { forceExited } = await worker.end();
      if (forceExited) {
        console.error(
          chalk.yellow(
            'A worker process has failed to exit gracefully and has been force exited. ' +
              'This is likely caused by tests leaking due to improper teardown. ' +
              'Try running with --detectOpenHandles to find leaks. ' +
              'Active timers can also cause this, ensure that .unref() was called on them.',
          ),
        );
      }
    };

    return Promise.race([runAllTests, onInterrupt]).then(cleanup, cleanup);
  }

  on(eventName, listener) {
    return this.#eventEmitter.on(eventName, listener);
  }

  #sendMessageToJest = async (eventName, args) => {
    await this.#eventEmitter.emit(
      eventName,
      deepCyclicCopy(args, { keepPrototype: false }),
    );
  };
}

class CancelRun extends Error {
  constructor(message) {
    super(message);
    this.name = 'CancelRun';
  }
}

module.exports = TestRunner;