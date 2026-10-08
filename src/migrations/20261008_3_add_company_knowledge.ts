import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Wiedza firmowa (EX-1032): company rules that belong to no single praca, read by management and the
// kosztorys agent. Seeded with the rules the agent learned in the AI-kosztorys tests, only while the
// table is empty, so re-running it never duplicates or resurrects an entry somebody deleted.
//
// Purely additive — the table does not exist before this migration, so prod migrates BEFORE the
// code ships (AGENTS.md, Migrations).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "company_knowledge" (
      "id" serial PRIMARY KEY NOT NULL,
      "topic" varchar NOT NULL,
      "content" varchar NOT NULL,
      "display_order" integer NOT NULL DEFAULT 0,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "company_knowledge_updated_at_idx"
      ON "company_knowledge" ("updated_at");
    CREATE INDEX IF NOT EXISTS "company_knowledge_created_at_idx"
      ON "company_knowledge" ("created_at");

    -- Payload's lock-check SELECT names a column per collection and throws without it (20260709_1).
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "company_knowledge_id" integer
      REFERENCES "company_knowledge"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_company_knowledge_id_idx"
      ON "payload_locked_documents_rels" ("company_knowledge_id");

    INSERT INTO "company_knowledge" ("topic", "content", "display_order")
    SELECT v.topic, v.content, v.display_order
    FROM (VALUES
      ('Wysokość pomieszczeń, gdy rysunek jej nie podaje',
       'Stan deweloperski: 2,68 m w świetle. Rynek wtórny: 2,60 m. Wysokość wydrukowana na rysunku (Hpom) zawsze wygrywa. W „Co / ile założono” podaj, którą przyjęto.',
       0),
      ('Otwory w glazurze — ile na przybór',
       'WC: 5 (przycisk + 2 śruby + kanalizacja + dopływ). Prysznic: 2–3 przy baterii podtynkowej (zależnie od modelu), 2 przy natynkowej. Umywalka z baterią podtynkową: 3 (2 + odpływ). Grzejnik: 2 (zasilanie + powrót). Puszka elektryczna: 1 na każdą — zwykle 2 przy lustrze (włącznik + gniazdko), plus 1 na pralkę, jeśli projekt ma ją w łazience. Kratka wentylacyjna: 1.',
       1),
      ('Glazura — co liczyć z metrażu płytek',
       'm² ścian = płytki ścienne, m² podłogi = płytki podłogowe. Fugowanie i folia w płynie = suma wszystkich płytek, zawsze. Taśma hydroizolacyjna: obwód podłogi + narożniki strefy mokrej, ok. 15 mb na łazienkę 4 m². Silikonowanie: ok. 20–30 mb na łazienkę.',
       2),
      ('Malowanie i gładź',
       'W łazience maluje się tylko ściany bez płytek — sprawdź każdą ścianę osobno i licz malowanie z gładzią. Gładź pomija ściany za szafkami kuchennymi.',
       3),
      ('Szlifowanie płytek na 45°',
       'Z projektu: każdy narożnik zewnętrzny (np. pion) to jego wysokość × 2, do tego zabudowy (skrzynka baterii podtynkowej, półka z LED). Przy wątpliwościach nie zawyżaj — oznacz do weryfikacji.',
       4),
      ('Bruzdy wod-kan w łazience',
       'Ok. 2 mb na jedną łazienkę.',
       5),
      ('Demontaże — kwota wg ilości pracy',
       'WC + prysznic + umywalka + drzwi: 700 zł.',
       6),
      ('Malowana ściana nad starymi płytkami',
       'Przed nowymi płytkami trzeba ją zerwać — to osobna pozycja.',
       7),
      ('Przesunięcie otworu drzwiowego z nadprożem',
       'To droga praca — cena musi to odzwierciedlać.',
       8)
    ) AS v(topic, content, display_order)
    WHERE NOT EXISTS (SELECT 1 FROM "company_knowledge");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_company_knowledge_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "company_knowledge_id";

    DROP TABLE IF EXISTS "company_knowledge";
  `)
}
