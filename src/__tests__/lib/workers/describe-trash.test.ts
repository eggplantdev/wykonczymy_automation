import { describe, it, expect } from 'vitest'
import { describeWorkerTrash } from '@/lib/workers/describe-trash'

describe('describeWorkerTrash', () => {
  it('names the one kasa that goes to the trash with the worker', () => {
    expect(describeWorkerTrash('Jan', ['Kasa Jana'])).toBe(
      'Przenieść „Jan" do kosza? Nie zaloguje się, dopóki go nie przywrócisz. Razem z nim kasa: Kasa Jana.',
    )
  })

  it('lists every kasa and says nothing about kasy when there are none', () => {
    expect(describeWorkerTrash('Jan', ['A', 'B'])).toContain('Razem z nim kasy: A, B.')
    expect(describeWorkerTrash('Jan', [])).toBe(
      'Przenieść „Jan" do kosza? Nie zaloguje się, dopóki go nie przywrócisz.',
    )
  })
})
