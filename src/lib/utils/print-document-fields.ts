import { escapeHtml } from '@/lib/utils/escape-html'

// Markup for the `.fill` / `.line` classes in PRINT_DOCUMENT_BASE_STYLES.
export function fill(value: string): string {
  return `<span class="fill">${escapeHtml(value)}</span>`
}

export function line(label: string, value: string): string {
  return `<div class="line"><span>${escapeHtml(label)}</span>${fill(value)}</div>`
}
