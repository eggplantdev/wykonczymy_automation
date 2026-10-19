export type TrashKindT =
  | 'investment'
  | 'template'
  | 'cash-register'
  | 'worker'
  | 'vehicle'
  | 'equipment'
  | 'lead'
  | 'file'

export type TrashRowT = {
  kind: TrashKindT
  id: number
  name: string
  trashedAt: Date
  /** Whole days until the cron purges it; meaningless when `autoPurges` is false. */
  daysLeft: number
  /** False for an investment whose kosztorys was used — only a manual delete removes it. */
  autoPurges: boolean
  hasSheet: boolean
  pairedRegisters: string[]
  detail?: string
  /** Set when restoring would put the row back into something that is itself in the trash. */
  restoreBlockedReason?: string
}

export type DeleteForeverResultT =
  | { ok: true }
  | { ok: false; reason: 'not-trashed' | 'blocked' | 'error'; message: string }
