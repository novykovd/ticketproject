/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    // Strip .js extensions from imports so Jest can resolve .ts files
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
