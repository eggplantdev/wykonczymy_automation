import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        ghostDestructive: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
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
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
        badge: 'rounded-full px-2 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonPropsT = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonPropsT) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonPropsT }
