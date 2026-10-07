// A script that writes rows has no business near the Neon URL, whatever it writes.
export function assertLocalDb(script: string): void {
  const url = process.env.DB_POSTGRES_URL ?? ''
  const host = URL.canParse(url) ? new URL(url).hostname : ''
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`[${script}] refusing: DB_POSTGRES_URL host "${host}" is not localhost`)
  }
}
