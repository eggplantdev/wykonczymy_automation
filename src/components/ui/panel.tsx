import { cn } from '@/lib/utils/cn'

export const BORDERED_LIST_CLASS = 'divide-border border-border divide-y rounded-md border'

export const CARD_LIST_CLASS =
  'max-sm:divide-border max-sm:border-border w-full max-sm:divide-y max-sm:overflow-hidden max-sm:rounded-lg max-sm:border sm:max-w-3xl sm:space-y-3'

export const CARD_SHELL_CLASS =
  'bg-background sm:border-border sm:rounded-lg sm:border sm:shadow-sm'

const PANEL_TONES = {
  plain: '',
  muted: 'bg-muted/50',
  alert: 'border-destructive border-2',
} as const

type PanelToneT = keyof typeof PANEL_TONES

type PanelPropsT = React.ComponentProps<'div'> & {
  tone?: PanelToneT
  as?: 'div' | 'section'
}

export function Panel({ tone = 'plain', as: Tag = 'div', className, ...props }: PanelPropsT) {
  return (
    <Tag
      className={cn('border-border rounded-md border', PANEL_TONES[tone], className)}
      {...props}
    />
  )
}
