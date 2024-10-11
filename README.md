# What and Why?
In 1969, we landed people on the moon with just 64KB of memory and a 43KHz CPU, yet in 2024, I can't run a simple Jest suite without maxing out my RAM and CPU, and waiting forever for it to finish.

This package helps you identify Jest's performance bottlenecks and, most importantly, boosts **its performance** right out of the box.

# How to install
This package supports `jest@29.x.x`.

1. `npm i jest-neat-runner`
2. Make following changes in your `jest.config.js` file
```
module.exports = {
  globals: {
    NEAT_RUNTIME_CACHE: true,
    NEAT_TRANSFORM_CACHE: true,
  },
  runner: './node_modules/jest-neat-runner/build/runner',
  runtime: './node_modules/jest-neat-runner/build/runtime'
};
```

That's it!

The first run will be slightly faster, but the real power of this library kicks in during subsequent runs, as it utilizes the created runtime cache.

# Features
Put the configuration below into the `globals` field in the Jest config.

## Performance Boost
**NEAT_RUNTIME_CACHE** `true/false`  
Caches runtime dependencies (tree-shaking). This resolves issues with barrel files and other unused modules that are unnecessarily loaded in your project.

**NEAT_TRANSFORM_CACHE** `true/false`  
Improves caching optimization for already transformed modules. It transforms the file and keeps the cache in memory.

**NEAT_MODULES_WITH_SIDE_EFFECTS** `['module-name', 'lodash']`  
List of modules that contain side effects, such as modifying global objects or other actions that break runtime execution.

## Debugging
**NEAT_DEBUG** `true/false`  
Prevents cache invalidation on a failed test, allowing you to rerun the test, check the stack trace, and identify the root cause.

**NEAT_REPORT_MODULE** `true/false`  
Prints the total module count and load times.

**NEAT_REPORT_TRANSFORM** `true/false`  
Prints a table with information for each file suffix, showing the number of files with each extension and how long they took to transform (compile).

**NEAT_REPORT_MODULE_LOAD_ABOVE_MS** `200`  
Prints modules that took longer than the specified number of milliseconds to load.

**NEAT_REPORT_ONLY_NODE_MODULES** `true/false`  
Works alongside `NEAT_REPORT_MODULE_LOAD_ABOVE_MS` to print only the modules from the `node_modules` folder.

# Troubleshooting
### Tests Are Still Slow
Add `NEAT_DEBUG` to the Jest config. This will prevent cache invalidation and it won't rerun the test in case of failure. Check the error message to identify the module causing the failure. Most of the time, it’s due to modules that contain side effects (e.g., mutating global scopes). When you find the culprit, add it to the `NEAT_MODULES_WITH_SIDE_EFFECTS` array in the Jest config's `globals` field.

### "jest_neat_runner" Warning in the Console
Follow the steps mentioned above.

# Production Readiness
Both the runner and runtime are not drop-in replacements for the original ones. Instead, they decorate the original `jest-runner` and `jest-runtime`. With a bit of luck, no breaking changes are expected.