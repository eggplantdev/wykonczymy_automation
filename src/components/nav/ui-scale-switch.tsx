'use client'

import { useSyncExternalStore } from 'react'
import { ZoomOut } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'
import {
  DEFAULT_UI_SCALE,
  UI_SCALES,
  UI_SCALE_COOKIE,
  parseUiScale,
  type UiScaleT,
} from '@/lib/constants/ui-scale'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function readScale(): UiScaleT {
  const match = document.cookie.match(new RegExp(`(?:^|; )${UI_SCALE_COOKIE}=([^;]*)`))
  return parseUiScale(match?.[1])
}

// Tailwind sizes text and spacing in rem, so the root font-size scales the whole app at once.
function applyScale(scale: UiScaleT) {
  document.cookie = `${UI_SCALE_COOKIE}=${scale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
  document.documentElement.style.fontSize = scale === DEFAULT_UI_SCALE ? '' : `${scale}%`
  listeners.forEach((listener) => listener())
}

export function UiScaleSwitch() {
  const { t } = useTranslation('shell')
  const activeScale = useSyncExternalStore(subscribe, readScale, () => DEFAULT_UI_SCALE)

  return (
    <div className="flex items-center gap-2">
      <ZoomOut className="text-muted-foreground size-4 shrink-0" />
      <span className="text-sm">{t('uiScale')}</span>
      <div className="bg-muted ml-auto flex h-8 items-center rounded-md p-0.5">
        {UI_SCALES.map((scale) => (
          <button
            key={scale}
            type="button"
            aria-pressed={scale === activeScale}
            onClick={() => applyScale(scale)}
            className={cn(
              'flex h-full items-center rounded-sm px-2.5 text-xs transition-colors',
              scale === activeScale
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {scale}%
          </button>
        ))}
      </div>
    </div>
  )
}
