import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { LaunchOptions } from '@playwright/test'

// Every browser this suite starts goes through here — the Playwright projects, and global-setup's
// own launch for the storageState capture. On macOS that means the shim, which pins Chrome to
// ARM64; `e2e/chrome-arm64.sh` explains why a translated renderer is not merely slower but the
// difference between a green suite and a red one.
//
// Resolved off this file's own URL, not the CWD: Playwright resolves `executablePath` against the
// process's working directory, so a relative path silently picks a non-existent binary the moment
// the run starts anywhere but the repo root.
const SHIM = fileURLToPath(new URL('chrome-arm64.sh', import.meta.url))

// `process.arch` is the WRONG gate: pnpm ships here as the x64 build, so the Node running this file
// reports `x64` on the very Apple Silicon machine the shim exists for — that is the whole bug the
// shim fixes, and reading `arch` would switch it off exactly where it is needed. Platform plus the
// shim's presence is what actually decides; `arch -arm64` is a no-op on an Intel Mac anyway.
const useShim = process.platform === 'darwin' && existsSync(SHIM)

// One export, not two: `channel` is itself a `LaunchOptions` field, so the non-macOS branch fits the
// same object and every consumer spells `launchOptions: chromeLaunchOptions`. The two are mutually
// exclusive — passing `executablePath` alongside `channel` is an error.
export const chromeLaunchOptions: LaunchOptions = useShim
  ? { executablePath: SHIM }
  : { channel: 'chrome' }
