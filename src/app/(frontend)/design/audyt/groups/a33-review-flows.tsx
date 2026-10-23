'use client'

import { A33AcceptGroup } from './a33-review-flows-accept'
import { A33BulkGroup } from './a33-review-flows-bulk'
import { A33EmptyGroup } from './a33-review-flows-empty'
import { A33FiltersGroup } from './a33-review-flows-filters'
import { A33HeaderGroup } from './a33-review-flows-header'
import { A33MessagesGroup } from './a33-review-flows-messages'
import { A33RejectGroup } from './a33-review-flows-reject'
import { A33RowActionsGroup } from './a33-review-flows-row-actions'
import { A33ScreensGroup } from './a33-review-flows-screens'
import { A33StatusGroup } from './a33-review-flows-status'
import { A33StepsGroup } from './a33-review-flows-steps'
import { A33TableGroup } from './a33-review-flows-table'
import { A33UndoGroup } from './a33-review-flows-undo'

export function A33ReviewFlowsGroup() {
  return (
    <>
      <A33ScreensGroup />
      <A33HeaderGroup />
      <A33AcceptGroup />
      <A33RejectGroup />
      <A33BulkGroup />
      <A33TableGroup />
      <A33RowActionsGroup />
      <A33StatusGroup />
      <A33EmptyGroup />
      <A33MessagesGroup />
      <A33StepsGroup />
      <A33FiltersGroup />
      <A33UndoGroup />
    </>
  )
}
