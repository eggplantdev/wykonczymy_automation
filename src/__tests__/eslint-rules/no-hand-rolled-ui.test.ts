import { ESLint, RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import { noHandRolledUiRule } from '../../../eslint-rules/no-hand-rolled-ui.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

ruleTester.run('no-hand-rolled-ui', noHandRolledUiRule, {
  valid: [
    "import { ToastContainer } from 'react-toastify'",
    "import { Plus } from 'lucide-react'",
    "import 'react-toastify/dist/ReactToastify.css'",
    "const cls = 'text-destructive bg-chart-green border-warning'",
    '<DialogContent className="sm:max-w-dialog-sm" />',
    '<div className="sm:max-w-md" />',
    '<p className="text-destructive font-medium" />',
    '<div className="text-destructive text-xs" />',
    '<Button className="w-full" />',
    '<SimpleTooltip title="x" />',
  ],
  invalid: [
    { code: "import * as Dialog from '@radix-ui/react-dialog'", errors: [{ messageId: 'primitivePackage' }] },
    { code: "import { Popover } from 'radix-ui'", errors: [{ messageId: 'primitivePackage' }] },
    { code: "import { Command } from 'cmdk'", errors: [{ messageId: 'primitivePackage' }] },
    { code: "import { Drawer } from 'vaul'", errors: [{ messageId: 'primitivePackage' }] },
    { code: "import { toast } from 'react-toastify'", errors: [{ messageId: 'toast' }] },
    { code: "import { Loader2 } from 'lucide-react'", errors: [{ messageId: 'loader' }] },
    { code: "import { LoaderCircle } from 'lucide-react'", errors: [{ messageId: 'loader' }] },
    { code: "const cls = 'text-red-600'", errors: [{ messageId: 'statusPalette' }] },
    { code: 'const cls = `p-2 ${x} bg-amber-50`', errors: [{ messageId: 'statusPalette' }] },
    { code: '<DialogContent className="sm:max-w-md" />', errors: [{ messageId: 'dialogWidth' }] },
    {
      code: "<FormDialogShell className={cn('p-2', 'sm:max-w-[40rem]')} />",
      errors: [{ messageId: 'dialogWidth' }],
    },
    { code: '<p className="text-destructive text-xs" />', errors: [{ messageId: 'errorText' }] },
    { code: '<details />', errors: [{ messageId: 'details' }] },
    { code: '<label htmlFor="x" />', errors: [{ messageId: 'label' }] },
    { code: '<button className="p-2" />', errors: [{ messageId: 'button' }] },
    { code: '<span title="x" />', errors: [{ messageId: 'title' }] },
    { code: '<Button title="x" />', errors: [{ messageId: 'title' }] },
  ],
})

describe('no-hand-rolled-ui config scope', () => {
  const eslint = new ESLint()
  const severity = async (file: string) =>
    (await eslint.calculateConfigForFile(file)).rules?.['local/no-hand-rolled-ui']?.[0]

  it('is on outside ui/ and off inside it', async () => {
    expect(await severity('src/components/nav/sidebar.tsx')).toBe(2)
    expect(await severity('src/app/(frontend)/page.tsx')).toBe(2)
    expect(await severity('src/hooks/use-file-archive.ts')).toBe(2)
    expect(await severity('src/components/ui/button.tsx')).toBeUndefined()
  })
})
