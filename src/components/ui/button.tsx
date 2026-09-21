import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        ghostDestructive: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        outlineDestructive:
          'border border-input bg-background shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
        badgeActive:
          'border border-chart-green text-chart-green hover:bg-chart-green hover:text-white',
        badgePending: 'border border-amber-500 text-amber-500 opacity-50',
        badgeInactive: 'bg-muted text-muted-foreground hover:bg-muted-foreground/20',
        activeFilter: 'border border-green-600 text-green-600 hover:bg-green-600 hover:text-white',
        red: 'border border-chart-red text-chart-red hover:bg-chart-red hover:text-white',
        blue: 'border border-chart-blue text-chart-blue hover:bg-chart-blue hover:text-white',
        teal: 'border border-chart-teal text-chart-teal hover:bg-chart-teal hover:text-white',
        turquoise:
          'border border-chart-turquoise text-chart-turquoise hover:bg-chart-turquoise hover:text-white',
        ai: 'gradient-border neon-glow-duo hover:neon-glow-duo-hit transition-shadow disabled:opacity-100',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        xs: 'h-7 rounded-md gap-1 px-2 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
        badge: 'rounded-full px-2 py-0.5 text-xs',
      },
      // Content alignment, split off `variant` because it is orthogonal to colour: a left-aligned
      // button is a menu/filter row (sidebar link, filter trigger, section action) and any variant
      // can be one. It was six hand-written `justify-start` classNames before, three of them also
      // re-declaring the `gap-1.5` that `size="sm"` already sets.
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

// The animated accents from globals.css. A list rather than a cva variant because they compose —
// `['comet', 'breathe']` is a legitimate answer a single-choice variant could not express.
// `motion-safe:` rather than a `prefers-reduced-motion` block in globals.css: `!` puts the literal
// token `gradient-border-comet!` in the class attribute, so a hand-written `.gradient-border-comet`
// rule matches nothing. Dropping the utility under reduced motion falls back to the `ai` variant's
// resting border and halo, which is the intended still state anyway. The `!` beats that resting
// `gradient-border`; `breathe` adds a layer rather than replacing one, so it needs none.
const BUTTON_ANIMATION_CLASSES = {
  comet: 'motion-safe:gradient-border-comet!',
  breathe: 'motion-safe:neon-glow-duo-breathe',
} as const

type ButtonAnimationT = keyof typeof BUTTON_ANIMATION_CLASSES

type ButtonPropsT = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    animations?: ButtonAnimationT[]
  }

function Button({
  className,
  variant,
  size,
  align,
  animations,
  asChild = false,
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
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonAnimationT, ButtonPropsT }
