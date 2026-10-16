import { useState } from 'react'
import { createLatestRequest } from '@/lib/utils/latest-request'

export function useLatestRequest() {
  const [request] = useState(createLatestRequest)
  return request
}
