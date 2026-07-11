import { cn } from '@/lib/utils/cn'

// Fuchsia→cyan gradient ring (the `gradient-spinner` utility) instead of a flat Lucide icon, so
// the loading state reads in the app's AI-accent hues. Default size-4 matches inline icon spinners.
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
