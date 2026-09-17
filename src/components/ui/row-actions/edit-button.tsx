import { Pencil } from 'lucide-react'
import { RowActionButton, type RowActionButtonPropsT } from './row-action-button'

export type EditButtonPropsT = Omit<RowActionButtonPropsT, 'icon' | 'tone' | 'label'> & {
  label?: string
}

// Keep `label` specific („Edytuj inwestycję") — it is the tooltip, and a row holds several actions
// that all read „Edytuj" otherwise.
export function EditButton({ label = 'Edytuj', text = 'Edytuj', ...props }: EditButtonPropsT) {
  return <RowActionButton icon={Pencil} label={label} text={text} {...props} />
}
