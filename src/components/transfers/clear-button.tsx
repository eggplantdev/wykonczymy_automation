import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ClearButtonPropsT = {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}

export function ClearButton({ onClick, disabled, children }: ClearButtonPropsT) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-40 justify-start gap-1.5"
      onClick={onClick}
      disabled={disabled}
    >
      <X className="size-4" />
      {children}
    </Button>
  )
}
