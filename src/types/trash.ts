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
  mustTypeName: boolean
}

export type DeleteForeverResultT =
  | { ok: true }
  | { ok: false; reason: 'not-trashed' | 'blocked' | 'error'; message: string }
