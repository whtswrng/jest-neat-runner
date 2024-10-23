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
### NEAT_RUNTIME_CACHE `true/false`  
It tracks the real runtime usage of all modules (per test file) and stores dependencies that we do not need for subsequent test runs. This significantly improves the performance speed.

**Example**

We have a utils file like this
```
import _ from 'lodash';
import moment from 'moment';
import * as mui from '@mui/material';

export const deepClone = (obj) => _.cloneDeep(obj);
export const getFormattedDate = (date) => moment(date).format('YYYY-MM-DD');
export const isButton = (instance) => instance === mui.Button;
```
And we write a test for "deepClone"
```
import { deepClone } from "./utils";

test("deep clone works", () => {
  const obj = {foo: 1};
  expect(deepClone(obj)).not.toBe(obj);
});
```
When running the test for the second time, it is significantly faster as it utilizes the neat cache that contains all the dependencies that were not used during the runtime. The output looks like this. 
```
PASS  src/tests/deep-clone.test.js
  √ deep clone works (33 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.29 s
Ran all test suites matching /src\\tests/i.
 📢 Jest run done: 1/1 suites passed on the first run. 
    Used neat cache for 1 file(s).
    Node modules skipped: 26.
    Source modules skipped: 0.
```
By omitting large modules like mui and date-fns in subsequent test runs, performance improved by 100%. Make sure to store the jest's cache directory on the CI if you want to improve your pipeline's performance. 


**Caveat**: I've tested it on couple of small projects and one enterprise (more than 2500 tests suites) and it worked. That being said, it will not work correctly when you depend on modules that mutates the global state. These modules need to be explicitly stated in the "NEAT_MODULES_WITH_SIDE_EFFECTS" list, otherwise it'll not work.
### NEAT_TRANSFORM_CACHE `true/false`  
Improves caching optimization for already transformed modules. It transforms the file and keeps the cache in memory.

### NEAT_MODULES_WITH_SIDE_EFFECTS `['module-name', 'lodash']`  
List of modules that contain side effects, such as modifying global objects or other actions that break runtime execution.

## Debugging
**NEAT_DEBUG** `true/false`  
Prevents cache invalidation on a failed test, allowing you to rerun the test, check the stack trace, and identify the root cause.

**NEAT_REPORT_MODULE** `true/false`  
Prints the total module count and load times.
```
📦 MODULE LOAD REPORT 📦
┌───────────────────┬────────────────┬─────────────────────────────────┐
│ (iteration index) │      Key       │             Values              │
├───────────────────┼────────────────┼─────────────────────────────────┤
│         0         │ 'node_modules' │ { count: 117, timeInMs: 11853 } │
└───────────────────┴────────────────┴─────────────────────────────────┘
```

**NEAT_REPORT_TRANSFORM** `true/false`  
Showing the number of files with each extension and how long they took to transform (compile). This is handy when deciding if it makes sense to switch the transpiler (SWC, esbuild, ...).
```
📄 Files transformed 📄
┌───────────────────┬────────┬─────────────────────────────────┐
│ (iteration index) │  Key   │             Values              │
├───────────────────┼────────┼─────────────────────────────────┤
│         0         │ '.js'  │ { count: 1371, timeInMs: 1409 } │
│         1         │ '.cjs' │    { count: 1, timeInMs: 1 }    │
└───────────────────┴────────┴─────────────────────────────────┘
```

**NEAT_REPORT_MODULE_LOAD_ABOVE_MS** `200`  
Prints modules that took longer than the specified number of milliseconds to load.
```
> jest src/tests/react-app/

From src\tests\react-app\utils.js -> @mui/material in 1759ms
From node_modules\@mui\material\node\styles\adaptV4Theme.js -> @mui/system in 509ms
From src\tests\react-app\react-app.test.js -> @testing-library/react in 317ms
From node_modules\@testing-library\react\dist\pure.js -> @testing-library/dom in 266ms
From node_modules\@mui\system\ThemeProvider\ThemeProvider.js -> @mui/private-theming in 166ms
From node_modules\@testing-library\dom\dist\role-helpers.js -> aria-query in 161ms
```

**NEAT_REPORT_ONLY_NODE_MODULES** `true/false`  
Works alongside `NEAT_REPORT_MODULE_LOAD_ABOVE_MS` to print only the modules from the `node_modules` folder.

# Troubleshooting
### Tests Are Still Slow
Add `NEAT_DEBUG` to the Jest config. This will prevent cache invalidation and it won't rerun the test in case of failure. Check the error message to identify the module causing the failure. Most of the time, it’s due to modules that contain side effects (e.g., mutating global scopes). When you find the culprit, add it to the `NEAT_MODULES_WITH_SIDE_EFFECTS` array in the Jest config's `globals` field.

### "jest_neat_runner" Warning in the Console
Follow the steps mentioned above.

# Production Readiness
Both the runner and runtime are not drop-in replacements for the original ones. Instead, they decorate the original `jest-runner` and `jest-runtime`. With a bit of luck, no breaking changes are expected.
