import { ReactNode } from 'react'
import { FixedClientLoader } from './fixed-client-loader'
import { Spinner } from './spinner'
import { cn } from '@/lib/cn'

export type PropsT = {
  loading: boolean
  loaderComponent?: ReactNode
  className?: string
  portal?: boolean
  // spinnerVariant?: 'black' | 'white'
}

export const Loader = ({
  loading,
  loaderComponent,
  className,
  portal,
  // spinnerVariant = 'black',
}: PropsT) => {
  if (!loading) return null

  const spinner = loaderComponent ? (
    <div className={`animate-bounce`}>{loaderComponent}</div>
  ) : (
    <p className="animate-bounce text-3xl font-semibold lg:text-5xl">🚧</p>
  )

  const comp = (
    <div
      id="loader"
      className={cn(
        `pointer-events-none fixed inset-0 z-100000000 flex items-center justify-center`,
        className,
      )}
    >
      {spinner}
    </div>
  )

  if (portal) return <FixedClientLoader>{comp}</FixedClientLoader>

  return comp
}
