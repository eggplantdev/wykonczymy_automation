'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

// Which theme is active is known only on the client, so naming it at render time would mean either
// a hydration mismatch or a mounted-gate that pops the control in late. Both labels ship instead and
// `dark:` picks one — next-themes' blocking script stamps the class before first paint, so the right
// half is showing by the time anything is visible. `setTheme` takes the flip as a callback for the
// same reason: the current value is read at click time, never during render.
export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      aria-label="Przełącz motyw"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
      {!collapsed && (
        <>
          <span className="hidden dark:inline">Jasny motyw</span>
          <span className="dark:hidden">Ciemny motyw</span>
        </>
      )}
    </Button>
  )
}
