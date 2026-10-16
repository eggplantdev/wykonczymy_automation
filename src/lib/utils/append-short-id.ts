import { randomId } from '@/lib/utils/random-id'

export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' }
}

export function appendShortId(base: string, ext: string): string {
  // the blob store runs without a random suffix, so a repeated name overwrites an existing file's bytes
  const shortId = randomId().replace(/-/g, '').slice(0, 12)
  return `${base}-${shortId}${ext}`
}
