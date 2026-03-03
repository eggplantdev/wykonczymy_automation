import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES, type RoleT } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import {
  fetchReferenceData,
  fetchInvestmentFinancials,
  fetchRegisterBalances,
  fetchWorkerSaldos,
} from '@/lib/queries/reference-data'
import { formatPLN } from '@/lib/format-currency'
import { TRANSFER_EXPORT_COLUMNS, EXPORT_EXCLUDED_COLUMNS } from '@/lib/export/transfer-columns'
import { PrintTrigger } from '@/components/transfers/print-trigger'
import type { Where } from 'payload'
import type { ExportContextT, HeaderFieldT } from '@/types/export'

const VALID_CONTEXTS = new Set<ExportContextT>(['investment', 'register', 'worker'])

type SearchParamsT = Promise<Record<string, string | string[] | undefined>>

export default async function PrintTransfersPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) notFound()
  const { user } = session

  const sp = await searchParams
  const context = typeof sp.context === 'string' ? sp.context : undefined
  const contextId = typeof sp.contextId === 'string' ? Number(sp.contextId) : undefined
  const whereBase64 = typeof sp.where === 'string' ? sp.where : undefined
  const columnsParam = typeof sp.columns === 'string' ? sp.columns : undefined

  if (!context || !VALID_CONTEXTS.has(context as ExportContextT) || !contextId || !whereBase64) {
    notFound()
  }

  let where: Where
  try {
    const decoded = atob(whereBase64)
    where = JSON.parse(decoded) as Where
  } catch {
    notFound()
  }

  // Determine visible columns
  const visibleColumnIds = columnsParam
    ? columnsParam
        .split(',')
        .filter((id) => !EXPORT_EXCLUDED_COLUMNS.has(id) && TRANSFER_EXPORT_COLUMNS[id])
    : Object.keys(TRANSFER_EXPORT_COLUMNS)

  const printableColumns = visibleColumnIds.map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  // Fetch transfers + header fields in parallel where possible
  const [rows, refData] = await Promise.all([fetchAllTransferRows(where), fetchReferenceData()])

  const headerFields = await buildHeaderFields(
    context as ExportContextT,
    contextId,
    refData,
    user.role,
  )

  return (
    <div className="mx-auto max-w-[210mm] p-8 print:p-16">
      <PrintTrigger headerFields={headerFields} />

      {/* Header fields */}
      {headerFields.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {headerFields.map((field) => (
            <div key={field.label} data-stat={field.label}>
              <span className="text-muted-foreground">{field.label}: </span>
              <span className="font-medium">{field.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transfer table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b">
              {printableColumns.map((col) => (
                <th key={col.id} className="px-2 py-1.5 text-left font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                {printableColumns.map((col) => (
                  <td
                    key={col.id}
                    className={`px-2 py-1 ${row.cancelled ? 'line-through opacity-50' : ''}`}
                  >
                    {col.getValue(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={printableColumns.length}
                  className="text-muted-foreground px-2 py-4 text-center"
                >
                  Brak transferów
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function buildHeaderFields(
  context: ExportContextT,
  contextId: number,
  refData: Awaited<ReturnType<typeof fetchReferenceData>>,
  userRole: RoleT,
): Promise<HeaderFieldT[]> {
  switch (context) {
    case 'investment': {
      const investment = refData.investments.find((inv) => inv.id === contextId)
      if (!investment) return []

      const fields: HeaderFieldT[] = [{ label: 'Inwestycja', value: investment.name }]

      if (isAdminOrOwnerRole(userRole)) {
        const financials = await fetchInvestmentFinancials()
        const fin = financials[String(contextId)]
        const totalCosts = fin?.totalCosts ?? 0
        const totalIncome = fin?.totalIncome ?? 0
        const laborCosts = investment.laborCosts ?? 0

        fields.push(
          { label: 'Koszty inwestycji', value: formatPLN(totalCosts) },
          { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome) },
          { label: 'Koszty robocizny', value: formatPLN(laborCosts) },
          { label: 'Bilans', value: formatPLN(totalIncome - totalCosts - laborCosts) },
        )
      }

      return fields
    }

    case 'register': {
      const register = refData.cashRegisters.find((cr) => cr.id === contextId)
      if (!register) return []

      const balances = await fetchRegisterBalances()
      const balance = balances[String(contextId)] ?? 0
      const ownerName = register.ownerId
        ? (refData.workers.find((w) => w.id === register.ownerId)?.name ?? '—')
        : '—'

      return [
        { label: 'Kasa', value: register.name },
        { label: 'Właściciel', value: ownerName },
        { label: 'Saldo', value: formatPLN(balance) },
      ]
    }

    case 'worker': {
      const worker = refData.workers.find((w) => w.id === contextId)
      if (!worker) return []

      const saldos = await fetchWorkerSaldos()
      const saldo = saldos[String(contextId)] ?? 0

      return [
        { label: 'Pracownik', value: worker.name },
        { label: 'Saldo', value: formatPLN(saldo) },
      ]
    }
  }
}
