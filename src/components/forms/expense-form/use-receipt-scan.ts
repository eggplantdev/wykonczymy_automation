'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  FILE_DRAG_ARMED_CLASS,
  FILE_DRAG_OVER_CLASS,
  useWindowFileDrag,
} from '@/hooks/use-window-file-drag'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
import {
  isBlankRow,
  type BulkExpenseFormValuesT,
  type BulkLineItemT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ArrayFieldT } from '@/components/forms/hooks/form-api-of'

export type LineItemsArrayFieldT = ArrayFieldT<BulkExpenseFormValuesT['lineItems'][number]>

// The raw browser type, not ALLOWED_UPLOAD_MIMES: this runs before ingest re-encodes e.g. a BMP to
// PNG, so the upload allowlist would refuse files ingest can fix.
const isReceiptFile = (file: File) =>
  file.type.startsWith('image/') || file.type === 'application/pdf'

type OptionsT = {
  newItem: () => BulkLineItemT
  getRowFiles: (id: string) => File[] | undefined
  onRegisterFiles: (ids: string[], files: File[], mode?: 'per-row' | 'single-row') => Promise<void>
  onGenerate?: () => void
  isBusy: boolean
}

export function useReceiptScan({
  newItem,
  getRowFiles,
  onRegisterFiles,
  onGenerate,
  isBusy,
}: OptionsT) {
  const scanInputRef = useRef<HTMLInputElement>(null)
  const isFileDragActive = useWindowFileDrag()
  const [dragOverMode, setDragOverMode] = useState<ScanModeT | null>(null)
  const [scanMode, setScanMode] = useState<ScanModeT>('one-per-photo')

  async function scanReceipts(
    picked: File[],
    lineItemsField: LineItemsArrayFieldT,
    mode: ScanModeT,
  ) {
    const rows = lineItemsField.state.value
    const reuseFirstRow = rows.length === 1 && isBlankRow(rows[0]) && !getRowFiles(rows[0].id)
    const rowCount = mode === 'one-invoice' ? 1 : picked.length
    const newRows = Array.from({ length: reuseFirstRow ? rowCount - 1 : rowCount }, () => newItem())
    for (const row of newRows) lineItemsField.pushValue(row)
    const ids = (reuseFirstRow ? [rows[0], ...newRows] : newRows).map((row) => row.id)
    await onRegisterFiles(ids, picked, mode === 'one-invoice' ? 'single-row' : 'per-row')
    onGenerate?.()
  }

  function handleScanReceipts(
    e: React.ChangeEvent<HTMLInputElement>,
    lineItemsField: LineItemsArrayFieldT,
  ) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same files after a reset
    if (picked.length === 0) return
    return scanReceipts(picked, lineItemsField, scanMode)
  }

  function handleDropReceipts(
    e: React.DragEvent,
    lineItemsField: LineItemsArrayFieldT,
    mode: ScanModeT,
  ) {
    e.preventDefault()
    setDragOverMode(null)
    if (isBusy) return
    const picked = Array.from(e.dataTransfer.files).filter(isReceiptFile)
    if (picked.length === 0) return
    return scanReceipts(picked, lineItemsField, mode)
  }

  function dropZoneProps(lineItemsField: LineItemsArrayFieldT) {
    const mode = scanMode
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        setDragOverMode(mode)
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault()
        // The icon and label are inside the button, so crossing them fires a leave that is not one.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragOverMode(null)
      },
      onDrop: (e: React.DragEvent) => handleDropReceipts(e, lineItemsField, mode),
      className: cn(
        isFileDragActive && dragOverMode !== mode && !isBusy && FILE_DRAG_ARMED_CLASS,
        dragOverMode === mode && FILE_DRAG_OVER_CLASS,
      ),
    }
  }

  return { scanInputRef, scanMode, setScanMode, handleScanReceipts, dropZoneProps }
}
