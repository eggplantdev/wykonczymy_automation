import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function StopIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="stop"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 0C3.58867 0 0 3.58867 0 8C0 12.4113 3.58867 16 8 16C12.4113 16 16 12.4113 16 8C16 3.58867 12.4113 0 8 0ZM8 14.6667C4.324 14.6667 1.33333 11.676 1.33333 8C1.33333 4.324 4.324 1.33333 8 1.33333C11.676 1.33333 14.6667 4.324 14.6667 8C14.6667 11.676 11.676 14.6667 8 14.6667ZM9.33333 4.66667H6.66667C5.564 4.66667 4.66667 5.564 4.66667 6.66667V9.33333C4.66667 10.436 5.564 11.3333 6.66667 11.3333H9.33333C10.436 11.3333 11.3333 10.436 11.3333 9.33333V6.66667C11.3333 5.564 10.436 4.66667 9.33333 4.66667ZM10 9.33333C10 9.70067 9.70067 10 9.33333 10H6.66667C6.29933 10 6 9.70067 6 9.33333V6.66667C6 6.29933 6.29933 6 6.66667 6H9.33333C9.70067 6 10 6.29933 10 6.66667V9.33333Z"
        fill="currentColor"
      />
    </svg>
  )
}
