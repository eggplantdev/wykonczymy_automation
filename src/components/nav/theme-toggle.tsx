'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

// Theme is known only on the client, so both labels ship and `dark:` picks one — next-themes stamps
// the class before first paint. `setTheme` takes a callback for the same reason: read at click
// time, never during render.
export function ThemeToggle({
  collapsed,
  ...props
}: React.ComponentProps<typeof Button> & { collapsed: boolean }) {
  const { setTheme } = useTheme()
  const { t } = useTranslation('shell')

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      aria-label={t('toggleTheme')}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
      {!collapsed && (
        <>
          <span className="hidden dark:inline">{t('lightTheme')}</span>
          <span className="dark:hidden">{t('darkTheme')}</span>
        </>
      )}
    </Button>
  )
}
