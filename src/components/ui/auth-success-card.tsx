import { Check } from 'lucide-react'
import { Panel } from '@/components/ui/panel'

type AuthSuccessCardPropsT = {
  message: string
}

export function AuthSuccessCard({ message }: AuthSuccessCardPropsT) {
  return (
    <Panel className="flex flex-col items-center gap-2 p-6">
      <Check className="text-chart-green size-8" />
      <p className="text-foreground text-center text-sm">{message}</p>
    </Panel>
  )
}
