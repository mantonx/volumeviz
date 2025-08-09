import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import tseslint from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'
import packageJson from 'eslint-plugin-package-json'
import dependencyVersionPolicy from './eslint-rules/dependency-version-policy.js'

export default [
  { ignores: ['dist', '*.config.js', '*.config.ts', '.storybook/**', 'storybook-static/**', 'coverage/**'] },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'prettier': prettier,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...prettierConfig.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Test files configuration
  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      'react-hooks': reactHooks,
      'prettier': prettier,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Storybook files configuration
  {
    files: ['src/**/*.stories.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      'prettier': prettier,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/rules-of-hooks': 'off', // Allow hooks in Storybook stories
    },
  },
  // Package.json linting
  {
    files: ['package.json'],
    languageOptions: {
      parser: packageJson.parsers.JSON,
    },
    plugins: {
      'package-json': packageJson,
      'custom': {
        'dependency-version-policy': dependencyVersionPolicy,
      },
    },
    rules: {
      // Standard package.json validation
      'package-json/valid-package-json': 'error',
      'package-json/order-properties': 'warn',
      'package-json/unique-dependencies': 'error',
      'package-json/sort-collections': ['warn', {
        collections: ['dependencies', 'devDependencies', 'peerDependencies']
      }],
      
      // Custom dependency version policy enforcement
      'custom/dependency-version-policy': 'error',
      
      // Repository and metadata consistency  
      'package-json/no-dependencies-in-devDependencies': 'warn',
    },
  },
]
