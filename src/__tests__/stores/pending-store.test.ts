import { describe, it, expect, beforeEach } from 'vitest'
import { usePendingStore, firstPendingLabel } from '@/stores/pending-store'

function reset() {
  usePendingStore.setState({ pending: new Map() })
}

describe('pending store', () => {
  beforeEach(reset)

  it('stays pending until the last key stops', () => {
    const { start, stop } = usePendingStore.getState()
    start('settings', 'Zapisywanie…')
    start('receipts', 'Odczytywanie paragonów…')

    stop('settings')
    expect(firstPendingLabel(usePendingStore.getState().pending)).toBe('Odczytywanie paragonów…')

    stop('receipts')
    expect(firstPendingLabel(usePendingStore.getState().pending)).toBeUndefined()
  })

  it('shows the first still-pending label, not the newest', () => {
    const { start } = usePendingStore.getState()
    start('settings', 'Zapisywanie…')
    start('receipts', 'Odczytywanie paragonów…')

    expect(firstPendingLabel(usePendingStore.getState().pending)).toBe('Zapisywanie…')
  })

  it('ignores a stop for a key that is not pending', () => {
    usePendingStore.getState().start('settings', 'Zapisywanie…')

    expect(() => usePendingStore.getState().stop('receipts')).not.toThrow()
    expect(firstPendingLabel(usePendingStore.getState().pending)).toBe('Zapisywanie…')
  })

  it('replaces the label of a live key without moving it in the order', () => {
    const { start } = usePendingStore.getState()
    start('settings', 'Zapisywanie…')
    start('receipts', 'Odczytywanie paragonów…')
    start('settings', 'Zapisywanie ustawień…')

    expect(firstPendingLabel(usePendingStore.getState().pending)).toBe('Zapisywanie ustawień…')
  })

  it('replaces the map rather than mutating it, so subscribers re-render', () => {
    const before = usePendingStore.getState().pending
    usePendingStore.getState().start('settings', 'Zapisywanie…')

    expect(usePendingStore.getState().pending).not.toBe(before)
  })
})
