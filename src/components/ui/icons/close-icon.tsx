import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function CloseIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="close"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 6.00033 6.00017"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.80483 1.13817L3.94283 3.00017L5.80483 4.86217C6.0655 5.12283 6.0655 5.54417 5.80483 5.80483C5.67483 5.93483 5.50417 6.00017 5.3335 6.00017C5.16283 6.00017 4.99217 5.93483 4.86217 5.80483L3.00017 3.94283L1.13817 5.80483C1.00817 5.93483 0.8375 6.00017 0.666834 6.00017C0.496167 6.00017 0.3255 5.93483 0.1955 5.80483C-0.0651667 5.54417 -0.0651667 5.12283 0.1955 4.86217L2.0575 3.00017L0.1955 1.13817C-0.0651667 0.8775 -0.0651667 0.456167 0.1955 0.1955C0.456167 -0.0651667 0.8775 -0.0651667 1.13817 0.1955L3.00017 2.0575L4.86217 0.1955C5.12283 -0.0651667 5.54417 -0.0651667 5.80483 0.1955C6.0655 0.456167 6.0655 0.8775 5.80483 1.13817Z"
        fill="currentColor"
      />
    </svg>
  )
}
