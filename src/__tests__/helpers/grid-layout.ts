import { afterAll, beforeAll } from 'vitest'

const STUBBED_KEYS = ['getBoundingClientRect', 'offsetWidth', 'offsetHeight'] as const

export function stubGridLayout() {
  const originals = STUBBED_KEYS.map(
    (key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const,
  )

  beforeAll(() => {
    const rect = { x: 0, y: 0, top: 0, left: 0, right: 1600, bottom: 800, width: 1600, height: 800 }
    HTMLElement.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 1600,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 800,
    })
  })

  afterAll(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, key)
    }
  })
}
