/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Pure TypeScript (engine, domain rules, tokens, DB via node:sqlite): plain Node, fast.
      displayName: 'logic',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['**/src/(engine|domain|theme|db|data)/**/*.test.ts'],
    },
    {
      // Anything touching React Native or Expo modules.
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: ['**/src/**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', '/src/(engine|domain|theme|db|data)/'],
    },
  ],
};
