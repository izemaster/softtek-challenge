const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  preset: '@shelf/jest-dynamodb',
  transform: {
    ...tsJestTransformCfg,
  },
};