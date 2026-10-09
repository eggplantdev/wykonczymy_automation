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
import { useSearchFilter } from '@/hooks/use-search-filter'
import {
  createCompanyKnowledgeAction,
  deleteCompanyKnowledgeAction,
  reorderCompanyKnowledgeAction,
  updateCompanyKnowledgeAction,
} from '@/lib/actions/company-knowledge'
import { fetchCompanyKnowledge } from '@/lib/queries/company-knowledge'
import { sameItems } from '@/lib/utils/same-items'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { FailureT } from '@/types/action'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

type DraftT = { id: number | null; topic: string; content: string }

type SortT = 'manual' | 'alpha' | 'recent'

const SORT_OPTIONS: { value: SortT; label: string }[] = [
  { value: 'manual', label: 'Własna kolejność' },
  { value: 'alpha', label: 'Alfabetycznie' },
  { value: 'recent', label: 'Ostatnio zmienione' },
]

const searchableText = (entry: CompanyKnowledgeEntryT) => `${entry.topic} ${entry.content}`

const isSort = (value: string): value is SortT =>
  SORT_OPTIONS.some((option) => option.value === value)

export function CompanyKnowledgeBook({
  initialEntries,
}: {
  initialEntries: CompanyKnowledgeEntryT[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [draft, setDraft] = useState<DraftT | null>(null)
  const [deleting, setDeleting] = useState<CompanyKnowledgeEntryT | null>(null)
  const [sort, setSort] = useState<SortT>('manual')
  const [dragOrder, setDragOrder] = useState<number[] | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const {
    filteredData: filtered,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(entries, searchableText)
  const isSearching = searchTerm.trim() !== ''

  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const sorted =
    sort === 'alpha'
      ? filtered.toSorted((a, b) => a.topic.localeCompare(b.topic, 'pl'))
      : sort === 'recent'
        ? filtered.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : filtered
  // A dragged position only means something against the whole list in its own order.
  const canReorder = sort === 'manual' && !isSearching
  const ids = dragOrder ?? sorted.map((entry) => entry.id)

  async function write(
    next: CompanyKnowledgeEntryT[],
    call: () => Promise<{ success: true } | FailureT>,
  ) {
    const previous = entries
    setEntries(next)
    const result = await settleAction(call)
    if (result.success) return result
    toastMessage(result.error, 'error', 4000)
    // Refused because its entry is gone: the list on screen is stale — another manager deleted it —
    // so the book is reloaded rather than put back with that entry still in it.
    const fresh =
      result.code === 'NOT_FOUND' ? await settleAction(() => fetchCompanyKnowledge()) : null
    setEntries(fresh?.success ? fresh.data : previous)
    return result
  }

  async function commitDrag() {
    if (!dragOrder) return
    setDragOrder(null)
    if (
      sameItems(
        dragOrder,
        entries.map((entry) => entry.id),
      )
    )
      return
    await write(
      dragOrder.flatMap((id) => byId.get(id) ?? []),
      () => reorderCompanyKnowledgeAction(dragOrder),
    )
  }

  async function save() {
    if (!draft) return
    const data = { topic: draft.topic.trim(), content: draft.content.trim() }
    if (!data.topic || !data.content) return
    const updatedAt = new Date().toISOString()
    const { id } = draft

    // Not optimistic: until the server answers there is no id to edit, delete or drag the entry by.
    if (id === null) {
      setIsCreating(true)
      const result = await settleAction(() => createCompanyKnowledgeAction(data))
      setIsCreating(false)
      if (!result.success) return toastMessage(result.error, 'error', 4000)
      setEntries((current) => [{ id: result.data.id, ...data, updatedAt }, ...current])
      setDraft(null)
      return
    }

    setDraft(null)
    const result = await write(
      entries.map((entry) => (entry.id === id ? { ...entry, ...data, updatedAt } : entry)),
      () => updateCompanyKnowledgeAction(id, data),
    )
    // The typed text comes back with the error, unless the entry it edits no longer exists.
    if (!result.success && result.code !== 'NOT_FOUND') setDraft(draft)
  }

  async function remove(entry: CompanyKnowledgeEntryT) {
    setDeleting(null)
    await write(
      entries.filter((existing) => existing.id !== entry.id),
      () => deleteCompanyKnowledgeAction(entry.id),
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
        pending={isCreating}
      />
    </div>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SearchFilterInput
          value={searchTerm}
          onChange={setSearchTerm}
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
          <EmptyState title={isSearching ? 'Nic nie pasuje do wyszukiwania' : 'Brak wpisów'} />
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
