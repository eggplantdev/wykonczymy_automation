import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type AuthSubmitButtonPropsT = {
  isPending: boolean
  idleText: string
  pendingText: string
  successText?: string
  isSuccess?: boolean
}

export function AuthSubmitButton({
  isPending,
  idleText,
  pendingText,
  successText,
  isSuccess = false,
}: AuthSubmitButtonPropsT) {
  return (
    <Button
      type="submit"
      pending={isPending}
      disabled={isSuccess}
      className={cn(
        'mt-2 transition-colors duration-300',
        isSuccess && 'bg-green-600 hover:bg-green-600',
      )}
    >
      {isSuccess && successText ? (
        <>
          <Check />
          {successText}
        </>
      ) : isPending ? (
        pendingText
      ) : (
        idleText
      )}
    </Button>
  )
}
