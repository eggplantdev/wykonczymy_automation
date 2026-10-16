import 'server-only'
import { serverSchema } from './schema'

export const serverEnv = serverSchema.parse(process.env)
