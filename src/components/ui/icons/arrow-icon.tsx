import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { iconVariants } from './icon-variants'

type DirectionT = 'up' | 'down' | 'left' | 'right'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
  direction: DirectionT
}

const rotations: Record<DirectionT, string> = {
  up: '0deg',
  right: '90deg',
  down: '180deg',
  left: '270deg',
}

export default function ArrowIcon({ size, className, direction }: PropsT) {
  return (
    <svg
      data-slot="icon"
      data-icon="arrow"
      // data-size={size}
      className={cn('transition-transform', className)}
      style={{ transform: `rotate(${rotations[direction]})` }}
      viewBox="0 0 8.0009 9.99439"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.80719 3.24772L4.94053 0.387724C4.69071 0.139389 4.35278 0 4.00053 0C3.64828 0 3.31035 0.139389 3.06053 0.387724L0.193862 3.24772C0.0696944 3.37263 0 3.5416 0 3.71772C0 3.89385 0.0696944 4.06282 0.193862 4.18772C0.255837 4.25021 0.329571 4.29981 0.41081 4.33365C0.49205 4.3675 0.579187 4.38492 0.667195 4.38492C0.755203 4.38492 0.84234 4.3675 0.92358 4.33365C1.00482 4.29981 1.07855 4.25021 1.14053 4.18772L3.33386 1.99439V9.32772C3.33386 9.50453 3.4041 9.6741 3.52912 9.79913C3.65415 9.92415 3.82372 9.99439 4.00053 9.99439C4.17734 9.99439 4.34691 9.92415 4.47193 9.79913C4.59696 9.6741 4.6672 9.50453 4.6672 9.32772V1.99439L6.86053 4.18772C6.98518 4.31326 7.1546 4.38414 7.3315 4.38476C7.50841 4.38539 7.67833 4.31571 7.80386 4.19106C7.9294 4.06641 8.00027 3.89699 8.0009 3.72008C8.00152 3.54317 7.93185 3.37326 7.80719 3.24772Z"
        fill="currentColor"
      />
    </svg>
  )
}
