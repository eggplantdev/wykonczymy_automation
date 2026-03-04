'use client'

import { Loader } from '@/components/ui/loader/loader'

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader loading={true} />
    </div>
  )
}
