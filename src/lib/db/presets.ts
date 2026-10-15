import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'

// The last reader of a szablon as an investment row; it goes with the investment gate's szablon
// branch.
export async function markPresetEdited(db: DbExecutorT, id: number): Promise<void> {
  await db.execute(sql`UPDATE investments SET content_edited_at = now() WHERE id = ${id}`)
}
