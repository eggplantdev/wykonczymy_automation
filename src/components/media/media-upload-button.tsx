'use client'

import { Loader2, Plus } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'

type MediaUploadButtonPropsT = {
  label: string
  isUploading: boolean
  onClick: () => void
} & Pick<ButtonPropsT, 'size' | 'className'>

/** Opens the picker; the spinner is the only feedback a slow HEIC convert gives. */
export function MediaUploadButton({
  label,
  isUploading,
  onClick,
  size,
  className,
}: MediaUploadButtonPropsT) {
  return (
    <Button
      type="button"
      variant="outline"
      align="start"
      size={size}
      disabled={isUploading}
      onClick={onClick}
      className={className}
    >
      {isUploading ? <Loader2 className="animate-spin" /> : <Plus />}
      {isUploading ? 'Przesyłanie...' : label}
    </Button>
  )
}
