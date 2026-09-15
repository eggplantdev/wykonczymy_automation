import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'

// EX-741's two remaining legs, neither of which needs a browser.
//
// Reading the lists is `MANAGEMENT_ROLES` and writing them is owner/admin, so a MANAGER lands on a
// card with `canEdit={false}`. The action refuses them anyway — that half is unit-tested — so what is
// left is whether the card offers a door that leads nowhere, and that is one render.
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
    // A stream with nobody in it makes its sender throw. An empty `<ul>` would read as „nothing to
    // see here" — the one reading that is wrong.
    renderCard({ canEdit: true, emails: [] })

    expect(screen.getByText(/Nikt nie dostanie tych powiadomień/)).toBeInTheDocument()
  })
})
