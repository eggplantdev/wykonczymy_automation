'use client'

import { Loader2, Plus } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'

type UploadButtonPropsT = {
  label: string
  // Drives the LABEL, so it must stay narrow: a surface that also withholds the picker during an
  // unrelated removal passes that through `disabled`, or the button announces „Przesyłanie…" for it.
  isUploading: boolean
  disabled?: boolean
  onClick: () => void
} & Pick<ButtonPropsT, 'size' | 'className'>

/** The spinner is the only feedback a slow HEIC convert gives. */
export function UploadButton({
  label,
  isUploading,
  disabled,
  onClick,
  size,
  className,
}: UploadButtonPropsT) {
  return (
    <Button
      type="button"
      variant="outline"
      align="start"
      size={size}
      disabled={isUploading || disabled}
      onClick={onClick}
      className={className}
    >
      {isUploading ? <Loader2 className="animate-spin" /> : <Plus />}
      {isUploading ? 'Przesyłanie...' : label}
    </Button>
  )
}
