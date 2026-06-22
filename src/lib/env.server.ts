import 'server-only'
import { serverSchema } from './env-schema'

// Server entry — the `server-only` directive turns any client-component import of this
// module into a BUILD error, so server secrets can never reach the browser bundle.
// NOTE: do NOT import this from the Payload CLI graph (payload.config.ts / collections):
// `server-only` throws under `payload generate:types` (plain Node, no react-server condition).
export const serverEnv = serverSchema.parse(process.env)
