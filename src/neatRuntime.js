const Runtime = require('jest-runtime');
const fs = require('fs');
const path = require('path');

const whitelistedModules = ['core-js', 'dom'];

class NeatRuntime {
  cachedModules = {};
  testPath = '';
  cacheFilePath = '';
  oldCache = undefined;
  dummyModuleCount = 0;
  realModuleCount = 0;
  _runtimeInstance = undefined;
  prevRunFailed = false;

  constructor(_runtimeInstance, prevRunFailed) {
    const scope = this;
    this.prevRunFailed = prevRunFailed;
    this._runtimeInstance = _runtimeInstance;
    this.testPath = _runtimeInstance._testPath;
    this.cacheFilePath = path.join(
      _runtimeInstance._config.cacheDirectory,
      simpleHash(_runtimeInstance._testPath)
    );
    this.wrapRequireModule();

    if (prevRunFailed) {
      console.log('PREV RUN FAILED!');
      fs.writeFileSync(this.cacheFilePath, JSON.stringify({}));
    }

    this.oldCache = this.getOldCache();
    this.cachedModules = { ...this.oldCache };

    // handle finish
    _runtimeInstance.done = () => {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cachedModules));
    };
  }

  wrapRequireModule() {
    const orig = this._runtimeInstance.requireModuleOrMock;
    const scope = this;

    this._runtimeInstance.requireModuleOrMock = function (...args) {
      const from = args[0];
      const modulePath = args[1];

      const fullPath = from + modulePath;
      const cache = scope.oldCache;

      if (cache && cache[fullPath] !== undefined && cache[fullPath] === false) {
        if (whitelistedModules.some((m) => fullPath.includes(m))) {
          scope.realModuleCount++;
          return callOriginal.call(this);
        }
        return scope.createCircularEmptyObj(from, modulePath);
      }

      const fullModulePath = scope._runtimeInstance._resolveCjsModule(
        from,
        modulePath
      );

      // actual require!
      const obj = callOriginal.call(this);

      // actual require!
      // const obj = fullModulePath.includes('react')
      //   ? require(fullModulePath)
      //   : callOriginal.call(this);

      if (typeof obj === 'object') {
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

      function callOriginal() {
        scope.realModuleCount++;
        return orig.apply(this, args);
      }
    };
  }

  getOldCache() {
    let cache = undefined;
    try {
      const c = fs.readFileSync(this.cacheFilePath);
      cache = JSON.parse(c);
    } catch (e) {}
    return cache;
  }

  createCircularEmptyObj(from, modulePath) {
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

  const fileName = str.split('/').pop();

  return hash.toString() + '_' + fileName;
}

module.exports = WrappedClass;
