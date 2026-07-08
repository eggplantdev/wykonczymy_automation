import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function MinusIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="minus"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 8 1.33333"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.33333 0H0.666667C0.298477 0 0 0.298477 0 0.666667C0 1.03486 0.298477 1.33333 0.666667 1.33333H7.33333C7.70152 1.33333 8 1.03486 8 0.666667C8 0.298477 7.70152 0 7.33333 0Z"
        fill="currentColor"
      />
    </svg>
  )
}
