const { readFileSync } = require("fs");
const { simpleHash } = require("../../utils/utils");
const { a } = require("./root");
const { join } = require("path");
const { getCache } = require("../test-utils");

test("treeshaking should work - a is accessed and b is omited", () => {
  expect(a.prop).toBeDefined();

  const c = getCache(__filename);
  if (c) {
    expect(c.includes("/a.js")).toBe(false);
    expect(c.includes("/b.js")).toBe(true);
  }
});
