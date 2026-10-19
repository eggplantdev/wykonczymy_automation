import { readFileSync } from 'node:fs'
import type { E2ESeedsT } from '@/scripts/seed-e2e-suite'
import { SEEDS_FILE } from '../global-setup'

export type { E2ESeedsT }

// Call it in `beforeAll`: the file does not exist until global setup has run.
export function readSeed<K extends keyof E2ESeedsT>(key: K): E2ESeedsT[K] {
  return (JSON.parse(readFileSync(SEEDS_FILE, 'utf8')) as E2ESeedsT)[key]
}
