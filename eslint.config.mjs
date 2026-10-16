import js from '@eslint/js'
import ts from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import { fixupPluginRules } from '@eslint/compat'
import { noDomainDriftRule } from './eslint-rules/no-domain-drift.mjs'

const ENV_IGNORES = [
  'src/lib/env/**',
  'src/payload.config.ts',
  'src/scripts/**',
  'src/__tests__/**',
]

const NO_RAW_ENV = {
  selector:
    "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name='NODE_ENV'])",
  message:
    'Read env through the validated env layer (env/index.ts / env/server.ts), never raw process.env.',
}

const NO_RAW_UNSTABLE_CACHE = {
  name: 'next/cache',
  importNames: ['unstable_cache'],
  message: 'Use cached() from @/lib/cache/cached — it keys the entry on the deployment.',
}

// Matched by the `…Action` naming convention, so a `'use server'` export named otherwise
// (`getPresetOptions`) slips through.
const ACTION_CALL = "[callee.name=/Action$/]:not([callee.name='settleAction'])"
const IN_TRY = 'TryStatement[handler] > BlockStatement.block *'
const THEN_WITHOUT_REJECTION =
  "CallExpression[callee.property.name='then'][arguments.length<2]:not(MemberExpression[property.name='catch'] > CallExpression.object)"
const UNSETTLED_ACTION_MESSAGE =
  'A server action call can reject when the request never arrives — wrap it in settleAction() from @/lib/utils/settle-action.'
const UNSETTLED_ACTION = [
  `AwaitExpression:not(${IN_TRY}) > CallExpression${ACTION_CALL}`,
  `UnaryExpression[operator='void'] > CallExpression${ACTION_CALL}`,
  `${THEN_WITHOUT_REJECTION} > MemberExpression.callee > CallExpression.object${ACTION_CALL}`,
  `CallExpression[callee.name='startTransition'] > ArrowFunctionExpression > CallExpression.body${ACTION_CALL}`,
  `ExpressionStatement:not(${IN_TRY}) > CallExpression.expression${ACTION_CALL}`,
].map((selector) => ({ selector, message: UNSETTLED_ACTION_MESSAGE }))

export default ts.config(
  {
    extends: [js.configs.recommended, ...ts.configs.recommended],
  },
  {
    plugins: {
      '@next/next': fixupPluginRules(nextPlugin),
      'react-hooks': fixupPluginRules(reactHooksPlugin),
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ENV_IGNORES,
    rules: {
      'no-restricted-syntax': ['error', NO_RAW_ENV],
    },
  },
  {
    // A second `no-restricted-syntax` replaces the env block's selectors for these
    // files, so NO_RAW_ENV is repeated.
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/hooks/use-*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/stores/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', NO_RAW_ENV, ...UNSETTLED_ACTION],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/cache/cached.ts', 'src/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: [NO_RAW_UNSTABLE_CACHE] }],
    },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            NO_RAW_UNSTABLE_CACHE,
            {
              name: '@/lib/cache/revalidate',
              message:
                "Hooks run in Route Handler context — use revalidateTag(tag, EXPIRE_NOW), not updateTag/revalidateCollection from lib/cache/revalidate.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    ignores: ['src/migrations/**'],
    plugins: { local: { rules: { 'no-domain-drift': noDomainDriftRule } } },
    rules: { 'local/no-domain-drift': 'error' },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    ignores: [
      '.next/',
      '.next-e2e/',
      '.next-qa/',
      'test.js',
      '.claude/',
      'scripts/inspect-sheet.mjs',
      'scripts/blob-mirror.mjs',
      'scripts/blob-snapshot.mjs',
      'scripts/blob-restore.mjs',
      'scripts/share-sheets-with-reader.mjs',
      'scripts/perf/',
      'context/**',
    ],
  },
)
