import { clientSchema } from './env-schema'

// Public entry — safe to import anywhere, browser included. Each NEXT_PUBLIC_* is keyed
// STATICALLY so the bundler can inline it; never `clientSchema.parse(process.env)` wholesale,
// which leaves public vars undefined in the client bundle.
const env = clientSchema.parse({
  NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
})

export const FRONTEND_URL = env.NEXT_PUBLIC_FRONTEND_URL
