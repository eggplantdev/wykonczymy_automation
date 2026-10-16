import { Pencil } from 'lucide-react'
import { RowActionButton, type RowActionButtonPropsT } from './row-action-button'

export type EditButtonPropsT = Omit<RowActionButtonPropsT, 'icon' | 'tone' | 'label'> & {
  label?: string
}

export function EditButton({ label = 'Edytuj', text = 'Edytuj', ...props }: EditButtonPropsT) {
  return <RowActionButton icon={Pencil} label={label} text={text} {...props} />
}
