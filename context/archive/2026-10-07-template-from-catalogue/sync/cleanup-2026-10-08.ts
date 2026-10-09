// One-off (EX-1017), owner rulings 2026-10-08: the kierownik's renames go into the katalog, the
// szablon's m² is right for „Zabezpieczenia…", big bag stays 600, the 3× „Nowa praca" go, and the
// grzejnik takes the plural translation. Translations the renames carry over are corrected where the
// text was broken (a duplicated tail, a typo, a word the new opis dropped) — in the katalog AND the
// szablon, or the next sync-template-translations run would copy the broken text back.
//
//   node --conditions=react-server --env-file=.env --import tsx context/changes/2026-10-07-template-from-catalogue/sync/cleanup-2026-10-08.ts [--apply]
//
// Every write is guarded on the value it expects to replace; one miss rolls the whole run back. A
// manual snapshot of the szablon is taken in the same transaction first.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot } from '@/lib/db/snapshots'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'

const TEMPLATE = 'Kosztorys 2026 kolory'

type TextsT = { uk: string; ru: string }

type RenameT = {
  catalogueId: number
  unit: string
  templateItemId: number
  from: string
  to: string
  // Absent: the szablon's texts are carried over as they are.
  texts?: TextsT
}

const RENAMES: RenameT[] = [
  {
    catalogueId: 908,
    unit: 'kpl',
    templateItemId: 50442,
    from: 'Usunięcie drewnianych ościeżnic',
    to: 'Demontaż drewnianych ościeżnic',
  },
  {
    catalogueId: 910,
    unit: 'kpl',
    templateItemId: 50443,
    from: 'Usunięcie metalowych futryn',
    to: 'Demontaż metalowych futryn',
  },
  {
    catalogueId: 915,
    unit: 'm²',
    templateItemId: 50444,
    from: 'Usuwanie podłogi drewnianej klejonej - trudny demontaż, mocny klej, małe kawałki',
    to: 'Demontaż podłogi drewnianej klejonej - trudny demontaż, mocny klej, małe kawałki',
    texts: {
      uk: "Демонтаж приклеєної дерев'яної підлоги - складний демонтаж, міцний клей, дрібні шматки",
      ru: 'Демонтаж приклеенного деревянного пола - сложный демонтаж, прочный клей, мелкие куски',
    },
  },
  {
    catalogueId: 913,
    unit: 'm²',
    templateItemId: 50445,
    from: 'Usuwanie podłogi drewnianej na klej - prosty demontaż',
    to: 'Demontaż podłogi drewnianej na klej - prosty demontaż',
  },
  {
    catalogueId: 914,
    unit: 'm²',
    templateItemId: 50446,
    from: 'Usuwanie podłogi pływającej panele etc.',
    to: 'Demontaż podłogi pływającej panele etc.',
    texts: {
      uk: 'Демонтаж плаваючої підлоги (ламінат, вініл тощо)',
      ru: 'Демонтаж плавающего пола (ламинат, винил и т.д.)',
    },
  },
  {
    catalogueId: 885,
    unit: 'm²',
    templateItemId: 50433,
    from: 'Skucie posadzki/lastryko 10 cm - beton zbrojony',
    to: 'Skuwanie posadzki/lastryko 10 cm - beton zbrojony',
    texts: {
      uk: 'Збивання підлоги/терацо 10 см - залізобетон',
      ru: 'Сбивка пола/терраццо 10 см - железобетон',
    },
  },
  {
    catalogueId: 887,
    unit: 'm²',
    templateItemId: 50434,
    from: 'Skucie wylewki do 6cm',
    to: 'Skuwanie wylewki do 6cm',
    texts: { uk: 'Збивання стяжки до 6 см', ru: 'Сбивка стяжки до 6 см' },
  },
  {
    catalogueId: 888,
    unit: 'm²',
    templateItemId: 50435,
    from: 'Skucie zwietrzałych tynków cementowo-wapiennych i cementowych',
    to: 'Skuwanie tynków cementowo-wapiennych i cementowych',
    texts: {
      uk: 'Збивання цементно-вапняної та цементної штукатурки',
      ru: 'Сбивка цементно-известковой и цементной штукатурки',
    },
  },
  {
    catalogueId: 752,
    unit: 'mb',
    templateItemId: 50516,
    from: 'Montaż listew sztukateryjnych na ścianach przygotowanych do malowania (docinanie, montaż, szpachlowanie połączeń, akrylowanie, szlifowanie)',
    to: 'Montaż listew sztukateryjnych na ścianach przygotowanie do malowania (docinanie, montaż, szpachlowanie połączeń, akrylowanie, szlifowanie)',
  },
  {
    catalogueId: 753,
    unit: 'mb',
    templateItemId: 50517,
    from: 'Montaż listew sztukateryjnych sufitowych (osłona karnisza) przygotowanych do malowania (docinanie, montaż, szpachlowanie połączeń, akrylowanie, szlifowanie)',
    to: 'Montaż listew sztukateryjnych sufitowych (osłona karnisza) przygotowanie do malowania (docinanie, montaż, szpachlowanie połączeń, akrylowanie, szlifowanie)',
  },
]

const PROTECTION = {
  catalogueId: 928,
  templateItemId: 50454,
  description:
    'Zabezpieczenia mebli, podłóg, okien, drzwi i elementów niezbędnych do prac. Demontaż gniazd, włączników, lamp, karniszy etc. Zabezpieczenie sprzętów i wszelkich niezbędnych elementów. Oklejanie do malowania etc. Zabezpieczanie elementów już wykonanych, glazura zabudowy etc.',
  fromUnit: 'kpl',
  toUnit: 'm²',
}

const RADIATOR = {
  catalogueId: 202,
  templateItemIds: [50572, 50705],
  description: 'Montaż grzejnika z zaworami',
  texts: { uk: 'Монтаж радіатора з кранами', ru: 'Монтаж радиатора с кранами' },
}

const BIG_BAG = {
  templateItemId: 50405,
  description: 'Wynoszenie gruzu, mebli, armatury, śmieci, odpadów budowlanych big bag',
  fromPrice: 450,
  toPrice: 600,
}

const NEW_WORK_ITEM_IDS = [50651, 50666, 50667]

const stamped = (texts: TextsT, source: string) => ({
  uk: { text: texts.uk, source },
  ru: { text: texts.ru, source },
})

function expectOne(res: { rows: unknown[] }, what: string) {
  if (res.rows.length !== 1) throw new Error(`${what}: ${res.rows.length} wierszy, oczekiwano 1.`)
}

async function templateTexts(db: DbExecutorT, itemId: number): Promise<TextsT> {
  const res = await db.execute(sql`
    SELECT description_translations -> 'uk' ->> 'text' AS uk,
           description_translations -> 'ru' ->> 'text' AS ru
    FROM kosztorys_items WHERE id = ${itemId}
  `)
  expectOne(res, `pozycja szablonu ${itemId}`)
  const { uk, ru } = res.rows[0]
  if (!uk || !ru) throw new Error(`pozycja szablonu ${itemId}: brak tłumaczenia.`)
  return { uk: String(uk).trim(), ru: String(ru).trim() }
}

async function run(db: DbExecutorT, templateId: number) {
  for (const rename of RENAMES) {
    const texts = rename.texts ?? (await templateTexts(db, rename.templateItemId))
    const translations = JSON.stringify(stamped(texts, rename.to))
    const catalogue = await db.execute(sql`
      UPDATE work_catalogue_items
      SET description = ${rename.to},
          match_key = ${catalogueKey(rename.to, rename.unit)},
          description_translations = ${translations}::jsonb,
          updated_at = now()
      WHERE id = ${rename.catalogueId} AND description = ${rename.from} AND unit = ${rename.unit}
      RETURNING id, match_key
    `)
    expectOne(catalogue, `katalog „${rename.from}"`)
    const template = await db.execute(sql`
      UPDATE kosztorys_items SET description_translations = ${translations}::jsonb, updated_at = now()
      WHERE id = ${rename.templateItemId} AND investment_id = ${templateId} AND description = ${rename.to}
      RETURNING id
    `)
    expectOne(template, `szablon „${rename.to}"`)
    console.log(`zmiana nazwy: „${rename.from}" → „${rename.to}"`)
  }

  const protectionTexts = await templateTexts(db, PROTECTION.templateItemId)
  const protection = await db.execute(sql`
    UPDATE work_catalogue_items
    SET unit = ${PROTECTION.toUnit},
        match_key = ${catalogueKey(PROTECTION.description, PROTECTION.toUnit)},
        description_translations = ${JSON.stringify(stamped(protectionTexts, PROTECTION.description))}::jsonb,
        updated_at = now()
    WHERE id = ${PROTECTION.catalogueId} AND description = ${PROTECTION.description}
      AND unit = ${PROTECTION.fromUnit}
    RETURNING id
  `)
  expectOne(protection, 'katalog „Zabezpieczenia…"')
  console.log(`j.m.: „Zabezpieczenia mebli…" ${PROTECTION.fromUnit} → ${PROTECTION.toUnit}`)

  const radiatorTranslations = JSON.stringify(stamped(RADIATOR.texts, RADIATOR.description))
  const radiatorCatalogue = await db.execute(sql`
    UPDATE work_catalogue_items
    SET description_translations = ${radiatorTranslations}::jsonb, updated_at = now()
    WHERE id = ${RADIATOR.catalogueId} AND description = ${RADIATOR.description}
    RETURNING id
  `)
  expectOne(radiatorCatalogue, 'katalog „Montaż grzejnika…"')
  for (const itemId of RADIATOR.templateItemIds) {
    const res = await db.execute(sql`
      UPDATE kosztorys_items SET description_translations = ${radiatorTranslations}::jsonb, updated_at = now()
      WHERE id = ${itemId} AND investment_id = ${templateId} AND description = ${RADIATOR.description}
      RETURNING id
    `)
    expectOne(res, `szablon „Montaż grzejnika…" ${itemId}`)
  }
  console.log(
    `tłumaczenie: „${RADIATOR.description}" → ${RADIATOR.texts.uk} / ${RADIATOR.texts.ru}`,
  )

  const bigBag = await db.execute(sql`
    UPDATE kosztorys_items SET client_price = ${BIG_BAG.toPrice}, updated_at = now()
    WHERE id = ${BIG_BAG.templateItemId} AND investment_id = ${templateId}
      AND description = ${BIG_BAG.description} AND client_price = ${BIG_BAG.fromPrice}
    RETURNING id
  `)
  expectOne(bigBag, 'szablon big bag')
  console.log(`cena: big bag ${BIG_BAG.fromPrice} → ${BIG_BAG.toPrice} zł`)

  for (const itemId of NEW_WORK_ITEM_IDS) {
    const res = await db.execute(sql`
      DELETE FROM kosztorys_items
      WHERE id = ${itemId} AND investment_id = ${templateId} AND description = 'Nowa praca'
        AND coalesce(planned_qty, 0) = 0 AND coalesce(client_price, 0) = 0
      RETURNING id
    `)
    expectOne(res, `szablon „Nowa praca" ${itemId}`)
  }
  console.log(`usunięte: ${NEW_WORK_ITEM_IDS.length}× „Nowa praca"`)
}

async function main() {
  const payload = await getPayload({ config })
  const isApply = process.argv.includes('--apply')
  const DRY_RUN_ROLLBACK = 'PRÓBA'

  try {
    await withPayloadTransaction(
      payload,
      async (req) => {
        const db = await getDb(payload, req)
        const template = await db.execute(sql`
          SELECT id FROM investments WHERE status = 'szablon' AND name = ${TEMPLATE} AND trashed_at IS NULL
        `)
        expectOne(template, `szablon „${TEMPLATE}"`)
        const templateId = Number(template.rows[0].id)
        await insertSnapshot(db, {
          investmentId: templateId,
          kind: 'manual',
          label: 'Przed porządkami katalogu prac (EX-1017)',
          takenBy: null,
          payload: serializeTree(await buildKosztorysTree(templateId, req)),
        })
        await run(db, templateId)
        if (!isApply) throw new Error(DRY_RUN_ROLLBACK)
      },
      {},
    )
  } catch (error) {
    if (error instanceof Error && error.message === DRY_RUN_ROLLBACK) {
      console.log('\nPRÓBA — wszystko przeszło, wycofane (--apply zapisuje)')
      process.exit(0)
    }
    throw error
  }
  console.log('\nZAPISANE')
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE — nic nie zapisano:', error)
  process.exit(1)
})
