/** Cytuje komórkę CSV gdy zawiera przecinek, cudzysłów lub nową linię (RFC 4180). */
export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
