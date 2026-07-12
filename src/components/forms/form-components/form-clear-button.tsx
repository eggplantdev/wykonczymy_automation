import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFormContext } from '../hooks/form-hooks'

type FormClearButtonPropsT = {
  onReset?: () => void
}

export function FormClearButton({ onReset }: FormClearButtonPropsT) {
  const form = useFormContext()

  function handleClear() {
    form.reset()
    onReset?.()
  }

  return (
    <Button
      type="button"
      variant="blue"
      size="sm"
      // Float top-right beside the dialog's X (right-2, ~48px box) — anchored to the fixed
      // DialogContent, no positioned ancestor in between.
      className="absolute top-4 right-14 z-10"
      onClick={handleClear}
    >
      <RotateCcw className="size-3.5" />
      Wyczyść formularz
    </Button>
  )
}
