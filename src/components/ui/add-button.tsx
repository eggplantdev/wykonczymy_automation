import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'

type AddButtonPropsT = Omit<ButtonPropsT, 'variant' | 'size'> & {
  icon?: ReactNode
}

export function AddButton({ icon = <Plus />, children, ...props }: AddButtonPropsT) {
  return (
    <Button variant="outline" size="sm" {...props}>
      {icon}
      {children}
    </Button>
  )
}
