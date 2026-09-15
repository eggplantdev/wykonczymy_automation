import { Trash2 } from 'lucide-react'
import { RowActionButton, type RowActionButtonPropsT } from './row-action-button'

export type DeleteButtonPropsT = Omit<RowActionButtonPropsT, 'icon' | 'tone' | 'label'> & {
  label?: string
}

// „Usuń", everywhere. Deleting is destructive but not loud: the confirm dialog carries the warning,
// so the button stays a quiet ghost until hovered rather than shouting red from every row.
export function DeleteButton({ label = 'Usuń', text = 'Usuń', ...props }: DeleteButtonPropsT) {
  return <RowActionButton icon={Trash2} label={label} text={text} tone="destructive" {...props} />
}
