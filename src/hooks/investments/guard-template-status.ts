import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

export const TEMPLATE_STATUS_CHANGE_MESSAGE =
  'Statusu „szablon" nie da się nadać ani zdjąć — szablon zakłada się i usuwa na liście szablonów.'

const isTemplate = (status: string | undefined) => status === TEMPLATE_INVESTMENT_STATUS

/**
 * A szablon's kosztorys is a template the pickers copy from, so an investment turned into one would
 * leak a client's rozpiska into every new offer — and a szablon turned into an investment would take
 * bookings against a template. Here rather than in the action because `/admin` can update status too.
 *
 * `create` passes: a szablon is born only through `createTemplate`.
 */
export const guardTemplateStatus: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  const nextStatus = (data as { status?: string }).status
  if (operation !== 'update' || nextStatus === undefined) return data

  const wasTemplate = isTemplate((originalDoc as { status?: string } | undefined)?.status)
  if (wasTemplate !== isTemplate(nextStatus)) {
    throw new APIError(TEMPLATE_STATUS_CHANGE_MESSAGE, 400)
  }
  return data
}
