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
    <Button type="button" variant="blue" size="sm" className="mb-4" onClick={handleClear}>
      <RotateCcw className="size-3.5" />
      Wyczyść formularz
    </Button>
  )
}
