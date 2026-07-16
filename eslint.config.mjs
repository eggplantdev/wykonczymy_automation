import js from '@eslint/js'
import ts from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import { fixupPluginRules } from '@eslint/compat'

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
    // Read env only through the validated layer (env/index.ts / env/server.ts) — never raw
    // process.env. Allowlist the env layer itself, payload.config and CLI scripts (both run
    // in the Payload CLI graph where `server-only` can't be imported), and tests (which seed
    // process.env).
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/lib/env/**',
      'src/payload.config.ts',
      'src/scripts/**',
      'src/__tests__/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // matches `process.env.X`, but allows `process.env.NODE_ENV`
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name='NODE_ENV'])",
          message:
            'Read env through the validated env layer (env/index.ts / env/server.ts), never raw process.env.',
        },
      ],
    },
  },
  {
    // Payload hooks run in a Route Handler context where `updateTag` throws. `lib/cache/revalidate.ts`
    // calls `updateTag`, so a hook must never import it — use `revalidateTag(tag, 'default')` directly.
    // A bad import here builds and deploys green, then throws only on a live transfer create/delete.
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/cache/revalidate',
              message:
                "Hooks run in Route Handler context — use revalidateTag(tag, 'default'), not updateTag/revalidateCollection from lib/cache/revalidate.",
            },
          ],
        },
      ],
    },
  },
  {
    // Type-aware pass, scoped to app source — the ONLY reliable way to catch `@deprecated`
    // symbol usage repo-wide. tsc never emits deprecation diagnostics and the editor computes
    // them only for open files, so this rule is the source of truth (runs in CI via `pnpm lint`).
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  {
    // Root CommonJS configs (e.g. .dependency-cruiser.cjs) use module.exports; the flat config
    // otherwise parses them as ESM and flags `module` as no-undef.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    // One-off plain-Node .mjs tools (not app code) — their process/console use trips no-undef and
    // it's not worth a Node-globals config block. scripts/inspect-sheet.mjs = sheet-inspection POC;
    // scripts/blob-snapshot.mjs = EX-459 blob backup/recovery tool.
    ignores: ['.next/', '.next-e2e/', 'scripts/inspect-sheet.mjs', 'scripts/blob-mirror.mjs', 'scripts/blob-snapshot.mjs'],
  },
)
