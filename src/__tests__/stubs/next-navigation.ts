import { vi } from 'vitest'

// One router for the whole file, so a spec can assert `router.push`.
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}

export const navigationState = {
  pathname: '/',
  searchParams: new URLSearchParams(),
}

export const useRouter = () => router
export const usePathname = () => navigationState.pathname
export const useSearchParams = () => navigationState.searchParams
