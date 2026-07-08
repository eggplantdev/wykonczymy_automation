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
    ignores: ['.next/'],
  },
)
