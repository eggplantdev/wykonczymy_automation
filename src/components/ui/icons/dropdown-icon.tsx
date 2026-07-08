import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type DirectionT = 'up' | 'down'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
  direction: DirectionT
}

const rotations: Record<DirectionT, string> = {
  down: '0deg',
  up: '180deg',
}

export default function DropdownIcon({ size = 'md', className, direction }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="dropdown"
      data-size={size}
      className={cn(iconVariants({ size }), 'transition-transform', className)}
      style={{ transform: `rotate(${rotations[direction]})` }}
      viewBox="0 0 9.33439 4.78211"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.14053 0.197199C9.07855 0.134713 9.00482 0.0851169 8.92358 0.0512711C8.84234 0.0174253 8.7552 0 8.6672 0C8.57919 0 8.49205 0.0174253 8.41081 0.0512711C8.32957 0.0851169 8.25584 0.134713 8.19386 0.197199L5.14053 3.25053C5.07855 3.31302 5.00482 3.36261 4.92358 3.39646C4.84234 3.43031 4.7552 3.44773 4.6672 3.44773C4.57919 3.44773 4.49205 3.43031 4.41081 3.39646C4.32957 3.36261 4.25584 3.31302 4.19386 3.25053L1.14053 0.197199C1.07855 0.134713 1.00482 0.0851169 0.92358 0.0512711C0.84234 0.0174253 0.755203 0 0.667195 0C0.579187 0 0.49205 0.0174253 0.41081 0.0512711C0.329571 0.0851169 0.255837 0.134713 0.193862 0.197199C0.0696944 0.322107 0 0.491075 0 0.667199C0 0.843323 0.0696944 1.01229 0.193862 1.1372L3.25386 4.1972C3.62886 4.57173 4.13719 4.78211 4.6672 4.78211C5.1972 4.78211 5.70553 4.57173 6.08053 4.1972L9.14053 1.1372C9.2647 1.01229 9.33439 0.843323 9.33439 0.667199C9.33439 0.491075 9.2647 0.322107 9.14053 0.197199Z"
        fill="currentColor"
      />
    </svg>
  )
}
