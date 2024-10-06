const Runtime = require("jest-runtime");
const fs = require("fs");
const path = require("path");

const whitelistedModules = ["core-js", "dom"];

class NeatRuntime {
  cachedModules = {};
  testPath = "";
  cacheFilePath = "";
  oldCache = undefined;
  dummyModuleCount = 0;
  realModuleCount = 0;
  _runtimeInstance = undefined;
  prevRunFailed = false;
  moduleTimerList = [];

  constructor(_runtimeInstance, prevRunFailed) {
    this.prevRunFailed = prevRunFailed;
    this._runtimeInstance = _runtimeInstance;
    this.testPath = _runtimeInstance._testPath;
    this.cacheFilePath = path.join(_runtimeInstance._config.cacheDirectory, simpleHash(_runtimeInstance._testPath));
    this.wrapRequireModule();

    if (prevRunFailed) {
      console.log("PREV RUN FAILED!");
      fs.writeFileSync(this.cacheFilePath, JSON.stringify({}));
    }

    this.oldCache = this.getOldCache();
    this.cachedModules = { ...this.oldCache };

    // handle finish
    _runtimeInstance.done = () => {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cachedModules));
      this.moduleTimerList.sort((a, b) => b.timeInMs - a.timeInMs);
      for(const m of this.moduleTimerList) {
        console.log(`\x1b[33mFrom ${m.from} -> ${m.module} in ${m.timeInMs}`);
      }
    };
  }

  wrapRequireModule() {
    const orig = this._runtimeInstance.requireModuleOrMock;
    const scope = this;

    this._runtimeInstance.requireModuleOrMock = function (...args) {
      const from = args[0];
      const modulePath = args[1];

      const fullPath = from + modulePath;

      const callOriginal = () => orig.apply(this, args);

      if (scope.shouldSkipLoadingModule(fullPath)) {
        if (whitelistedModules.some((m) => fullPath.includes(m))) {
          scope.realModuleCount++;
          return callOriginal();
        }
        return scope.createEmptyObj(from, modulePath);
      }

      const obj = scope.requireModule(from, modulePath, callOriginal);

      // proxy listen
      if (typeof obj === "object") {
        scope.cachedModules[fullPath] = false;
        const proxy = new Proxy(obj, {
          get(target, prop, receiver) {
            scope.cachedModules[fullPath] = true;
            return Reflect.get(target, prop, receiver);
          },
        });
        return proxy;
      }

      return obj;
    };
  }

  shouldSkipLoadingModule(fullPath) {
    const cache = this.oldCache;
    return cache && cache[fullPath] !== undefined && cache[fullPath] === false;
  }

  requireModule(from, modulePath, originalRequire) {
    const fullModulePath = this._runtimeInstance._resolveCjsModule(from, modulePath);

    const start = Date.now();
    const o = originalRequire();
    const end = Date.now();
    const diff = end-start;

    if(diff > 150 && fullModulePath.includes('node_modules')) this.moduleTimerList.push({from: from, module: modulePath, timeInMs: diff});

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

const WrappedClass = new Proxy(Runtime.default, {
  construct(target, args) {
    const config = args[5];
    const instance = new target(...args);
    const r = new NeatRuntime(instance, config.previousRunFailed);

    return instance;
  },
});

function simpleHash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const fileName = str.split("/").pop();

  return hash.toString() + "_" + fileName;
}

module.exports = WrappedClass;
