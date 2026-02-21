/** Returns today's date as YYYY-MM-DD string. */
export const today = () => new Date().toISOString().split('T')[0]
