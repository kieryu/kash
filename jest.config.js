const preset = require('jest-expo/jest-preset');

// @noble/* ships ESM only, so let Babel transform it too.
const transformIgnorePatterns = [
  preset.transformIgnorePatterns[0].replace('(?!(', '(?!(@noble|'),
  ...preset.transformIgnorePatterns.slice(1),
];

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Pure TypeScript (engine, domain rules, tokens, DB via node:sqlite): plain Node, fast.
      displayName: 'logic',
      preset: 'jest-expo',
      testEnvironment: 'node',
      transformIgnorePatterns,
      testMatch: ['**/src/(engine|domain|theme|db|data|backup|notifications)/**/*.test.ts'],
    },
    {
      // Anything touching React Native or Expo modules.
      displayName: 'app',
      preset: 'jest-expo',
      transformIgnorePatterns,
      testMatch: ['**/src/**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', '/src/(engine|domain|theme|db|data|backup|notifications)/'],
    },
  ],
};
