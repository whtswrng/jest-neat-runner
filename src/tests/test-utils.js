const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { simpleHash } = require("../utils/utils");

function getCache(filePath) {
  const cachePath = join(__dirname, './.cache', simpleHash(filePath));
  if (existsSync(cachePath)) {
    const fileData = readFileSync(cachePath, "utf-8");
    return fileData;
  } else {
    return undefined;
  }
}

module.exports = {
	getCache
}