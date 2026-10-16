import { cn } from '@/lib/utils/cn'

function GradientSpinner({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="status"
      aria-label="Ładowanie"
      className={cn('gradient-spinner size-4 shrink-0 animate-spin', className)}
      {...props}
    />
  )
}

export { GradientSpinner }
