import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * Tag component specs from Figma SVG exports:
 * - Height: 20px
 * - Border radius: 6px (outline), 8px (filled/gradient border)
 * - Left padding: 8px (to dot)
 * - Right padding: 12px
 * - Dot: 6x6px with 2px corner radius
 * - Gap between dot and text: 6px
 * - Border: 1px #222 at 10% opacity
 * - Background (outline): #fff at 50% opacity
 */

const tagVariants = cva(
  'text-xs inline-flex items-center gap-1.5 whitespace-nowrap text-foreground',
  {
    variants: {
      variant: {
        outline: 'h-5 rounded-[6px] border border-border bg-background pl-2 pr-3',
        gradientBorder: 'h-5 rounded-[8px]',
        filled:
          'h-5 rounded-[8px] bg-gradient-to-r from-[#FCC86B] to-[#00B8A2] pl-2 pr-3 text-white',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
)

type DotColorT = 'green' | 'orange' | 'red' | 'purple'

type GradientT = 'greenPurple' | 'redPurple'

type PropsT = VariantProps<typeof tagVariants> & {
  className?: string
  children: React.ReactNode
  dotColor?: DotColorT
  showDot?: boolean
  gradient?: GradientT
}

const dotColorMap: Record<DotColorT, string> = {
  green: '#3AD199',
  orange: '#FF9C42',
  red: '#FF7B60',
  purple: '#AF82E8',
}

const gradientMap: Record<GradientT, string> = {
  greenPurple: 'linear-gradient(to right, #3AD199, #AF82E8)',
  redPurple: 'linear-gradient(to right, #FF7B60, #AF82E8)',
}

function TagDot({ color }: { color: DotColorT }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-[2px]"
      style={{ backgroundColor: dotColorMap[color] }}
    />
  )
}

export default function Tag({
  variant = 'outline',
  className,
  children,
  dotColor = 'green',
  showDot = true,
  gradient = 'greenPurple',
}: PropsT) {
  const shouldShowDot = showDot && variant !== 'filled'

  if (variant === 'gradientBorder') {
    return (
      <span
        data-slot="tag"
        data-variant={variant}
        className={cn('relative inline-flex h-5 rounded-[8px] p-px', className)}
        style={{ background: gradientMap[gradient] }}
      >
        <span className="bg-background inline-flex h-full w-full items-center gap-[6px] rounded-[7px] pr-3 pl-2">
          <span className="text-foreground inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
            {shouldShowDot && <TagDot color={dotColor} />}
            {children}
          </span>
        </span>
      </span>
    )
  }

  return (
    <span
      data-slot="tag"
      data-variant={variant}
      className={cn(tagVariants({ variant }), className)}
    >
      {shouldShowDot && <TagDot color={dotColor} />}
      {children}
    </span>
  )
}
