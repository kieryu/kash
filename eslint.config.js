// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'design/*', 'android/*', 'ios/*', '.expo/*'] },

  // UI uses theme tokens only: no hard-coded colors or font styles outside src/theme.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/data/**', '**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Use a color token from src/theme instead of a hex literal.',
        },
        {
          selector: 'Property[key.name=/^(fontSize|fontFamily|fontWeight|lineHeight)$/][value.type="Literal"]',
          message: 'Use a text style from src/theme/typography instead of raw font values.',
        },
      ],
    },
  },

  // The payoff engine is pure TypeScript: no React, Expo, DB or app imports (CLAUDE.md §7).
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/|big\\.js$)',
              message: 'src/engine may only import relative engine files and big.js.',
            },
          ],
        },
      ],
    },
  },
]);
