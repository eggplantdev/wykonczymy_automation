import { Check } from 'lucide-react'

type AuthSuccessCardPropsT = {
  message: string
}

export function AuthSuccessCard({ message }: AuthSuccessCardPropsT) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border p-6">
      <Check className="text-green-600" size={32} />
      <p className="text-foreground text-center text-sm">{message}</p>
    </div>
  )
}
