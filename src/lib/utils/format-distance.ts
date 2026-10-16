export const formatKm = (value: number) => `${value.toLocaleString('pl-PL')} km`

export const formatKmOrDash = (value: number | null) => (value === null ? '—' : formatKm(value))
