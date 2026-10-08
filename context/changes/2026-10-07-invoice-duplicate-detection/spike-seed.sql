-- SPIKE (EX-1025): pending zgłoszenia that exercise each duplicate case. LOCAL DB ONLY (5433).
--   psql postgres://postgres:postgres@localhost:5433/wykonczymy-db -f spike-seed.sql
-- Re-runnable: drops its own earlier rows first (tagged by the note prefix).
-- Photos reuse media rows that load locally; `worker_expense_draft_media` keys on (draft, media), and
-- reject/delete reclaims only media nothing else references, so sharing them is safe.

BEGIN;

DELETE FROM worker_expense_drafts WHERE note LIKE 'SPIKE EX-1025%';

CREATE TEMP TABLE spike_draft (
  tag text, worker_id int, investment_id int, cash_register_id int, scan_mode text, ai_read jsonb
) ON COMMIT DROP;

INSERT INTO spike_draft VALUES
-- A: SUPERSEDED — seeds the file fingerprint the shipped matcher no longer has (see change.md).
-- A: the same photo again (worker 32 re-sends what became transakcja 5746).
('A · to samo zdjęcie drugi raz', 32, 144, 21, 'one-invoice', $${"rows":[
  {"mediaIds":[2130],"amount":117.4,"description":"Castorama 07.10.2026","filename":"castorama-07-10-2026.jpeg",
   "invoiceNote":"812766/003573/26\nKRZYWKA DO BATERII SCIENN\nUSZCELKA PANELI GRZEJ. 3/\nACETON TECHNICZNY DRAGON 0\nDRZWICZKI REW. Z TWORZ. 20"}]}$$),
-- B: paragon 1 = the 107,40 zł Castorama already booked as 5747, read with a DIFFERENT number;
--    paragon 2 = a clean control. One zgłoszenie, one flagged paragon.
('B · inny numer z tego samego paragonu + czysty paragon', 69, 179, 46, 'one-per-photo', $${"rows":[
  {"mediaIds":[2127],"amount":107.4,"description":"Castorama 06.10.2026","filename":"castorama-06-10-2026.jpeg",
   "invoiceNote":"087393/0888\nPĘDZEL ANGIELSKI GOODHOME\nKRĄŻEK NA RZEP 225MM P24\nTAŚMA SCOTCH DO ODCINANIA\nAKRYL LEKKI DEN BRAVEN 280\nKUWETA 5''FIT 32X38 ŻÓŁ"},
  {"mediaIds":[1011],"amount":88.15,"description":"Bricoman 06.10.2026","filename":"bricoman-06-10-2026.jpeg",
   "invoiceNote":"FV-BR/2026/77812\nKLEJ MONTAŻOWY 290ML\nTAŚMA MALARSKA 48MM"}]}$$),
-- C: two workers, the same (fabricated) invoice, different photos, both still pending.
('C1 · ta sama faktura u dwóch pracowników', 32, 144, 21, 'one-invoice', $${"rows":[
  {"mediaIds":[1013],"amount":249.9,"description":"OBI 06.10.2026","filename":"obi-06-10-2026.jpeg",
   "invoiceNote":"FV/2026/10/0042\nGRUNT GŁĘBOKO PENETRUJĄCY 5L\nWAŁEK SZNURKOWY 25CM"}]}$$),
('C2 · ta sama faktura u dwóch pracowników', 69, 179, 46, 'one-invoice', $${"rows":[
  {"mediaIds":[1012],"amount":249.9,"description":"OBI 06.10.2026","filename":"obi-06-10-2026.jpeg",
   "invoiceNote":"FV/2026/10/0042\nGRUNT GŁĘBOKO PENETRUJĄCY 5L\nWAŁEK SZNURKOWY 25CM"}]}$$),
-- D: weak — same amount as transakcja 5764 (49,98 zł Castorama 06.10), another shop, printed 2 days later.
('D · ta sama kwota, inny sklep, data ±2 dni', 32, 144, 21, 'one-invoice', $${"rows":[
  {"mediaIds":[1008],"amount":49.98,"description":"Bricomarche 08.10.2026","filename":"bricomarche-08-10-2026.jpeg",
   "invoiceNote":"55120/2026\nSILIKON SANITARNY BIAŁY"}]}$$),
-- F: a different photo of the Leroy Merlin invoice already booked twice (5697 inv 149, 5720 inv 119).
('F · inne zdjęcie faktury zaksięgowanej już 2×', 69, 179, 46, 'one-invoice', $${"rows":[
  {"mediaIds":[1014],"amount":636.69,"description":"Leroy Merlin 05.10.2026","filename":"leroy-merlin-05-10-2026.jpeg",
   "invoiceNote":"2026-30-523198\nSIATKA Z WLOKNA SZKLANEGO BASIC 10MB\nDEX WKŁADY DO OŁÓWKA AUTOMAT 12SZT\nNEO REPER DO WYLEWEK 100MM 20SZT+TAŚ 3M\nPUFAS PLEŚNIOBÓJCZY 0,5L"}]}$$);

WITH inserted AS (
  INSERT INTO worker_expense_drafts (worker_id, investment_id, cash_register_id, note, scan_mode, ai_read)
  SELECT worker_id, investment_id, cash_register_id, 'SPIKE EX-1025 ' || tag, scan_mode, ai_read
  FROM spike_draft
  RETURNING id, ai_read
)
INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
SELECT i.id, media_id::int, row_number() OVER (PARTITION BY i.id ORDER BY r.ord, m.ord) - 1
FROM inserted i
CROSS JOIN LATERAL jsonb_array_elements(i.ai_read -> 'rows') WITH ORDINALITY r(value, ord)
CROSS JOIN LATERAL jsonb_array_elements_text(r.value -> 'mediaIds') WITH ORDINALITY m(media_id, ord);

SELECT id, note FROM worker_expense_drafts WHERE note LIKE 'SPIKE EX-1025%' ORDER BY id;

COMMIT;
