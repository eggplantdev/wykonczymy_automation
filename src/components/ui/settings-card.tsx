import type { LucideIcon } from 'lucide-react'

type SettingsCardPropsT = {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function SettingsCard({ icon: Icon, title, action, children }: SettingsCardPropsT) {
  return (
    <section className="border-border rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
