import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FormClearButtonPropsT = {
  onReset: () => void
}

export function FormClearButton({ onReset }: FormClearButtonPropsT) {
  return (
    <Button
      type="button"
      variant="blue"
      size="sm"
      // Float top-right beside the dialog's X (right-2, ~48px box) — anchored to the fixed
      // DialogContent, no positioned ancestor in between. Icon-only below sm: with the label
      // it reaches ~180px into a phone-width dialog and lands on the title.
      className="absolute top-4 right-14 z-10 max-sm:size-9 max-sm:p-0"
      onClick={onReset}
      title="Wyczyść formularz"
    >
      <RotateCcw className="size-3.5" />
      <span className="max-sm:hidden">Wyczyść formularz</span>
    </Button>
  )
}
