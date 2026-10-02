import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Purely ADDITIVE: migrate prod before pushing the code that reads this table.
//
// One shared list of section-name translations, keyed by `sectionNameKey` — nothing on the section
// row, so restore, szablon and import copy names exactly as before. Raw table, no Payload collection.
//
// The seed covers every name in use on 2026-10-02 and never overwrites: a manager may already have
// fixed an entry by the time a human runs this on prod, and their text wins.

// Keys must be exactly what `sectionNameKey` produces, or the row is unreachable with no error
// anywhere — `section-translations.test.ts` asserts it for every entry.
export const SECTION_TRANSLATION_SEED: { key: string; uk: string; ru: string }[] = [
  { key: 'ściany i sufity bez łazienek', uk: 'Стіни та стелі без ванних кімнат', ru: 'Стены и потолки без ванных комнат' },
  { key: 'kuchnia', uk: 'Кухня', ru: 'Кухня' },
  { key: 'podłogi', uk: 'Підлоги', ru: 'Полы' },
  { key: 'prace dodatkowe', uk: 'Додаткові роботи', ru: 'Дополнительные работы' },
  { key: 'wiatrołap', uk: 'Тамбур', ru: 'Тамбур' },
  { key: 'klimatyzacja', uk: 'Кондиціонування', ru: 'Кондиционирование' },
  { key: 'wyburzenia i demontaże', uk: 'Знесення та демонтаж', ru: 'Снос и демонтаж' },
  { key: 'wyburzenia, demontaże, zabezpieczenia', uk: 'Знесення, демонтаж, захист', ru: 'Снос, демонтаж, защита' },
  { key: 'instalacja elektryczna i oświetlenie', uk: 'Електромонтаж і освітлення', ru: 'Электромонтаж и освещение' },
  { key: 'instalacja elektryczna i oświetleniowa', uk: 'Електромонтаж і освітлення', ru: 'Электромонтаж и освещение' },
  { key: 'instalacja wodno-kanalizacyjna / c.o.', uk: 'Водопровід і каналізація / опалення', ru: 'Водопровод и канализация / отопление' },
  { key: 'instalacja wodno-kanalizacyjna + c.o.', uk: 'Водопровід і каналізація + опалення', ru: 'Водопровод и канализация + отопление' },
  { key: 'montaż stolarki i ślusarki', uk: 'Монтаж столярних і слюсарних виробів', ru: 'Монтаж столярных и слесарных изделий' },
  { key: 'montaż stolarki i ślusarski', uk: 'Монтаж столярних і слюсарних виробів', ru: 'Монтаж столярных и слесарных изделий' },
  { key: 'łazienka #', uk: 'Ванна кімната #', ru: 'Ванная комната #' },
  { key: 'łazienka', uk: 'Ванна кімната', ru: 'Ванная комната' },
  { key: 'wc', uk: 'Туалет', ru: 'Туалет' },
  { key: 'łazienka wc', uk: 'Санвузол', ru: 'Санузел' },
  { key: 'łazienka # wanna', uk: 'Ванна кімната # з ванною', ru: 'Ванная комната # с ванной' },
  { key: 'łazienka # prysznic', uk: 'Ванна кімната # з душем', ru: 'Ванная комната # с душем' },
  { key: 'pralnia', uk: 'Пральня', ru: 'Прачечная' },
  { key: 'garaż', uk: 'Гараж', ru: 'Гараж' },
  { key: 'nowa sekcja', uk: 'Новий розділ', ru: 'Новый раздел' },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_section_translations" (
      "name_key" varchar PRIMARY KEY,
      "translations" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  const values = SECTION_TRANSLATION_SEED.map(
    ({ key, uk, ru }) => sql`(${key}::varchar, jsonb_build_object('uk', ${uk}::text, 'ru', ${ru}::text))`,
  )
  await db.execute(sql`
    INSERT INTO "kosztorys_section_translations" ("name_key", "translations")
    VALUES ${sql.join(values, sql.raw(', '))}
    ON CONFLICT ("name_key") DO NOTHING
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "kosztorys_section_translations";`)
}
