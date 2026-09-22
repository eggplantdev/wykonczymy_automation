/** Returns a Polish error message, or `''` when the picked file is usable. */
export function validateUploadFile(file: File): string {
  const name = file.name?.trim()
  if (!name) return 'Plik nie ma nazwy'
  if (!file.type) return 'Nierozpoznany typ pliku'
  if (file.size === 0) return 'Plik jest pusty'
  return ''
}
