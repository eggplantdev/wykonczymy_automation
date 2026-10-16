export function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ._-]/g, '')
    .replace(/-{2,}/g, '-')
}
