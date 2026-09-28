import { FRONTEND_URL } from '@/lib/env'

export const investorShareUrl = (token: string) => `${FRONTEND_URL}/k/${token}`
