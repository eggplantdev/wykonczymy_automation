import type { Payload } from 'payload'

const SEED_ADMIN = {
  email: 'admin@wykonczymy.pl',
  password: 'admin123',
  name: 'Admin',
  role: 'ADMIN' as const,
}

const SEED_OTHER_CATEGORIES = ['Inne', 'Paliwo'] as const

export const seed = async (payload: Payload): Promise<void> => {
  const existingUsers = await payload.count({ collection: 'users' })

  if (existingUsers.totalDocs > 0) return

  await payload.create({
    collection: 'users',
    data: SEED_ADMIN,
  })

  payload.logger.info(`Seeded admin user: ${SEED_ADMIN.email} (password: ${SEED_ADMIN.password})`)

  await seedOtherCategories(payload)
}

async function seedOtherCategories(payload: Payload): Promise<void> {
  const existing = await payload.count({ collection: 'other-categories' })
  if (existing.totalDocs > 0) return

  for (const name of SEED_OTHER_CATEGORIES) {
    await payload.create({ collection: 'other-categories', data: { name } })
  }

  payload.logger.info(`Seeded ${SEED_OTHER_CATEGORIES.length} other categories`)
}
