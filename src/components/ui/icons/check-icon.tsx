import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function CheckIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="check"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 8.33347 4.80653"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.14261 0.199865C8.40061 0.462532 8.39661 0.884532 8.13327 1.14253L5.18261 4.0392C4.66061 4.5512 3.98861 4.80653 3.31594 4.80653C2.65061 4.80653 1.98527 4.55587 1.46527 4.05387L0.199273 2.8092C-0.0633938 2.5512 -0.0667266 2.1292 0.191273 1.86653C0.448607 1.6032 0.87194 1.59987 1.13394 1.85853L2.39594 3.0992C2.91327 3.5992 3.72994 3.59653 4.24994 3.0872L7.19994 0.191199C7.46194 -0.067468 7.88261 -0.0628014 8.14261 0.199865Z"
        fill="currentColor"
      />
    </svg>
  )
}
