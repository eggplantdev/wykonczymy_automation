import type { LucideIcon } from 'lucide-react'
import { Panel } from '@/components/ui/panel'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'

type SettingsCardPropsT = {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function SettingsCard({ icon: Icon, title, action, children }: SettingsCardPropsT) {
  return (
    <Panel as="section" className="p-4">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <h2 className={cn('flex-1', SUBSECTION_TITLE_CLASS)}>{title}</h2>
        {action}
      </div>
      {children}
    </Panel>
  )
}
