import type { FileChooser, Locator, Page } from '@playwright/test'

export const rowOf = (page: Page, description: string) =>
  page.getByRole('row').filter({ hasText: description })

export const filePicker = (scope: Locator) =>
  scope.locator('div[role="button"]:has(input[type="file"])')

// A selector aimed at the hidden input instead would keep passing after the control stopped opening it.
export async function pickThrough(
  page: Page,
  open: () => Promise<void>,
  files: Parameters<FileChooser['setFiles']>[0],
): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), open()])
  await chooser.setFiles(files)
}
