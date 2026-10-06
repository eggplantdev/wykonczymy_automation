import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkerInvestmentsSection } from '@/components/users/worker-investments-section'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów', token: 'abc' }] as WorkerStageInvestmentT[]

const section = (canReport: boolean) => (
  <WorkerInvestmentsSection
    investments={INVESTMENTS}
    workerName="Jan"
    canReport={canReport}
    locale="pl"
  />
)

describe('WorkerInvestmentsSection report link', () => {
  it('is offered on the worker’s own page', () => {
    render(section(true))

    expect(screen.getByRole('link', { name: 'Zgłoś prace' })).toBeInTheDocument()
  })

  it('is withheld from anyone else viewing his page', () => {
    render(section(false))

    expect(screen.getByText('Mokotów')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Zgłoś prace' })).not.toBeInTheDocument()
  })
})
