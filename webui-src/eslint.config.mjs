import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['app/mithril.js', 'assets/**', 'make-src/**'],
  },
  {
    files: ['app/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'linebreak-style': ['off', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'arrow-parens': ['error', 'always'],
      'comma-style': ['error', 'last'],
      'comma-spacing': ['error', { before: false, after: true }],
      camelcase: ['error', {
        allow: ['^UNSAFE_'],
        properties: 'never',
        ignoreGlobals: true,
      }],
      'eol-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-irregular-whitespace': 'error',
      'no-trailing-spaces': 'error',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'error',
      'no-var': 'warn',
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        vars: 'all',
      }],
      'object-shorthand': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'semi-style': ['warn', 'last'],
      'spaced-comment': ['warn', 'always'],
    },
  },
];
