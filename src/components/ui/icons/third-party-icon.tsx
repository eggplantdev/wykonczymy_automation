import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
}

export default function ThirdPartyIcon({ size = 'md', className }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="third-party"
      data-size={size}
      className={cn(iconVariants({ size }), className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.3333 7.33333V12.6667C13.3333 14.5047 11.838 16 10 16H3.33333C1.49533 16 0 14.5047 0 12.6667V6C0 4.162 1.49533 2.66667 3.33333 2.66667H8.66667C9.03467 2.66667 9.33333 2.96533 9.33333 3.33333C9.33333 3.70133 9.03467 4 8.66667 4H3.33333C2.23067 4 1.33333 4.89733 1.33333 6V12.6667C1.33333 13.7693 2.23067 14.6667 3.33333 14.6667H10C11.1027 14.6667 12 13.7693 12 12.6667V7.33333C12 6.96533 12.2987 6.66667 12.6667 6.66667C13.0347 6.66667 13.3333 6.96533 13.3333 7.33333ZM14 0H9.33333C8.96533 0 8.66667 0.298667 8.66667 0.666667C8.66667 1.03467 8.96533 1.33333 9.33333 1.33333H13.724L5.52867 9.52867C5.268 9.78933 5.268 10.2107 5.52867 10.4713C5.65867 10.6013 5.82933 10.6667 6 10.6667C6.17067 10.6667 6.34133 10.6013 6.47133 10.4713L14.6667 2.276V6.66667C14.6667 7.03467 14.9653 7.33333 15.3333 7.33333C15.7013 7.33333 16 7.03467 16 6.66667V2C16 0.897333 15.1027 0 14 0Z"
        fill="currentColor"
      />
    </svg>
  )
}
