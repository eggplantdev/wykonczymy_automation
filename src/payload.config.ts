import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import nodemailer from 'nodemailer'

import { pl } from '@payloadcms/translations/languages/pl'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { blobTokenRefusal } from '@/lib/env/schema'

import { AmountEdits } from '@/collections/amount-edits'
import { CashRegisters } from '@/collections/cash-registers'
import { Investments } from '@/collections/investments'
import { KosztorysClientView } from '@/collections/kosztorys-client-view'
import { KosztorysItems } from '@/collections/kosztorys-items'
import { KosztorysSections } from '@/collections/kosztorys-sections'
import { KosztorysShares } from '@/collections/kosztorys-shares'
import { KosztorysStages } from '@/collections/kosztorys-stages'
import { StageProgress } from '@/collections/stage-progress'
import { Leads } from '@/collections/leads'
import { Media } from '@/collections/media'
import { ExpenseCategories } from '@/collections/expense-categories'
import { Sheets } from '@/collections/sheets'
import { OtherCategories } from '@/collections/other-categories'
import { Transfers } from '@/collections/transfers'
import { Users } from '@/collections/users'
import { VehicleInspections } from '@/collections/vehicle-inspections'
import { Vehicles } from '@/collections/vehicles'
import { WorkCatalogueItems } from '@/collections/work-catalogue-items'
import { Equipment } from '@/collections/equipment'
import { EquipmentEvents } from '@/collections/equipment-events'
import { Warehouses } from '@/collections/warehouses'
import { KosztorysClientViewDefaults } from '@/globals/kosztorys-client-view-defaults'
import { NotificationRecipients } from '@/globals/notification-recipients'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Nothing in the Payload graph parses the env schema, so this file re-runs its Blob-token guard:
// it is what hands the token to the plugin whose handleDelete calls del(), and without this
// /admin/collections/media would delete real, tax-retained invoices from a dev session.
const refusal = blobTokenRefusal(process.env.VERCEL_ENV, process.env.BLOB_READ_WRITE_TOKEN)
if (refusal) throw new Error(`BLOB_READ_WRITE_TOKEN ${refusal}`)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    supportedLanguages: { pl, en },
    fallbackLanguage: 'pl',
  },
  editor: lexicalEditor(),
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.DB_POSTGRES_URL,
    },
    // Load-bearing, and not merely "we don't want dev push". `pushDevSchema` calls drizzle-kit's
    // `pushSchema`, which INTROSPECTS the live database and drops everything absent from this
    // config — and this database deliberately holds tables, unique indexes and NOT NULL columns
    // this config has never heard of. Why, and how to re-measure the gap:
    // context/foundation/lessons.md, "Part of this schema is invisible to Payload".
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  email: nodemailerAdapter({
    defaultFromAddress: process.env.EMAIL_USER ?? '',
    defaultFromName: 'Wykonczymy',
    transport: nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    }),
  }),
  collections: [
    Users,
    CashRegisters,
    Investments,
    Sheets,
    KosztorysSections,
    KosztorysItems,
    KosztorysStages,
    KosztorysShares,
    KosztorysClientView,
    StageProgress,
    Transfers,
    OtherCategories,
    ExpenseCategories,
    AmountEdits,
    Leads,
    Vehicles,
    VehicleInspections,
    WorkCatalogueItems,
    Equipment,
    EquipmentEvents,
    Warehouses,
    Media,
  ],
  globals: [KosztorysClientViewDefaults, NotificationRecipients],
  plugins: [
    vercelBlobStorage({
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN,
      // Do NOT set addRandomSuffix: true — the plugin rewrites Payload's `filename` field to the
      // suffixed blob key, polluting the user-facing label with a ~30-char token (EX-457 follow-up).
      // Cross-env key uniqueness is already handled by appendShortId at the upload boundary
      // (uploadFile → uniqueFileName).
    }),
  ],

  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-ENV',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
