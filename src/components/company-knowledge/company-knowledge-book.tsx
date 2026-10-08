'use client'

import { Reorder, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { KnowledgeEntryRow } from '@/components/company-knowledge/knowledge-entry-row'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import {
  createCompanyKnowledgeAction,
  deleteCompanyKnowledgeAction,
  reorderCompanyKnowledgeAction,
  updateCompanyKnowledgeAction,
} from '@/lib/actions/company-knowledge'
import { foldText } from '@/lib/utils/fold-text'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

type DraftT = { id: number | null; topic: string; content: string }
type SortT = 'manual' | 'alpha' | 'recent'

const SORT_OPTIONS = [
  { value: 'manual', label: 'Własna kolejność' },
  { value: 'alpha', label: 'Alfabetycznie' },
  { value: 'recent', label: 'Ostatnio zmienione' },
]

const isSort = (value: string): value is SortT =>
  SORT_OPTIONS.some((option) => option.value === value)

// Every write shows at once; a refused one puts the list back as it was before it.
export function CompanyKnowledgeBook({
  initialEntries,
}: {
  initialEntries: CompanyKnowledgeEntryT[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [draft, setDraft] = useState<DraftT | null>(null)
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<CompanyKnowledgeEntryT | null>(null)
  const [sort, setSort] = useState<SortT>('manual')
  // Order shown while a drag is in flight; committed on drop.
  const [dragOrder, setDragOrder] = useState<number[] | null>(null)

  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const needle = foldText(query.trim())
  const filtered = needle
    ? entries.filter((entry) => foldText(`${entry.topic} ${entry.content}`).includes(needle))
    : entries
  const sorted =
    sort === 'alpha'
      ? filtered.toSorted((a, b) => a.topic.localeCompare(b.topic, 'pl'))
      : sort === 'recent'
        ? filtered.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : filtered
  // A dragged position only means something against the whole list in its own order.
  const canReorder = sort === 'manual' && !needle
  const ids = dragOrder ?? sorted.map((entry) => entry.id)

  async function write(
    next: CompanyKnowledgeEntryT[],
    call: () => Promise<{ success: boolean; error?: string }>,
    failure: string,
  ) {
    const previous = entries
    setEntries(next)
    const result = await settleAction(call)
    if (result.success) return true
    setEntries(previous)
    toastMessage(result.error ?? failure, 'error', 4000)
    return false
  }

  async function commitDrag() {
    if (!dragOrder) return
    const order = dragOrder
    setDragOrder(null)
    if (order.every((id, index) => entries[index]?.id === id)) return
    await write(
      order.flatMap((id) => byId.get(id) ?? []),
      () => reorderCompanyKnowledgeAction(order),
      'Nie udało się zapisać kolejności',
    )
  }

  async function save() {
    if (!draft) return
    const data = { topic: draft.topic.trim(), content: draft.content.trim() }
    if (!data.topic || !data.content) return
    const updatedAt = new Date().toISOString()
    setDraft(null)

    if (draft.id === null) {
      const previous = entries
      const tempId = -Date.now()
      setEntries([{ id: tempId, ...data, updatedAt }, ...entries])
      const result = await settleAction(() => createCompanyKnowledgeAction(data))
      if (!result.success) {
        setEntries(previous)
        toastMessage(result.error ?? 'Nie udało się dodać wpisu', 'error', 4000)
        return
      }
      const { id } = result.data
      setEntries((current) =>
        current.map((entry) => (entry.id === tempId ? { ...entry, id } : entry)),
      )
      return
    }

    const id = draft.id
    await write(
      entries.map((entry) => (entry.id === id ? { ...entry, ...data, updatedAt } : entry)),
      () => updateCompanyKnowledgeAction(id, data),
      'Nie udało się zapisać wpisu',
    )
  }

  async function remove(entry: CompanyKnowledgeEntryT) {
    setDeleting(null)
    await write(
      entries.filter((existing) => existing.id !== entry.id),
      () => deleteCompanyKnowledgeAction(entry.id),
      'Nie udało się usunąć wpisu',
    )
  }

  const form = draft && (
    <div className="flex flex-col gap-2">
      <Input
        value={draft.topic}
        onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
        placeholder="Temat"
        autoFocus
      />
      <Textarea
        value={draft.content}
        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
        placeholder="Treść"
        rows={4}
      />
      <DialogActions
        confirmLabel="Zapisz"
        onConfirm={save}
        onCancel={() => setDraft(null)}
        confirmDisabled={!draft.topic.trim() || !draft.content.trim()}
      />
    </div>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SearchFilterInput
          value={query}
          onChange={setQuery}
          placeholder="Szukaj w tematach i treści"
          className="min-w-48 flex-1"
        />
        <SimpleSelect
          value={sort}
          onValueChange={(value) => isSort(value) && setSort(value)}
          options={SORT_OPTIONS}
          variant="toolbar"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={draft?.id === null}
          onClick={() => setDraft({ id: null, topic: '', content: '' })}
        >
          <Plus />
          Dodaj wpis
        </Button>
      </div>
      {draft?.id === null && <div className="border-border rounded-md border p-3">{form}</div>}
      {!canReorder && (
        <p className="text-muted-foreground text-xs">
          Przeciąganie działa w „Własnej kolejności”, bez wyszukiwania.
        </p>
      )}
      <motion.div layoutScroll className="min-h-0 overflow-y-auto">
        {sorted.length === 0 ? (
          <EmptyState title={needle ? 'Nic nie pasuje do wyszukiwania' : 'Brak wpisów'} />
        ) : (
          <Reorder.Group
            axis="y"
            values={ids}
            onReorder={setDragOrder}
            className="flex list-none flex-col gap-2"
          >
            {ids.map((id) => {
              const entry = byId.get(id)
              if (!entry) return null
              return (
                <KnowledgeEntryRow
                  key={id}
                  entry={entry}
                  draggable={canReorder && draft === null}
                  onDragEnd={commitDrag}
                  onEdit={() => setDraft(entry)}
                  onDelete={() => setDeleting(entry)}
                  editor={draft?.id === id ? form : undefined}
                />
              )
            })}
          </Reorder.Group>
        )}
      </motion.div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Usunąć wpis „${deleting?.topic ?? ''}”?`}
        confirmLabel="Usuń"
        onConfirm={() => {
          if (deleting) remove(deleting)
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
