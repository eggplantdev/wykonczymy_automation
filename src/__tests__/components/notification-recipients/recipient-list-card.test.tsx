import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'

const TITLE = 'Alerty techniczne'

function renderCard(props: { canEdit: boolean; emails: string[] }) {
  render(<RecipientListCard list="opsAlerts" title={TITLE} {...props} />)
}

describe('RecipientListCard', () => {
  it('offers no edit button to a reader who may not write', () => {
    renderCard({ canEdit: false, emails: ['ktos@wykonczymy.test'] })

    expect(screen.getByText('ktos@wykonczymy.test')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Edytuj listę: ${TITLE}` })).not.toBeInTheDocument()
  })

  it('offers it to an owner', () => {
    renderCard({ canEdit: true, emails: ['ktos@wykonczymy.test'] })

    expect(screen.getByRole('button', { name: `Edytuj listę: ${TITLE}` })).toBeInTheDocument()
  })

  it('says out loud that an empty stream will fail rather than rendering a blank list', () => {
    renderCard({ canEdit: true, emails: [] })

    expect(screen.getByText(/Nikt nie dostanie tych powiadomień/)).toBeInTheDocument()
  })
})
