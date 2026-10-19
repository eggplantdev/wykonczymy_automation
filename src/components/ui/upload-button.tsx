'use client'

import { Loader2, Plus } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'

type UploadButtonPropsT = {
  label: string
  isUploading: boolean
  onClick: () => void
} & Pick<ButtonPropsT, 'size' | 'className'>

export function UploadButton({ label, isUploading, onClick, size, className }: UploadButtonPropsT) {
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
