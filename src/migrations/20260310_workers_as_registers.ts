import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create WORKER register per employee who has transactions
  await db.execute(sql`
    INSERT INTO cash_registers (name, owner_id, type, active, updated_at, created_at)
    SELECT
      'Konto - ' || u.name,
      u.id,
      'WORKER',
      true,
      NOW(),
      NOW()
    FROM users u
    WHERE u.role = 'EMPLOYEE'
      AND EXISTS (SELECT 1 FROM transactions t WHERE t.worker_id = u.id);
  `)

  // 3. Migrate ACCOUNT_FUNDING → REGISTER_TRANSFER
  // source_register_id stays (physical register), target_register_id = worker's register
  await db.execute(sql`
    UPDATE transactions t
    SET
      type = 'REGISTER_TRANSFER',
      target_register_id = cr.id
    FROM cash_registers cr
    WHERE t.type = 'ACCOUNT_FUNDING'
      AND cr.owner_id = t.worker_id
      AND cr.type = 'WORKER';
  `)

  // 4. Migrate EMPLOYEE_EXPENSE with investment → INVESTMENT_EXPENSE
  // source_register_id = worker's register
  await db.execute(sql`
    UPDATE transactions t
    SET
      type = 'INVESTMENT_EXPENSE',
      source_register_id = cr.id
    FROM cash_registers cr
    WHERE t.type = 'EMPLOYEE_EXPENSE'
      AND t.investment_id IS NOT NULL
      AND cr.owner_id = t.worker_id
      AND cr.type = 'WORKER';
  `)

  // 5. Migrate EMPLOYEE_EXPENSE with otherCategory (no investment) → OTHER
  // source_register_id = worker's register
  await db.execute(sql`
    UPDATE transactions t
    SET
      type = 'OTHER',
      source_register_id = cr.id
    FROM cash_registers cr
    WHERE t.type = 'EMPLOYEE_EXPENSE'
      AND t.investment_id IS NULL
      AND t.other_category_id IS NOT NULL
      AND cr.owner_id = t.worker_id
      AND cr.type = 'WORKER';
  `)

  // 6. Migrate EMPLOYEE_EXPENSE register refunds → REGISTER_TRANSFER
  // Swap: worker register becomes source, old source_register becomes target
  await db.execute(sql`
    UPDATE transactions t
    SET
      type = 'REGISTER_TRANSFER',
      target_register_id = t.source_register_id,
      source_register_id = cr.id
    FROM cash_registers cr
    WHERE t.type = 'EMPLOYEE_EXPENSE'
      AND t.source_register_id IS NOT NULL
      AND t.investment_id IS NULL
      AND t.other_category_id IS NULL
      AND cr.owner_id = t.worker_id
      AND cr.type = 'WORKER';
  `)

  // 7. Verify no EMPLOYEE_EXPENSE or ACCOUNT_FUNDING rows remain
  const remaining = await db.execute(sql`
    SELECT type, COUNT(*) as count
    FROM transactions
    WHERE type IN ('EMPLOYEE_EXPENSE', 'ACCOUNT_FUNDING')
    GROUP BY type;
  `)
  if (remaining.rows.length > 0) {
    throw new Error(
      `Migration incomplete: ${JSON.stringify(remaining.rows)} rows still have old types`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse migration is complex — restore from backup instead
  throw new Error('Down migration not supported. Restore from pre-migration backup.')
}
