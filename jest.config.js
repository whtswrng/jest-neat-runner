module.exports = {
  globals: {
    NEAT_DEBUG: true,
    NEAT_RUNTIME_CACHE: true,
    NEAT_TRANSFORM_CACHE: true,
    NEAT_REPORT_MODULE_LOAD_ABOVE_MS: 150
  },
  runner: "./build/runner",
  runtime: "./build/runtime",
  cacheDirectory: "./src/tests/.cache",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  moduleFileExtensions: ["js", "jsx"],
  testPathIgnorePatterns: ["./src/tests/.cache"]
};
