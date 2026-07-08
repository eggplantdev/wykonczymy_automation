import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function PauseIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="pause"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 0C3.58867 0 0 3.58867 0 8C0 12.4113 3.58867 16 8 16C12.4113 16 16 12.4113 16 8C16 3.58867 12.4113 0 8 0ZM8 14.6667C4.324 14.6667 1.33333 11.676 1.33333 8C1.33333 4.324 4.324 1.33333 8 1.33333C11.676 1.33333 14.6667 4.324 14.6667 8C14.6667 11.676 11.676 14.6667 8 14.6667ZM7.33333 6V10C7.33333 10.368 7.03467 10.6667 6.66667 10.6667C6.29867 10.6667 6 10.368 6 10V6C6 5.632 6.29867 5.33333 6.66667 5.33333C7.03467 5.33333 7.33333 5.632 7.33333 6ZM10 6V10C10 10.368 9.70133 10.6667 9.33333 10.6667C8.96533 10.6667 8.66667 10.368 8.66667 10V6C8.66667 5.632 8.96533 5.33333 9.33333 5.33333C9.70133 5.33333 10 5.632 10 6Z"
        fill="currentColor"
      />
    </svg>
  )
}
