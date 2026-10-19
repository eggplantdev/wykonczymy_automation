export const sanitizeNumericInput = (raw: string) => raw.replace(/\s/g, '').replace(',', '.')
