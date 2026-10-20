'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

export type EnvT = 'production' | 'preview' | 'development'

// Literal classes per env — Tailwind can't scan a template string, so no `bg-${...}`.
const ENV_STYLES: Record<EnvT, string> = {
  production: 'bg-green-600 text-white',
  preview: 'bg-amber-500 text-black',
  development: 'bg-blue-600 text-white',
}

const ENV_LABELS: Record<EnvT, string> = {
  production: 'PROD',
  preview: 'TESTY',
  development: 'LOCAL',
}

type PropsT = {
  env: EnvT
  db?: string
  title: string
  className?: string
}

export function EnvBadgeShell({ env, db, title, className }: PropsT) {
  const [isOpen, setIsOpen] = useState(true)
  const label = ENV_LABELS[env] ?? env

  return (
    <SimpleTooltip content={title}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Zwiń znacznik środowiska' : `Rozwiń znacznik środowiska: ${label}`}
        className={cn(
          'fixed bottom-0 left-1/2 z-10000 flex -translate-x-1/2 items-center gap-2 rounded-t-lg shadow-xl',
          'font-mono font-bold tracking-widest uppercase select-none',
          isOpen ? 'px-3 py-2' : 'px-2 py-0.5',
          ENV_STYLES[env] ?? ENV_STYLES.production,
          className,
        )}
      >
        {isOpen && (
          <>
            <span className="text-lg">{label}</span>
            {db && (
              <span className="text-xs font-normal tracking-normal normal-case opacity-80">
                {db}
              </span>
            )}
          </>
        )}
        {isOpen ? <ChevronDown /> : <ChevronUp />}
      </button>
    </SimpleTooltip>
  )
}
