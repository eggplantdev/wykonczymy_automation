import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function MenuDotsIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="menu-dots"
      className={cn(iconVariants({ size }), className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 2.66667"
      fill="none"
    >
      <path
        d="M1.33333 2.66667C2.06971 2.66667 2.66667 2.06971 2.66667 1.33333C2.66667 0.596954 2.06971 0 1.33333 0C0.596954 0 0 0.596954 0 1.33333C0 2.06971 0.596954 2.66667 1.33333 2.66667Z"
        fill="currentColor"
      />
      <path
        d="M8 2.66667C8.73638 2.66667 9.33333 2.06971 9.33333 1.33333C9.33333 0.596954 8.73638 0 8 0C7.26362 0 6.66667 0.596954 6.66667 1.33333C6.66667 2.06971 7.26362 2.66667 8 2.66667Z"
        fill="currentColor"
      />
      <path
        d="M14.6667 2.66667C15.403 2.66667 16 2.06971 16 1.33333C16 0.596954 15.403 0 14.6667 0C13.9303 0 13.3333 0.596954 13.3333 1.33333C13.3333 2.06971 13.9303 2.66667 14.6667 2.66667Z"
        fill="currentColor"
      />
    </svg>
  )
}
