import { cva } from 'class-variance-authority'

export const iconVariants = cva('shrink-0', {
  variants: {
    size: {
      xxs: 'size-2',
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})
