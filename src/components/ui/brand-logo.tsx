import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

const LOGO_ASPECT = 360 / 280

type PropsT = {
  height: number
  className?: string
  priority?: boolean
}

export function BrandLogo({ height, className, priority }: PropsT) {
  return (
    <Image
      src="/logo-wykonczymy.png"
      alt="Wykończymy"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority={priority}
      // Both axes auto, never a pinned height: preflight's `img { max-width: 100% }` clamps the
      // width in a narrow container, and a fixed height would hold while the width shrank — squashing the mark.
      className={cn('h-auto w-auto', className)}
    />
  )
}
