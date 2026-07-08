import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function AvatarIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="avatar"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.99998 0C2.23998 0 -1.52588e-05 2.24 -1.52588e-05 5C-1.52588e-05 7.76 2.23998 10 4.99998 10C7.75998 10 9.99998 7.76 9.99998 5C9.99998 2.24 7.75998 0 4.99998 0ZM2.48265 7.85067C2.69065 7.03067 3.68465 6.43933 4.99998 6.43933C6.31532 6.43933 7.30998 7.03067 7.51732 7.85067C6.83265 8.376 5.95398 8.68867 4.99998 8.68867C4.04598 8.68867 3.16732 8.376 2.48265 7.85067ZM8.38998 6.98133C7.78732 5.85133 6.50465 5.128 4.99998 5.128C3.49532 5.128 2.21265 5.85133 1.60998 6.98133C1.13532 6.25667 0.843984 5.40533 0.843984 4.49467C0.843984 2.47933 2.47798 0.845333 4.49332 0.845333C6.50865 0.845333 8.14265 2.47933 8.14265 4.49467C8.14265 5.40533 7.85465 6.25667 7.37998 6.98133H8.38998Z"
        fill="currentColor"
      />
      <path
        d="M4.99998 1.688C3.89598 1.688 2.99998 2.584 2.99998 3.688C2.99998 4.792 3.89598 5.688 4.99998 5.688C6.10398 5.688 6.99998 4.792 6.99998 3.688C6.99998 2.584 6.10398 1.688 4.99998 1.688Z"
        fill="currentColor"
      />
    </svg>
  )
}
