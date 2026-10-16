export function listParam<T>(value: unknown, parse: (param: string) => T[]): T[] | null {
  return typeof value === 'string' && value !== '' ? parse(value) : null
}
