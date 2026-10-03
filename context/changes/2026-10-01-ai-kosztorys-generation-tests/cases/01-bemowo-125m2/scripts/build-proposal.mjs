import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = import.meta.dirname
const rozpiska = new Map()
for (const line of readFileSync(path.join(dir, '..', 'inputs', 'rozpiska-szablon-165.txt'), 'utf8').split('\n')) {
  if (!line.trim()) continue
  const [order, section, id, desc, unit, price] = line.split(' | ').map((s) => s.trim())
  rozpiska.set(Number(id), { order: Number(order), section, desc, unit, price: Number(price) })
}

// [pozycja, Przedmiar, źródło / założenie]
const rows = [
  // 0 Prace dodatkowe
  [41502, 1, 'cały okres remontu'],
  [41504, 1, 'płytki wielkoformatowe, armatura, tapety, listwy'],
  [41505, 2, 'odpady z etapu wykończeniowego'],
  [41506, 1, 'gruz: ściana w drugim korytarzu, otwór pod kasetę Eclisse, przesunięcia otworów (str. 3)'],
  // 2 Wyburzenia
  [41520, 15, 'łaz. duża: umywalka + grzejnik na inne ściany; łaz. mała: grzejnik + prysznic; zlew przesunięty do 100 cm'],
  [41522, 140, 'bilans gniazd: 80 nowych (13 do 25 cm, 47 25–100 cm, 18 ponad 100 cm, 2 od skrzynki) + ~30 nowych przewodów oświetleniowych + 4 łączniki + Ethernet'],
  [41523, 40, 'założenie: ~20% tras w ścianach/stropie żelbetowym'],
  [41525, 8, 'wg listy zakupowej: 6 pokojowych + 2 łazienkowe (mail mówi o 5 + 2)'],
  [41547, 1, 'nowy otwór pod drzwi ukryte 81×208 (str. 3)'],
  [41550, 15, 'ściana w drugim korytarzu ≈ 8 m² + otwór pod kasetę Eclisse 263×260 ≈ 6,8 m²'],
  [41554, 125.6, 'j.m. w rozpisce to kpl, ale cena 25 zł to stawka za m² mieszkania'],
  // 3 Podłogi
  [41558, 80, 'jak listwy przypodłogowe'],
  [41561, 1, 'płytki w holu dochodzą do drzwi wejściowych'],
  [41562, 18, 'hol 6,1 + podłoga kuchni 8,7 + ściany kuchni 3,3'],
  [41563, 15, 'hol + kuchnia (deska Bauwerk — firma zewnętrzna)'],
  [41570, 80, 'MD236 10 cm w pomieszczeniach suchych: obwody minus szafy i otwory drzwiowe'],
  [41577, 6.1, 'hol: mozaika Paradyż Modernizm na siatce 30,9×30,9, 64 arkusze netto'],
  [41583, 6, 'przejścia płytki ↔ deska bez listew: hol/pokoje, kuchnia/salon'],
  [41591, 6, 'ślad po wyburzonej ścianie + otwór Eclisse'],
  // 4 Ściany i sufity
  [41595, 130, 'styk ściana–sufit we wszystkich pomieszczeniach suchych'],
  [41598, 115, 'sufity pomieszczeń suchych: 125,6 − 6,74 − 4,11'],
  [41600, 290, 'obwody szacowane z powierzchni pokoi × 2,62 m, minus okna i drzwi'],
  [41603, 340, 'pod malowanie: sufity 115 + ściany malowane ≈ 225 (bez tapet)'],
  [41605, 405, 'gładzie: ściany 290 + sufity 115'],
  [41608, 115, 'sufity pomieszczeń suchych'],
  [41612, 135, 'limewash (str. 11): salon, korytarz, sypialnia, część gabinetu, bawialnia poniżej bordiury'],
  [41614, 90, 'kolor NCS: dzieci 0–120 cm, kuchnia, drugi korytarz, pom. gosp., reszta gabinetu'],
  [41615, 19.2, 'karnisze sufitowe: salon 3,11; bawialnia 4,86 + 2,68; sypialnia 2,72; gabinet 2,56; dzieci 3,22'],
  [41616, 26, 'sypialnia: Decor System DSS03, 12 szt. × 2,4 m'],
  [41617, 19.2, 'maskownice LK-01 nad karniszami'],
  [41622, 23, 'kaseta Eclisse 263 cm z pogrubieniem do 13 cm ≈ 6,9 + dobudowy ścianek ≈ 4 + 2× zasklepienie otworu 90 cm ≈ 3,8 + wygłuszenie ściany łaz. małej od pokoju dzieci ≈ 8'],
  [41625, 2, 'jedno zamurowanie otworu (str. 3)'],
  [41629, 195, 'tynkowanie bruzd elektrycznych i wod-kan'],
  [41630, 30, 'linia 120 cm w pokoju dzieci + styk limewash/tapeta w bawialni'],
  [41631, 1, 'po stolarzu (panele tapicerowane, akustyczne, zabudowy)'],
  [41632, 2, 'dwa przesunięcia otworu (str. 3)'],
  [41635, 40, 'glify okienne'],
  [41636, 30, 'łączenia płyt na nowych zabudowach GK'],
  [41637, 72, 'dzieci ≈ 32 (7 rolek Sandberg nad 120 cm), bawialnia ≈ 32 (7 rolek Caselio + bordiura 3 rolki), sypialnia MILO ≈ 6,5 (5 mb), naklejka-bordiura w pokoju dzieci'],
  [41639, 40, 'krawędzie po wyburzeniach, przesunięciach, nowym otworze i zmniejszeniach otworów'],
  [41640, 4, 'zamurowanie — obie strony'],
  [41642, 30, 'narożniki zabudów GK, siedzisk, kasety Eclisse, zaoblenie R5'],
  // 5 Łazienka
  [41646, 19, 'styk płytki/ściana malowana/sufit w obu łazienkach'],
  [41647, 2, 'bidetki w obu łazienkach'],
  [41648, 2, 'baterie umywalkowe podtynkowe w obu łazienkach'],
  [41649, 2, 'zestaw wannowy (wylewka, słuchawka, FixFit) + zestaw prysznicowy (deszczownica 36 cm, słuchawka, FixFit)'],
  [41651, 68, 'podłogi 10,85 + ściany ≈ 46 + sufity 10,85'],
  [41653, 6.9, 'jak płytki małoformatowe'],
  [41655, 47, 'jak płytki wielkoformatowe: podłogi 10,85 + ściany 29,5 + 6,7'],
  [41656, 14, 'łaz. duża: umywalka 3, wanna z iBox 3, odpływ suszarki 1, bidetka 2; łaz. mała: iBox prysznica 2, odpływ liniowy 1, bidetka 2'],
  [41659, 17, 'sufity łazienek 10,85 (Flugger Flutex) + ściany nad płytkami ≈ 6 (limewash + Aqua Ceramic)'],
  [41660, 16, 'haczyki, uchwyty na papier, szczotki WC, mydelniczki, drabinka, siedzisko składane, 2 dozowniki w kuchni'],
  [41662, 3, 'łaz. duża: termostat wannowy iBox; łaz. mała: ShowerSelect + zawór przestawny (2× iBox)'],
  [41664, 2, 'obie umywalki'],
  [41666, 2, 'bidetki podtynkowe (element + bateria)'],
  [41669, 2, 'Geberit Duofix w obu łazienkach'],
  [41671, 1, 'grzałka grzejnika wodno-elektrycznego Luxrad (łaz. mała)'],
  [41675, 2, 'po jednej na łazienkę'],
  [41677, 2, 'lustra łazienkowe'],
  [41680, 1, 'RainDrain 90 cm z uBox; przy 120×120 na podłodze — jednospadkowy'],
  [41683, 4, 'łaz. duża: 2 zabudowy h=120; łaz. mała: przedścianka h=120 z wnęką 25×15 + przedścianka h=120 (−10 cm) (str. 4)'],
  [41685, 2, 'umywalki'],
  [41687, 2, 'łaz. duża podblatowa (blat — firma zewnętrzna), łaz. mała'],
  [41690, 1, 'Villeroy & Boch Oberon 170×75 na nóżkach, front z Bars Swan'],
  [41692, 2, 'miski w obu łazienkach'],
  [41693, 2, 'zawory pod zlew w kuchni'],
  [41694, 1, 'łaz. duża'],
  [41695, 1, 'łaz. duża — odpływ suszarki'],
  [41696, 22, 'podłogi 10,85 + strefy mokre ścian ≈ 11'],
  [41697, 10.85, 'pod 120×120 na obu podłogach'],
  [41698, 30, 'wanna, prysznic, umywalki, narożniki wewnętrzne'],
  [41700, 15, 'krawędzie zabudów geberitów, przedścianki wanny, wnęk, frontu wanny'],
  [41705, 10.85, 'Caesar Bloomstone 6,74 (łaz. duża) + Norr Melk 4,11 (łaz. mała)'],
  [41711, 6.9, 'Potters Swan 5×25 3,06 + Bars Swan 0,56 (front wanny) + Potters Fossil 5×25 ≈ 3,3'],
  [41712, 29.5, 'łaz. duża: Bloomstone 0–120 ≈ 1,9 + Mirage Elysian 12,96; łaz. mała: Norr Melk ≈ 14,6'],
  [41714, 6.7, 'Elysian Line 120×278 — 2 płyty (łaz. duża)'],
  [41716, 10, 'półki wnęki na kosmetyki (4× 40 cm), wnęka 25×15, blaty zabudów, przedścianka wanny'],
  [41717, 20, 'wyjścia baterii podtynkowych, deszczownicy, FixFit, bidetek, gniazd'],
  [41719, 27, 'obwody podłóg + narożniki strefy prysznica i wanny'],
  [41720, 3, '3 zaślepione przyłącza wody po drugim mieszkaniu'],
  [41722, 1, 'łaz. mała — wnęka 25×15 w przedściance'],
  [41724, 1, 'łaz. duża — wnęka na kosmetyki z półkami'],
  [41728, 1.7, 'przedścianka za wanną h=90, gł. ~8 cm, pod baterię podtynkową'],
  // 6 Kuchnia
  [41732, 4, 'lodówka, zmywarka, płyta, piekarnik'],
  [41733, 1, 'Fontas z filtrem'],
  [41734, 3, 'LED pod szafkami wiszącymi'],
  [41736, 1, ''],
  [41737, 1, 'Blanco Subline podwieszany'],
  [41739, 1, ''],
  [41740, 1, ''],
  [41741, 1, ''],
  [41744, 2, 'fartuch Mallorca Cream 6,5×20 (153 szt.)'],
  [41745, 1.3, 'Soft Harmony 120×55 przy oknie'],
  [41746, 8.7, 'Soft Harmony 119,8×119,8 na podłodze'],
  // 8 Stolarka
  [41760, 1, 'drzwi ukryte montuje firma zewnętrzna — po naszej stronie obróbka'],
  [41764, 2, 'dwa zmniejszenia otworu (str. 3)'],
  // 10 Elektryka
  [41771, 1, 'nowe gniazdo 400 V'],
  [41772, 20, 'łączenia na ~10 odcinkach LED'],
  [41774, 5, 'Ethernet: gniazda RJ45 na końcach 3 kabli ST45↔ST44 + drugi kabel do salonu'],
  [41775, 127, 'wymiana całego osprzętu na Karlik Mini: 75 gniazd 230 V + 12 szczelnych + 2× 400 V + 4 TV + 6 RJ45 + ~28 łączników'],
  [41779, 6, 'wszystkie kinkiety z projektu'],
  [41780, 6, 'lampy wiszące: salon (Beryl), dzieci, sypialnia, bawialnia ×2, korytarz'],
  [41783, 1, ''],
  [41784, 6.5, 'bruzda LED w suficie: salon ≈ 4 + łaz. duża ≈ 2,5'],
  [41785, 26, 'pozostałe oprawy sufitowe z 32 w projekcie'],
  [41788, 4, 'szynoprzewód w korytarzu'],
  [41789, 19.2, 'LED za maskownicami karniszy (jak karnisze)'],
  [41790, 10, 'osobno włączane grupy LED'],
  [41793, 4, 'korytarze'],
  [41797, 14, '14 nowych obwodów (34 w projekcie, 20 z przewodów dewelopera)'],
  [41798, 15, 'założenie: część punktów w żelbecie'],
  [41799, 34, 'Ethernet: 3× kat. 5E ST45↔ST44 w nowym peszlu + drugi kabel ST45 → salon'],
  [41801, 46, 'nowe wypusty: 24 oprawy + 5 kinkietów + 17 zasilań LED / 230 V'],
  [41802, 4, 'bilans: 1 TV + 3 RJ45 nowe'],
  [41803, 83, 'bilans: 54 gniazda 230 V + 11 szczelnych + 8 podłączeń urządzeń + 2 kable pod zabudowę + 8 nowych miejsc łączników'],
  // 11 Wod-kan + c.o.
  [41805, 4, 'Jaga: sypialnia (Strada), kuchnia, 2× do zabudowy pod siedziskami'],
  [41807, 1, 'system filtrujący pod zlewem'],
  [41808, 4, 'Vertex Plan 2200×300 (bawialnia, dzieci) + Luxrad Ovaltic + Luxrad wodno-elektryczny'],
  [41809, 8, 'grzejniki łazienkowe przeniesione (2× 2 pkt) + wysunięcie 2 grzejników na przedściankę (2× 2 pkt)'],
  [41810, 3, 'zlew: woda ciepła, zimna, odpływ — przesunięcie do 100 cm'],
  [41811, 4, 'podejścia przenoszonych/wysuwanych grzejników'],
]

// [praca, j.m., Przedmiar, proponowana Cena j.m. (null = do ustalenia), uzasadnienie]
const newWork = [
  ['Ścianka z luksferów 1919/8 Alpha 3×13 szt. (≈ 1,4 m²) ze zbrojeniem, fugowaniem i obróbką', 'kpl', 1, 1500, 'łaz. mała, ściana prysznica — brak pozycji na luksfery'],
  ['Siedzisko z G-K pod oknem z wnęką na grzejnik do zabudowy i kratką', 'szt', 2, 1500, 'salon 145 cm h=62, bawialnia 152–169 cm gł. 30 — 41623 (180 zł/m²) dałby ~500 zł za całe siedzisko'],
  ['Klejenie dużego lustra na ścianę', 'szt', 3, 300, 'korytarz, salon (Optiwhite) i trzecie z maila — 41677 (120 zł) to lustro łazienkowe'],
  ['Podkucie ościeży okna pod płytę meblową', 'kpl', 1, 400, 'salon (str. 3)'],
  ['Koordynacja i nadzór prac', 'kpl', 1, null, 'pkt 17 maila — brak pozycji, zwykle % od wartości'],
  ['Sprzątanie końcowe', 'kpl', 1, null, 'pkt 18 maila — brak pozycji'],
]

const pl = (n, d = 2) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: d, useGrouping: 'always' })
const zl = (n) => `${pl(Math.round(n), 0)} zł`

// v1 = the blind run (quantities estimated from room m²); v2 = the same rows with the geometry
// measured from the drawings (scripts/measure/przedmiar.py → measure/measured.json).
const measured = JSON.parse(readFileSync(path.join(dir, '..', 'measure', 'measured.json'), 'utf8'))
const rowsV2 = rows.map(([id, qty, note]) => (measured[id] ? [id, ...measured[id]] : [id, qty, note]))

function render(rowSet) {
  const bySection = new Map()
  for (const [id, qty, note] of rowSet) {
    const item = rozpiska.get(id)
    if (!item) throw new Error(`unknown id ${id}`)
    const key = item.order
    if (!bySection.has(key)) bySection.set(key, { name: item.section.trim(), rows: [], total: 0 })
    const value = qty * item.price
    const s = bySection.get(key)
    s.rows.push({ id, ...item, qty, note, value })
    s.total += value
  }

  const sections = [...bySection.entries()].sort((a, b) => a[0] - b[0])
  const grand = sections.reduce((sum, [, s]) => sum + s.total, 0)
  const newPriced = newWork.filter((w) => w[3] != null)
  const newTotal = newPriced.reduce((sum, w) => sum + w[2] * w[3], 0)

  let md = ''
  md += `## Podsumowanie\n\n| Sekcja | Wartość netto przedmiar |\n|---|---:|\n`
  for (const [, s] of sections) md += `| ${s.name} | ${zl(s.total)} |\n`
  md += `| **Razem — pozycje z rozpiski** | **${zl(grand)}** |\n`
  md += `| Nowe prace (ceny do akceptacji) | ${zl(newTotal)} |\n`
  md += `| **Razem z nowymi pracami** | **${zl(grand + newTotal)}** |\n`
  md += `| Koordynacja + sprzątanie | do ustalenia |\n\n`
  md += `Pozycji z Przedmiarem > 0: ${rowSet.length} z ${rozpiska.size}.\n\n`

  for (const [, s] of sections) {
    md += `### ${s.name} — ${zl(s.total)}\n\n`
    md += `| Pozycja | Praca | j.m. | Przedmiar | Cena j.m. | Wartość netto przedmiar | Źródło / założenie |\n|---|---|---|---:|---:|---:|---|\n`
    for (const r of s.rows) {
      const desc = r.desc.length > 90 ? `${r.desc.slice(0, 88)}…` : r.desc
      md += `| ${r.id} | ${desc} | ${r.unit} | ${pl(r.qty)} | ${pl(r.price)} | ${zl(r.value)} | ${r.note} |\n`
    }
    md += '\n'
  }

  md += `## Nowe prace — brak pasującej pozycji w rozpisce\n\n| Praca | j.m. | Przedmiar | Proponowana Cena j.m. | Wartość netto przedmiar | Dlaczego |\n|---|---|---:|---:|---:|---|\n`
  for (const [name, unit, qty, price, why] of newWork) {
    md += `| ${name} | ${unit} | ${pl(qty)} | ${price == null ? '?' : pl(price)} | ${price == null ? '?' : zl(qty * price)} | ${why} |\n`
  }
  return { md, grand, sections }
}

const v1 = render(rows)
const v2 = render(rowsV2)
writeFileSync(path.join(dir, 'proposal-tables.md'), v1.md)
writeFileSync(path.join(dir, 'proposal-tables-v2.md'), v2.md)
writeFileSync(
  path.join(dir, '..', 'measure', 'przedmiar-v2.json'),
  JSON.stringify(rowsV2.map(([id, qty, note]) => ({ id, qty, note })), null, 1),
)

let cmp = `| Pozycja | Praca | j.m. | Przedmiar szacunek | Przedmiar pomiar | Różnica | Wartość netto przedmiar — różnica |\n|---|---|---|---:|---:|---:|---:|\n`
let delta = 0
for (const [id, qty] of rows) {
  if (!measured[id]) continue
  const item = rozpiska.get(id)
  const q2 = measured[id][0]
  const dz = (q2 - qty) * item.price
  delta += dz
  const desc = item.desc.length > 60 ? `${item.desc.slice(0, 58)}…` : item.desc
  const pct = qty ? ` (${q2 >= qty ? '+' : ''}${Math.round(((q2 - qty) / qty) * 100)}%)` : ''
  cmp += `| ${id} | ${desc} | ${item.unit} | ${pl(qty)} | ${pl(q2)} | ${q2 >= qty ? '+' : ''}${pl(q2 - qty, 1)}${pct} | ${dz >= 0 ? '+' : ''}${zl(dz)} |\n`
}
cmp += `| | **Razem** | | | | | **${delta >= 0 ? '+' : ''}${zl(delta)}** |\n`
writeFileSync(path.join(dir, 'comparison-table.md'), cmp)
console.log(`v1 ${Math.round(v1.grand)} v2 ${Math.round(v2.grand)} delta ${Math.round(delta)}`)
for (const [k, s] of v2.sections) console.log(s.name, Math.round(v1.sections.find(([j]) => j === k)[1].total), '→', Math.round(s.total))
