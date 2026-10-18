import { vi } from 'vitest'

// One router for the whole file, so a spec can assert `router.push` instead of a fresh `vi.fn` per render.
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}

// A spec sets these where it needs a route; the hooks read them on every render.
export const navigationState = {
  pathname: '/',
  searchParams: new URLSearchParams(),
}

export const useRouter = () => router
export const usePathname = () => navigationState.pathname
export const useSearchParams = () => navigationState.searchParams
