import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function UserIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="user"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 0C3.58867 0 0 3.58867 0 8C0 12.4113 3.58867 16 8 16C12.4113 16 16 12.4113 16 8C16 3.58867 12.4113 0 8 0ZM5.33333 14.1093V14C5.33333 12.5293 6.52933 11.3333 8 11.3333C9.47067 11.3333 10.6667 12.5293 10.6667 14V14.1093C9.84933 14.4673 8.948 14.6667 8 14.6667C7.052 14.6667 6.15067 14.4673 5.33333 14.1093ZM11.95 13.3673C11.646 11.4613 9.99067 10 8 10C6.00933 10 4.35467 11.4613 4.05 13.3673C2.40333 12.152 1.33333 10.1987 1.33333 8C1.33333 4.324 4.324 1.33333 8 1.33333C11.676 1.33333 14.6667 4.324 14.6667 8C14.6667 10.1987 13.5967 12.152 11.95 13.3673ZM8 3.33333C6.52933 3.33333 5.33333 4.52933 5.33333 6C5.33333 7.47067 6.52933 8.66667 8 8.66667C9.47067 8.66667 10.6667 7.47067 10.6667 6C10.6667 4.52933 9.47067 3.33333 8 3.33333ZM8 7.33333C7.26467 7.33333 6.66667 6.73533 6.66667 6C6.66667 5.26467 7.26467 4.66667 8 4.66667C8.73533 4.66667 9.33333 5.26467 9.33333 6C9.33333 6.73533 8.73533 7.33333 8 7.33333Z"
        fill="currentColor"
      />
    </svg>
  )
}
