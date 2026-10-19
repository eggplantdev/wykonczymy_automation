// The real `after` throws outside a request scope. Tasks are kept, not run, so a spec decides when the
// deferred work happens — `flushAfter()` runs it.
export const scheduled: (() => unknown)[] = []

export const after = (task: () => unknown) => void scheduled.push(task)

export async function flushAfter() {
  for (const task of scheduled.splice(0)) await task()
}
