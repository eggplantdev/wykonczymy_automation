import { useRef } from 'react'

export function useInvoiceFiles(initialFiles?: Map<number, File>) {
  const invoiceFilesRef = useRef<Map<number, File>>(initialFiles ?? new Map())

  function handleRemoveLineItem(index: number, removeValue: (index: number) => void) {
    const oldFiles = invoiceFilesRef.current
    const newFiles = new Map<number, File>()
    oldFiles.forEach((file, i) => {
      if (i < index) newFiles.set(i, file)
      else if (i > index) newFiles.set(i - 1, file)
    })
    invoiceFilesRef.current = newFiles
    removeValue(index)
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) invoiceFilesRef.current.set(index, file)
    else invoiceFilesRef.current.delete(index)
  }

  function buildInvoiceFormData(): FormData | null {
    if (invoiceFilesRef.current.size === 0) return null
    const formData = new FormData()
    invoiceFilesRef.current.forEach((file, index) => {
      formData.set(`invoice-${index}`, file)
    })
    return formData
  }

  function getFiles(): Map<number, File> {
    return new Map(invoiceFilesRef.current)
  }

  return { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles }
}
