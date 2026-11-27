import globals from 'globals'
import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist', 'src/components/ui', 'src/routeTree.gen.ts'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginQuery.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'no-duplicate-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'bun',
              message:
                'apps/web may only import @yunpu/shared, never @yunpu/db, @yunpu/api runtime code, or Bun APIs',
            },
            {
              name: 'bun:test',
              message:
                'apps/web may only import @yunpu/shared, never @yunpu/db, @yunpu/api runtime code, or Bun APIs',
            },
            {
              name: '@yunpu/db',
              message:
                'apps/web may only import @yunpu/shared, never @yunpu/db, @yunpu/api runtime code, or Bun APIs',
            },
            {
              name: '@yunpu/api',
              message:
                'apps/web may only import @yunpu/shared, never @yunpu/db, @yunpu/api runtime code, or Bun APIs',
            },
          ],
          patterns: [
            {
              group: ['**/apps/api/**', '**/packages/db/**'],
              message:
                'apps/web may only import @yunpu/shared, never @yunpu/db, @yunpu/api runtime code, or Bun APIs',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
)
