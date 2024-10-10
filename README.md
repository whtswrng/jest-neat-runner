## What and Why?
We were able to get people on the moon with 64KB of memory and 43KHz CPU, and yet in 2024, I'm not able to run simple jest suite without burning all my RAM and CPU and waiting for an eternity for them to finish. This package should help you with identifying your jest's performance bottlenecks and most importantly **boost jest's performance**.

## How does it work?

## How to install
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

Enjoy!

## Features

### Perfomance boost
```
NEAT_RUNTIME_CACHE: bool,
NEAT_TRANSFORM_CACHE: bool,
NEAT_MODULES_WITH_SIDE_EFFECTS: Array<string>,
```
### Debugging
```
NEAT_REPORT_MODULE: bool,
NEAT_REPORT_TRANSFORM: bool,
NEAT_REPORT_MODULE_LOAD_ABOVE_MS: number,
NEAT_REPORT_ONLY_NODE_MODULES: bool,
```


For years I've been dissapointed with jest performance. We 