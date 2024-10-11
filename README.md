# What and Why?
In 1969, we landed people on the moon with just 64KB of memory and a 43KHz CPU, yet in 2024, I can't run a simple Jest suite without maxing out my RAM and CPU, and waiting forever for it to finish.

This package helps you identify Jest's performance bottlenecks and, most importantly, boosts **its performance** right out of the box.

# How to install
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
Put the configuration bellow into `globals` field in the jest config.

## Perfomance boost
**NEAT_RUNTIME_CACHE** `true/false`
Cache the runtime dependencies (treeshaking). Essentialy, this rectifies the issues with barrel files and other non used modules that are needlesly required in your project.
**NEAT_TRANSFORM_CACHE** `true/false`
Better caching optimisation for already transformed module. It'll transform the file and keep the cache in the memory. 
**NEAT_MODULES_WITH_SIDE_EFFECTS** `['module-name', 'lodash']`
List of modules that contains side effects. Modules that modifies global object or do other things that breaks the runtime execution.

## Debugging
**NEAT_DEBUG** `true/false`
In case of failed test, it won't invalidate the cache and rerun the test so you can look at the stack trace and identify the root cause.
**NEAT_REPORT_MODULE** `true/false`
Print the overall module count and the load time.
**NEAT_REPORT_TRANSFORM** `true/false`
Print the table with the information for each file suffix, how many of the files with the respective file extension and how long they took to transform (compile).
**NEAT_REPORT_MODULE_LOAD_ABOVE_MS** `200`
Print the modules that took the "n" amount of milliseconds to load.
**NEAT_REPORT_ONLY_NODE_MODULES** `true/false`
Alongside with `NEAT_REPORT_MODULE_LOAD_ABOVE_MS`. It will print only the modules from the `node_modules` folder.

# Troubleshooting
### Test are still slow
Add `NEAT_DEBUG` into jest config. It'll not invalidate the cache and rerun the test in case of failure. Check the error message and find the module that causes it to fail. Most of the time it's due to the modules that contains side effects (mutating global scopes, ...). When you find the culprit, add the module into the `NEAT_MODULES_WITH_SIDE_EFFECTS` array in the jest config.
### "jest_neat_runner" warning in the console
Follow the steps above.
