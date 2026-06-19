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

import { AmountEdits } from '@/collections/amount-edits'
import { CashRegisters } from '@/collections/cash-registers'
import { Investments } from '@/collections/investments'
import { Media } from '@/collections/media'
import { ExpenseCategories } from '@/collections/expense-categories'
import { KosztorysSections } from '@/collections/kosztorys-sections'
import { KosztorysItems } from '@/collections/kosztorys-items'
import { KosztorysStages } from '@/collections/kosztorys-stages'
import { StageProgress } from '@/collections/stage-progress'
import { KosztorysRooms } from '@/collections/kosztorys-rooms'
import { Sheets } from '@/collections/sheets'
import { OtherCategories } from '@/collections/other-categories'
import { Transfers } from '@/collections/transfers'
import { Users } from '@/collections/users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
    Transfers,
    OtherCategories,
    ExpenseCategories,
    KosztorysSections,
    KosztorysItems,
    KosztorysStages,
    StageProgress,
    KosztorysRooms,
    AmountEdits,
    Media,
  ],
  plugins: [
    vercelBlobStorage({
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],

  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-ENV',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
