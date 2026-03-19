const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

// Floating-point arithmetic can produce values like -0.0000000001 instead of 0.
// 0.005 threshold matches PLN's 2-decimal rounding — anything below half a grosz is zero.
const normalize = (n: number) => (Math.abs(n) < 0.005 ? 0 : n)

export const formatPLN = (amount: number) => formatter.format(normalize(amount))
