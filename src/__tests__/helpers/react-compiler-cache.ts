import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

type NodeT = { type: string; start: number; end: number; [key: string]: unknown }
type PathT = {
  node: NodeT
  findParent: (predicate: (parent: PathT) => boolean) => PathT | null
}
type BabelT = {
  transformSync: (code: string, options: object) => { code: string } | null
  parseSync: (code: string, options: object) => NodeT
  traverse: (ast: NodeT, visitors: Record<string, (path: PathT) => void>) => void
}

const requireFromHere = createRequire(import.meta.url)
const babel = requireFromHere('next/dist/compiled/babel/core') as BabelT
const parserOpts = { plugins: ['typescript', 'jsx'] }

const ALLOCATING = new Set([
  'CallExpression',
  'OptionalCallExpression',
  'NewExpression',
  'ArrayExpression',
  'ObjectExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'TaggedTemplateExpression',
])

function allocatesOrReads(node: unknown): { allocates: boolean; identifiers: string[] } {
  let allocates = false
  const identifiers: string[] = []
  const walk = (value: unknown) => {
    if (allocates || !value || typeof value !== 'object') return
    if (Array.isArray(value)) return value.forEach(walk)
    const current = value as NodeT
    if (typeof current.type !== 'string') return
    if (ALLOCATING.has(current.type)) {
      allocates = true
      return
    }
    if (current.type === 'Identifier') {
      identifiers.push(current.name as string)
      return
    }
    for (const [key, child] of Object.entries(current)) {
      if (['loc', 'leadingComments', 'trailingComments'].includes(key)) continue
      const isMember =
        current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression'
      if (isMember && key === 'property' && !current.computed) continue
      walk(child)
    }
  }
  walk(node)
  return { allocates, identifiers }
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

// A hook's result is an input here — its identity is that hook's contract, guarded by its own spec.
function isHookCall(value: NodeT): boolean {
  if (value.type !== 'CallExpression') return false
  const callee = value.callee as NodeT & { name?: string; property?: { name?: string } }
  const name = callee.type === 'MemberExpression' ? callee.property?.name : callee.name
  return /^use[A-Z]/.test(name ?? '')
}

export type CompiledCacheT = {
  callSites: (callee: string) => boolean[]
  bindingCached: (name: string) => boolean | undefined
}

export function compileWithReactCompiler(file: string): CompiledCacheT {
  const absolute = path.resolve(process.cwd(), file)
  const compiled = babel.transformSync(readFileSync(absolute, 'utf-8'), {
    filename: absolute,
    babelrc: false,
    configFile: false,
    parserOpts,
    plugins: [[requireFromHere.resolve('babel-plugin-react-compiler'), {}]],
  })
  const code = compiled?.code ?? ''
  const ast = babel.parseSync(code, { babelrc: false, configFile: false, parserOpts })
  const isCacheGuard = (parent: PathT) => {
    if (parent.node.type !== 'IfStatement') return false
    const test = parent.node.test as NodeT
    return code.slice(test.start, test.end).includes('$[')
  }

  // Module scope runs once, so it counts as a guard with no keys.
  const guardKeysOf = (nodePath: PathT) => {
    if (!nodePath.findParent((parent) => FUNCTIONS.has(parent.node.type))) return []
    const guard = nodePath.findParent(isCacheGuard)
    return guard
      ? allocatesOrReads(guard.node.test).identifiers.filter((identifier) => identifier !== '$')
      : undefined
  }
  const calls = new Map<string, (string[] | undefined)[]>()
  const writes = new Map<string, { guardKeys: string[] | undefined; value: NodeT }[]>()
  const addWrite = (name: string, writePath: PathT, value: NodeT) =>
    writes.set(name, [...(writes.get(name) ?? []), { guardKeys: guardKeysOf(writePath), value }])
  babel.traverse(ast, {
    CallExpression(callPath) {
      const callee = callPath.node.callee as NodeT & { name?: string }
      if (callee.type !== 'Identifier' || !callee.name) return
      calls.set(callee.name, [...(calls.get(callee.name) ?? []), guardKeysOf(callPath)])
    },
    VariableDeclarator(declaratorPath) {
      const { id, init } = declaratorPath.node as NodeT & { id: NodeT; init: NodeT | null }
      if (!init) return
      if (id.type === 'Identifier') addWrite(id.name as string, declaratorPath, init)
      if (id.type === 'ObjectPattern')
        for (const property of id.properties as { value?: NodeT }[])
          if (property.value?.type === 'Identifier')
            addWrite(property.value.name as string, declaratorPath, init)
    },
    AssignmentExpression(assignmentPath) {
      const { left, right } = assignmentPath.node as NodeT & { left: NodeT; right: NodeT }
      if (left.type === 'Identifier') addWrite(left.name as string, assignmentPath, right)
    },
  })

  // A `$[…]` guard keyed on a value that is itself fresh every render recomputes every render too.
  const isFresh = (name: string, seen: Set<string>): boolean => {
    if (seen.has(name)) return false
    seen.add(name)
    return (writes.get(name) ?? []).some(({ guardKeys, value }) => {
      const fromCache =
        value.type === 'MemberExpression' &&
        (value.object as NodeT & { name?: string }).name === '$'
      if (fromCache || isHookCall(value)) return false
      if (guardKeys) return guardKeys.some((key) => isFresh(key, seen))
      const { allocates, identifiers } = allocatesOrReads(value)
      return allocates || identifiers.some((identifier) => isFresh(identifier, seen))
    })
  }

  return {
    callSites: (callee) =>
      (calls.get(callee) ?? []).map(
        (guardKeys) => guardKeys !== undefined && !guardKeys.some((key) => isFresh(key, new Set())),
      ),
    bindingCached: (name) => (writes.has(name) ? !isFresh(name, new Set()) : undefined),
  }
}
