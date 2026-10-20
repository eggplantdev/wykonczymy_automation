// Trimming the scaled amount to 12 significant digits drops the residue before rounding.
// Half away from zero, not `Math.round`'s half toward +∞: the listing shows bilans negative and the
// investment page shows the same amount as a positive „Pozostało", so −x.xx5 must mirror x.xx5.
export const roundToCents = (amount: number) => {
  const scaled = Number((amount * 100).toPrecision(12))
  return (Math.sign(scaled) * Math.round(Math.abs(scaled))) / 100 + 0
}

// Rounded before the sign test, or a balance that renders „0,00" gets painted red by a −1e-13 residue.
export const isNegativeMoney = (amount: number) => roundToCents(amount) < 0
