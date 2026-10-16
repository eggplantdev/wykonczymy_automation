import { clientSchema } from './schema'

// never `clientSchema.parse(process.env)` wholesale, which leaves public vars undefined in the client bundle.
const env = clientSchema.parse({
  NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
})

export const FRONTEND_URL = env.NEXT_PUBLIC_FRONTEND_URL
export const VAPID_PUBLIC_KEY = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
