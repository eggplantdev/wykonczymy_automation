'use client'

import { useEffect, useState } from 'react'

// Create AND revoke in the same effect so StrictMode's mount→cleanup→remount
// can't leave us holding URLs it already revoked.
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    if (files.length === 0) {
      // Drop the previous run's URLs — the cleanup already revoked them, and leaving them in state
      // would let a caller's pairing guard match new files against dead handles.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrls((previous) => (previous.length === 0 ? previous : []))
      return
    }
    const objectUrls = files.map((file) => URL.createObjectURL(file))

    setUrls(objectUrls)
    return () => objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  }, [files])
  return urls
}
