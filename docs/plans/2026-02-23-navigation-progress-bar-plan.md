# Navigation Progress Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a top progress bar that gives instant visual feedback when navigating between pages.

**Architecture:** Use `@bprogress/next` — a TypeScript-native NProgress replacement with built-in Next.js App Router `ProgressProvider`. Wrap `(frontend)` layout children in the provider. No custom pathname tracking needed.

**Tech Stack:** `@bprogress/next`, Next.js App Router, Tailwind CSS

---

### Task 1: Install @bprogress/next

**Files:**

- Modify: `package.json`

**Step 1: Install the package**

Run: `pnpm add @bprogress/next`
Expected: Package added to `dependencies` in `package.json`

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add @bprogress/next for navigation progress bar"
```

---

### Task 2: Create Providers component

**Files:**

- Create: `src/app/(frontend)/providers.tsx`

**Step 1: Create the providers component**

```tsx
'use client'

import { ProgressProvider } from '@bprogress/next/app'
import type { ReactNode } from 'react'

type ProvidersPropsT = {
  readonly children: ReactNode
}

export function Providers({ children }: ProvidersPropsT) {
  return (
    <ProgressProvider
      height="2px"
      color="oklch(0.205 0 0)"
      options={{ showSpinner: false }}
      shallowRouting
    >
      {children}
    </ProgressProvider>
  )
}
```

Notes:

- `height="2px"` — thin bar, not distracting
- `color` — matches `--color-primary` from `globals.css`
- `showSpinner: false` — no circular spinner, just the bar
- `shallowRouting` — don't trigger on search param changes (pagination, filters)
- Named export per project convention

**Step 2: Commit**

```bash
git add src/app/\(frontend\)/providers.tsx
git commit -m "feat: add navigation progress bar provider"
```

---

### Task 3: Mount Providers in frontend layout

**Files:**

- Modify: `src/app/(frontend)/layout.tsx`

**Step 1: Wrap body content in Providers**

The current layout has `<body>` with a `<Suspense>` wrapping `<AuthenticatedShell>`. The `Providers` component must wrap the content inside `<body>` but does NOT replace `AuthenticatedShell` or `Suspense`.

Current structure:

```tsx
<body>
  <Suspense fallback={<Loader loading={true} />}>
    <AuthenticatedShell>{children}</AuthenticatedShell>
  </Suspense>
  <ToastContainer />
</body>
```

Target structure:

```tsx
<body>
  <Providers>
    <Suspense fallback={<Loader loading={true} />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
    <ToastContainer />
  </Providers>
</body>
```

Changes:

1. Add import: `import { Providers } from './providers'`
2. Wrap `<body>` children in `<Providers>`
3. Remove unused `Loader` import if it was only used here (check first — it IS used in the Suspense fallback, so keep it)

**Step 2: Verify dev server runs without errors**

Run: `pnpm dev`
Expected: No build errors, app loads normally

**Step 3: Manual test**

1. Open the app in browser
2. Click any link to a detail page (e.g., a worker or cash register)
3. Verify: thin progress bar appears at the top of the viewport immediately on click
4. Verify: bar completes when the new page renders
5. Verify: bar does NOT appear when changing pagination or filters (search param changes)

**Step 4: Commit**

```bash
git add src/app/\(frontend\)/layout.tsx
git commit -m "feat: wire navigation progress bar into frontend layout"
```

---

### Task 4: Fine-tune (if needed after manual test)

Potential adjustments after visual testing:

- **Bar too thin/thick:** Change `height` prop (try `3px` if `2px` is hard to see)
- **Color not visible enough:** Try `oklch(0.556 0 0)` (muted-foreground) or a brand accent color
- **Bar too slow/fast:** Add `options={{ showSpinner: false, minimum: 0.1, speed: 200 }}` to tune animation
- **Triggers on filter changes:** Verify `shallowRouting` works; if not, may need to disable it and handle manually
