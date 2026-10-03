// Money arrives here as float products (qty × price, with fractional plane coefficients), so a figure
// the UI renders „435,00" can hold a −5.7e-14 residue. Round before COMPARING two such figures, or a
// paid-in-full settlement reads as an overpayment. Never round mid-calculation — only at the seam
// where a number becomes a decision or a displayed total.
// The same residue decides a half grosz: 2185.275 summed exactly by Postgres rounds up, the JS
// fold's 2185.2749999999996 rounds down, and the listing and the investment page disagree by a
// grosz. Trimming the scaled amount to 12 significant digits drops the residue before rounding.
// Half away from zero, not `Math.round`'s half toward +∞: the listing shows bilans negative and the
// investment page shows the same amount as a positive „Pozostało", so −x.xx5 must mirror x.xx5.
// `+ 0` collapses the negative zero `Math.sign` hands back for a tiny negative residue, so callers
// comparing or serialising the result never meet a -0 (`formatNet` guards its own output for the
// same reason).
export const roundToCents = (amount: number) => {
  const scaled = Number((amount * 100).toPrecision(12))
  return (Math.sign(scaled) * Math.round(Math.abs(scaled))) / 100 + 0
}
