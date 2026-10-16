import { Slash, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

export function planeIcon(plane: ToolPlaneT, className = ''): ReactNode {
  if (plane === 'w_tools') return <Wrench className={className} />
  return (
    // `shrink-0`: as a plain flex child beside a long wrapping label it gets squeezed to nothing, and the
    // crossed wrench vanishes
    <span className="relative inline-flex shrink-0">
      <Wrench className={className} />
      <Slash className="absolute inset-0" />
      <Slash className="absolute inset-0 -scale-x-100" />
    </span>
  )
}
