'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

type PropsT = {
  label: string
  db?: string
  title: string
  className?: string
}

export function EnvBadgeShell({ label, db, title, className }: PropsT) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <button
      type="button"
      onClick={() => setIsOpen((open) => !open)}
      title={title}
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Zwiń znacznik środowiska' : `Rozwiń znacznik środowiska: ${label}`}
      className={cn(
        'fixed bottom-0 left-1/2 z-10000 flex -translate-x-1/2 items-center gap-2 rounded-t-lg shadow-xl',
        'font-mono font-bold tracking-widest uppercase select-none',
        isOpen ? 'px-3 py-2' : 'px-2 py-0.5',
        className,
      )}
    >
      {isOpen && (
        <>
          <span className="text-lg">{label}</span>
          {db && (
            <span className="text-xs font-normal tracking-normal normal-case opacity-80">{db}</span>
          )}
        </>
      )}
      {isOpen ? <ChevronDown /> : <ChevronUp />}
    </button>
  )
}
