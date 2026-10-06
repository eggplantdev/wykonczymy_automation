const UNITS: Record<string, number> = {
  zero: 0,
  jeden: 1,
  jedna: 1,
  dwa: 2,
  dwie: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  sześć: 6,
  siedem: 7,
  osiem: 8,
  dziewięć: 9,
  dziesięć: 10,
  jedenaście: 11,
  dwanaście: 12,
  trzynaście: 13,
  czternaście: 14,
  piętnaście: 15,
  szesnaście: 16,
  siedemnaście: 17,
  osiemnaście: 18,
  dziewiętnaście: 19,
  dwadzieścia: 20,
  trzydzieści: 30,
  czterdzieści: 40,
  pięćdziesiąt: 50,
  sześćdziesiąt: 60,
  siedemdziesiąt: 70,
  osiemdziesiąt: 80,
  dziewięćdziesiąt: 90,
  sto: 100,
  dwieście: 200,
  trzysta: 300,
  czterysta: 400,
  pięćset: 500,
  sześćset: 600,
  siedemset: 700,
  osiemset: 800,
  dziewięćset: 900,
}

export function wordsToAmount(text: string): number | null {
  const m = text.match(/^(.*?)\s*PLN(?:\s+(\d{1,2})\/100)?$/)
  if (!m) return null
  let total = 0
  let chunk = 0
  for (const w of m[1].toLowerCase().split(/\s+/).filter(Boolean)) {
    if (w in UNITS) chunk += UNITS[w]
    else if (/^tysi(ąc|ące|ęcy)$/.test(w)) {
      total += (chunk || 1) * 1000
      chunk = 0
    } else return null
  }
  return Math.round((total + chunk) * 100 + Number(m[2] ?? 0)) / 100
}
