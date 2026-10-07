import { describe, it, expect } from 'vitest'
import { isIosDevice, resolveInstallState } from '@/lib/pwa/install-state'

const BROWSER: Parameters<typeof resolveInstallState>[0] = {
  platform: 'browser',
  installed: false,
  hasPrompt: false,
  promptUsed: false,
  waitedOut: false,
}

describe('resolveInstallState', () => {
  it('hides the button inside the installed app, even with a prompt held', () => {
    expect(resolveInstallState({ ...BROWSER, platform: 'standalone', hasPrompt: true })).toBe('hidden')
  })

  it('hides the button in a tab once the app is installed', () => {
    expect(resolveInstallState({ ...BROWSER, installed: true, waitedOut: true })).toBe('hidden')
  })

  it('sends iOS to the guide, never to the wait', () => {
    expect(resolveInstallState({ ...BROWSER, platform: 'ios' })).toBe('ios')
  })

  it('waits for the prompt, then falls back to the menu hint', () => {
    expect(resolveInstallState(BROWSER)).toBe('waiting')
    expect(resolveInstallState({ ...BROWSER, waitedOut: true })).toBe('manual')
  })

  it('offers the install once a prompt arrives, even after the wait ran out', () => {
    expect(resolveInstallState({ ...BROWSER, hasPrompt: true })).toBe('ready')
    expect(resolveInstallState({ ...BROWSER, hasPrompt: true, waitedOut: true })).toBe('ready')
  })

  it('falls back to the menu hint once the prompt was used, without waiting out the minute', () => {
    expect(resolveInstallState({ ...BROWSER, promptUsed: true })).toBe('manual')
  })
})

describe('isIosDevice', () => {
  it('recognises an iPhone and an iPad that reports itself as a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
  })

  it('leaves a desktop Mac and Android alone', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false)
  })
})
