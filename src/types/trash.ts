export type TrashKindT = 'investment' | 'template' | 'cash-register'

export type TrashRowT = {
  kind: TrashKindT
  id: number
  name: string
  trashedAt: Date
  /** Whole days until the cron purges it; meaningless when `autoPurges` is false. */
  daysLeft: number
  /** False for an investment whose kosztorys was used — only a manual delete removes it. */
  autoPurges: boolean
  /** The delete-forever dialog asks for the typed name before it lets the delete through. */
  mustTypeName: boolean
}
