import { cn } from '@/lib/utils/cn'

type ColorSwatchPropsT = {
  name: string
  className: string
}

export function ColorSwatch({ name, className }: ColorSwatchPropsT) {
  return (
    <div className="flex w-28 flex-col gap-1">
      <div className={cn('h-10 rounded-md border', className)} />
      <code className="text-2xs text-muted-foreground break-all">{name}</code>
    </div>
  )
}
