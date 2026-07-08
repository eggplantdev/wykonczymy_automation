/** Strip characters that break URLs, file systems, or Payload validation. */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ._-]/g, '')
    .replace(/-{2,}/g, '-')
}
