import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

type StatButtonPropsT = {
  label: string
  value: string
  className?: string
}

export function StatButton({ label, value, className }: StatButtonPropsT) {
  return (
    <Button variant="outline" disabled className={cn('w-fit border-2', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </Button>
  )
}
