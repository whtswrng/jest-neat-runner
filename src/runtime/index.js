const Runtime = require("jest-runtime");
const fs = require("fs");
const path = require("path");

const globalModulesWithSideEffects = ["i18n"];

const NEAT_CONFIG = {
  NEAT_DEBUG: "NEAT_DEBUG",
  NEAT_RUNTIME_CACHE: "NEAT_RUNTIME_CACHE",
  NEAT_TRANSFORM_CACHE: "NEAT_TRANSFORM_CACHE",
  NEAT_REPORT_MODULE: "NEAT_REPORT_MODULE",
  NEAT_REPORT_TRANSFORM: "NEAT_REPORT_TRANSFORM",
  NEAT_REPORT_MODULE_LOAD_ABOVE_MS: "NEAT_REPORT_MODULE_LOAD_ABOVE_MS",
  NEAT_REPORT_ONLY_NODE_MODULES: "NEAT_REPORT_ONLY_NODE_MODULES",
  NEAT_MODULES_WITH_SIDE_EFFECTS: "NEAT_MODULES_WITH_SIDE_EFFECTS",
  // NEAT_NODE_REQUIRE_MODULES: "NEAT_NODE_REQUIRE_MODULES",
  // NEAT_VERBOSE: "NEAT_VERBOSE",
  // NEAT_BENCHMARK: "NEAT_BENCHMARK",
};

const transformedFilesCache = new Map();

class NeatRuntime {
  cachedModules = { __modulesWithSideEffects: [] };
  testPath = "";
  cacheFilePath = "";
  oldCache = undefined;
  dummyModuleCount = 0;
  realModuleCount = 0;
  _runtimeInstance = undefined;
  prevRunFailed = false;
  moduleTimerList = [];
  globals = undefined;
  currentProcessingNodeModule = false;
  transformedFileExtensions = new Map();
  loadedModulesReports = new Map();
  processedModules = new Map();

  constructor(_runtimeInstance, prevRunFailed) {
    const scope = this;

    this.prevRunFailed = prevRunFailed;
    this._runtimeInstance = _runtimeInstance;
    this.testPath = _runtimeInstance._testPath;
    this.globals = _runtimeInstance._config.globals;
    this.cacheFilePath = path.join(_runtimeInstance._config.cacheDirectory, simpleHash(_runtimeInstance._testPath));
    this.isTransformReportOn = this.globals[NEAT_CONFIG.NEAT_REPORT_TRANSFORM];
    this.isTransformCacheOn = this.globals[NEAT_CONFIG.NEAT_TRANSFORM_CACHE];
    this.isModuleReportOn = this.globals[NEAT_CONFIG.NEAT_REPORT_MODULE];
    this.isRuntimeCacheOn = this.globals[NEAT_CONFIG.NEAT_RUNTIME_CACHE];
    this.reportInMs = this.globals[NEAT_CONFIG.NEAT_REPORT_MODULE_LOAD_ABOVE_MS];
    this.modulesWithSideEffects = this.globals[NEAT_CONFIG.NEAT_MODULES_WITH_SIDE_EFFECTS] ?? [];

    if (global._NEAT_REMOVE_CACHE) {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify({}));
    }

    this.oldCache = this.getOldCache();
    this.cachedModules = { ...this.oldCache };

    this.wrapRequireModule();
    this.wrapTransformFile();

    const origTeardown = _runtimeInstance.teardown;
    _runtimeInstance.teardown = function (...args) {
      scope.done();
      return origTeardown.apply(this, args);
    };
  }

  done() {
    fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cachedModules));
    if (this.reportInMs) {
      this.moduleTimerList.sort((a, b) => b.timeInMs - a.timeInMs);
      for (const m of this.moduleTimerList) {
        if (NEAT_CONFIG.NEAT_REPORT_ONLY_NODE_MODULES && m.module.includes("./")) continue;
        console.log(`\x1b[33mFrom ${m.from} -> ${m.module} in ${m.timeInMs}ms`);
      }
      console.log(`Skipped ${this.dummyModuleCount} modules`);
    }

    if (this.isTransformReportOn) {
      console.log(`📄 Files transformed 📄`);
      console.table(this.transformedFileExtensions);
    }

    if (this.isModuleReportOn) {
      console.log(`📦 MODULE LOAD REPORT 📦`);
      console.table(this.loadedModulesReports);
    }
  }

  wrapTransformFile() {
    const orig = this._runtimeInstance.transformFile;
    const scope = this;
    this._runtimeInstance.transformFile = function (...args) {
      const filePath = args[0];
      const cachedF = transformedFilesCache.get(filePath);

      const start = Date.now();
      const r = cachedF && scope.isTransformCacheOn ? transformedFilesCache.get(filePath) : orig.apply(this, args);
      const end = Date.now();

      scope.storeModuleWithSideEffects(filePath, r);

      const fileExtension = path.extname(filePath);
      transformedFilesCache.set(filePath, r);

      const fileExtensionReport = scope.transformedFileExtensions.get(fileExtension);
      scope.transformedFileExtensions.set(fileExtension, {
        count: (fileExtensionReport?.count ?? 0) + 1,
        timeInMs: (fileExtensionReport?.timeInMs ?? 0) + (end - start),
      });
      return r;
    };
  }

  wrapRequireModule() {
    const modulesWithSideEffects = [...globalModulesWithSideEffects, ...this.getModulesWithSideEffects(), ...this.modulesWithSideEffects];
    const orig = this._runtimeInstance.requireModuleOrMock;
    const scope = this;

    this._runtimeInstance.requireModuleOrMock = function (...args) {
      const from = args[0];
      const modulePath = args[1];

      const fullPath = scope._runtimeInstance._resolveCjsModule(from, modulePath);

      const callOriginal = () => orig.apply(this, args);

      if (scope.isRuntimeCacheOn && scope.shouldSkipLoadingModule(fullPath)) {
        if (modulesWithSideEffects.some((m) => fullPath.includes(m))) {
          // these modules have side-effects, we need to load them
          return callOriginal();
        }
        return scope.createEmptyObj(from, modulePath);
      }

      // TODO
      // const nodeRequireModules = scope.globals[NEAT_CONFIG.NEAT_NODE_REQUIRE_MODULES] ?? [];
      // let loadedModule;

      // if (nodeRequireModules.length > 0) {
      //   const p = scope._runtimeInstance._resolveCjsModule(from, modulePath);
      //   if (nodeRequireModules.some((m) => p.includes(m))) {
      //     const start = Date.now();
      //     if (!scope.currentProcessingNodeModule) scope.currentProcessingNodeModule = p;
      //     loadedModule = require(p);
      //     const end = Date.now();
      //     if (scope.currentProcessingNodeModule === p && scope.globals[NEAT_CONFIG.NEAT_VERBOSE]) {
      //       console.log(`\x1b[32mModule ${p} was loaded via "Node" require in ${end - start}ms`);
      //       if (scope.globals[NEAT_CONFIG.NEAT_BENCHMARK]) {
      //         const endInMs = scope.doBenchmarkLoad(callOriginal);
      //         console.log(`\x1b[31mModule ${p} was loaded via "jest" require in ${endInMs}ms`);
      //       }
      //     }
      //   }
      // }

      const loadedModule = scope.requireModule(from, modulePath, callOriginal);

      // proxy listen
      if (typeof loadedModule === "object") {
        if (scope.cachedModules[fullPath] === undefined) scope.cachedModules[fullPath] = false;
        const proxy = new Proxy(loadedModule, {
          get(target, prop, receiver) {
            // property was visited!
            scope.cachedModules[fullPath] = undefined;
            return Reflect.get(target, prop, receiver);
          },
        });
        return proxy;
      }

      return loadedModule;
    };
  }

  getModulesWithSideEffects() {
    return this.cachedModules.__modulesWithSideEffects ?? [];
  }

  shouldSkipLoadingModule(fullPath) {
    const cache = this.oldCache;
    return cache && cache[fullPath] !== undefined && cache[fullPath] === false;
  }

  doBenchmarkLoad(originalCall) {
    const start = Date.now();
    originalCall();
    const end = Date.now();
    return end - start;
  }

  storeModuleWithSideEffects(filePath, fileContent) {
    const jestMatchers = /expect\.extend\(/;

    if (fileContent.match(jestMatchers)) return this.addModuleWithSideEffectsToCache(filePath);
    if (fileContent.match(/module.exports = require\(.+\)\./)) {
      return this.addModuleWithSideEffectsToCache(filePath);
    }
  }

  addModuleWithSideEffectsToCache(filePath) {
    const library = getLibraryName(filePath);
    if (!this.cachedModules.__modulesWithSideEffects) this.cachedModules.__modulesWithSideEffects = [];
    if (this.getModulesWithSideEffects().includes(library)) return;

    this.cachedModules.__modulesWithSideEffects.push(getLibraryName(filePath));
  }

  requireModule(from, modulePath, originalRequire) {
    const fullModulePath = this._runtimeInstance._resolveCjsModule(from, modulePath);

    const start = Date.now();
    const o = originalRequire();
    const end = Date.now();
    const diff = end - start;

    // check if we're processing a node_module
    if (this.isModuleReportOn && !modulePath.includes("./") && !this.processedModules.has(modulePath)) {
      this.processedModules.set(modulePath, true);
      const origin = "node_modules";
      const report = this.loadedModulesReports.get(origin);
      this.loadedModulesReports.set(origin, {
        count: (report?.count ?? 0) + 1,
        timeInMs: (report?.timeInMs ?? 0) + diff,
      });
    }

    if (diff > (this.reportInMs ?? 300) && fullModulePath.includes("node_modules"))
      this.moduleTimerList.push({ from: from, module: modulePath, timeInMs: diff });

    return o;
  }

  getOldCache() {
    let cache = undefined;
    try {
      const c = fs.readFileSync(this.cacheFilePath);
      cache = JSON.parse(c);
    } catch (e) {}
    return cache;
  }

  createEmptyObj(from, modulePath) {
    this.dummyModuleCount++;
    return {};
  }
}

function simpleHash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const fileName = str.split("/").pop();

  return hash.toString() + "_" + fileName;
}

function getLibraryName(filePath) {
  const regexPnpm = /\/.pnpm\/(.+)\/node_modules/;
  const regexNpm = /\/node_modules\/(.+)\//;

  const matchPnpm = filePath.match(regexPnpm);
  if (matchPnpm) {
    return `${matchPnpm[1]}`;
  }

  const matchNpm = filePath.match(regexNpm);
  if (matchNpm) {
    return matchNpm[1];
  }

  return null;
}

const WrappedClass = new Proxy(Runtime.default, {
  construct(target, args) {
    const config = args[5];
    const instance = new target(...args);
    const r = new NeatRuntime(instance, config.previousRunFailed);

    return instance;
  },
});

module.exports = WrappedClass;
