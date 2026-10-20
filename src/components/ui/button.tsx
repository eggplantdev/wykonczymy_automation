import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        ghostDestructive: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        destructiveOutline:
          'border border-destructive text-destructive hover:bg-destructive hover:text-white',
        link: 'text-primary underline-offset-4 hover:underline',
        active: 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold',
        greenOutline:
          'border border-chart-green text-chart-green hover:bg-chart-green hover:text-white',
        blueOutline:
          'border border-chart-blue text-chart-blue hover:bg-chart-blue hover:text-white',
        turquoiseOutline:
          'border border-chart-turquoise text-chart-turquoise hover:bg-chart-turquoise hover:text-white',
        warningOutline:
          'border border-warning text-warning hover:bg-warning hover:text-warning-foreground',
        ai: 'gradient-border neon-glow-duo hover:neon-glow-duo-hit transition-shadow disabled:opacity-100',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        xs: 'h-7 rounded-md gap-1 px-2 text-xs',
        '2xs': 'h-6 rounded-md gap-1 px-2 text-xs',
        lg: "h-10 rounded-md px-6 [&_svg:not([class*='size-'])]:size-5",
        icon: 'size-9',
        iconSm: 'size-7',
        touch: 'h-11 px-4 py-2',
        iconTouch: "size-11 [&_svg:not([class*='size-'])]:size-7",
        inline: 'h-auto p-0',
        inlineXs: 'h-auto p-0 text-xs',
        row: 'h-auto w-full gap-2 px-1 py-1 text-xs font-normal whitespace-normal',
        listRow: 'h-auto w-full gap-2 rounded-none px-3 py-2 text-sm font-normal whitespace-normal',
        iconLg: "size-9 [&_svg:not([class*='size-'])]:size-5",
      },
      align: {
        center: 'justify-center',
        start: 'justify-start',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      align: 'center',
    },
  },
)

// `motion-safe:` rather than a `prefers-reduced-motion` block in globals.css: `!` puts the literal
// token `gradient-border-comet!` in the class attribute, so a hand-written `.gradient-border-comet`
// rule matches nothing.
const BUTTON_ANIMATION_CLASSES = {
  comet: 'motion-safe:gradient-border-comet!',
  breathe: 'motion-safe:neon-glow-duo-breathe',
} as const

type ButtonAnimationT = keyof typeof BUTTON_ANIMATION_CLASSES

type ButtonPropsT = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    animations?: ButtonAnimationT[]
    pending?: boolean
  }

// A component-typed first child is the leading icon; a DOM element or text is content.
function withPendingSpinner(children: React.ReactNode) {
  const [first, ...rest] = React.Children.toArray(children)
  if (React.isValidElement(first) && typeof first.type !== 'string') {
    return [<GradientSpinner key="pending-spinner" />, ...rest]
  }
  return [<GradientSpinner key="pending-spinner" />, ...React.Children.toArray(children)]
}

function Button({
  className,
  variant,
  size,
  align,
  animations,
  pending = false,
  asChild = false,
  disabled,
  children,
  ...props
}: ButtonPropsT) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, align }),
        animations?.map((animation) => BUTTON_ANIMATION_CLASSES[animation]),
        className,
      )}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && !asChild ? withPendingSpinner(children) : children}
    </Comp>
  )
}

export { Button, buttonVariants, BUTTON_ANIMATION_CLASSES }
export type { ButtonPropsT }
