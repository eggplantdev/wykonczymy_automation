#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ESLint } from 'eslint'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const syntaxTs = require('next/dist/compiled/babel/plugin-syntax-typescript')
const syntaxJsx = require('next/dist/compiled/babel/plugin-syntax-jsx')
const reactCompiler = require('babel-plugin-react-compiler')
const swc = require('next/dist/build/swc')

const COMPILER_RULES = [
  'react-hooks/preserve-manual-memoization',
  'react-hooks/incompatible-library',
  'react-hooks/refs',
  'react-hooks/immutability',
]

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: pnpm check:compiler <files…>')
  process.exit(2)
}

function compile(file) {
  const problems = []
  const compiled = new Set()
  babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    plugins: [
      [syntaxTs, { isTSX: file.endsWith('.tsx') }],
      ...(file.endsWith('.tsx') ? [] : [syntaxJsx]),
      [
        reactCompiler,
        {
          panicThreshold: 'none',
          logger: {
            logEvent(_filename, event) {
              if (event.kind === 'CompileSuccess') compiled.add(event.fnName)
              else if (event.kind === 'CompileSkip') {
                problems.push(`CompileSkip @${event.fnLoc?.start?.line}: opted out by a directive`)
              } else if (event.kind === 'CompileError' || event.kind === 'PipelineError') {
                const detail = event.detail?.reason ?? event.detail?.options?.reason ?? event.data
                const line = event.fnLoc?.start?.line ?? event.detail?.loc?.start?.line
                problems.push(`${event.kind}${line ? ` @${line}` : ''}: ${detail}`)
              }
            },
          },
        },
      ],
    ],
  })
  return { compiled, problems }
}

const eslint = new ESLint({
  overrideConfig: { rules: Object.fromEntries(COMPILER_RULES.map((rule) => [rule, 'error'])) },
})
const lintResults = await eslint.lintFiles(files)
const lintByFile = new Map(
  lintResults.map((result) => [
    path.resolve(result.filePath),
    result.messages
      .filter((m) => COMPILER_RULES.includes(m.ruleId))
      .map((m) => `${m.ruleId} @${m.line}: ${m.message.split('\n')[0]}`),
  ]),
)

await swc.loadBindings()

let failed = false
for (const file of files) {
  const { compiled, problems } = compile(file)
  if (compiled.size > 0 && !(await swc.isReactCompilerRequired(path.resolve(file)))) {
    problems.unshift('Next skips this file: its prefilter finds no component or hook')
  }
  const all = [...problems, ...(lintByFile.get(path.resolve(file)) ?? [])]
  if (all.length > 0) failed = true
  console.log(
    `${all.length > 0 ? 'FAIL' : 'ok  '} ${file} (${[...compiled].join(', ') || 'nothing to compile'})`,
  )
  for (const problem of all) console.log(`     ${problem}`)
}
process.exit(failed ? 1 : 0)
