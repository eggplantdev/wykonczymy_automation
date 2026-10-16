import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { LaunchOptions } from '@playwright/test'

// Playwright resolves `executablePath` against the process's working directory, so a relative path
// silently picks a non-existent binary the moment the run starts anywhere but the repo root.
const SHIM = fileURLToPath(new URL('chrome-arm64.sh', import.meta.url))

// `process.arch` is the WRONG gate: pnpm ships here as the x64 build, so the Node running this file
// reports `x64` on the very Apple Silicon machine the shim exists for.
const useShim = process.platform === 'darwin' && existsSync(SHIM)

export const chromeLaunchOptions: LaunchOptions = useShim
  ? { executablePath: SHIM }
  : { channel: 'chrome' }
