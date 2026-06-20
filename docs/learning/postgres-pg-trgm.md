# Postgres `pg_trgm` — the trigram fuzzy-search extension

Personal learning note (not project documentation). What all those `gtrgm_*` /
`similarity*` / `word_similarity*` functions in the schema actually are. Move/delete
freely — not load-bearing for the repo.

When TablePlus shows a long list of functions like `similarity`, `show_trgm`,
`gin_extract_query_trgm`, `gtrgm_compress`, `word_similarity_op`… they are **not** app
code. They all come from one extension: **`pg_trgm`**, pulled in by `CREATE EXTENSION
pg_trgm`. The list = "fuzzy text-search toolkit," not business logic.

---

## The core idea: trigrams

A **trigram** is any 3 consecutive characters in a string. `"kominek"` →
`kom`, `omi`, `min`, `ine`, `nek` (plus padded edge trigrams). Two strings are "similar"
if they **share many trigrams**. That turns fuzzy comparison into set overlap — fast and
typo-tolerant (`"kominek"` vs `"kominekk"` still share most trigrams).

This is what powers fuzzy search and `ILIKE '%...%'` speedups — the usual reason an app
enables it (e.g. searching investments/transfers by name).

---

## The functions, grouped by who uses them

### 1. Ones you'd actually call

| Function                           | What it does                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `similarity(a, b)`                 | `0.0–1.0`: how alike two strings are by trigram overlap. `similarity('kominek','komin')` ≈ 0.6                    |
| `word_similarity(a, b)`            | best similarity of `a` against any _word_ inside `b` — "does this term appear, fuzzily?"                          |
| `strict_word_similarity(a, b)`     | stricter variant that respects word boundaries more tightly                                                       |
| `show_trgm(text)`                  | debugging — shows the actual trigrams of a string                                                                 |
| `set_limit(real)` / `show_limit()` | get/set the threshold the `%` operator uses (legacy; modern code uses the `pg_trgm.similarity_threshold` setting) |
| `similarity_dist`                  | `1 - similarity`, i.e. a _distance_ — used to **sort** results "closest first"                                    |

### 2. Operator backers (you use the _operator_, not the function)

The `*_op` functions implement the trigram operators so SQL stays terse:

- `%` → "similar enough" (`name % 'kominek'`)
- `<->` → similarity distance, for `ORDER BY name <-> 'kominek'`
- `<%`, `<<%` → word-similarity operators

Postgres needs a named function behind each operator; that's all `similarity_op`,
`word_similarity_op`, `strict_word_dist_op`, etc. are.

### 3. Index support functions (pure plumbing — never called by hand)

The bulk of the list; mentally ignore it:

- **`gin_extract_query_trgm`, `gin_extract_value_trgm`, `gin_trgm_consistent`** → the
  three methods a **GIN index** needs to index text by trigram.
- **`gtrgm_compress / consistent / decompress / distance / in / out / options / penalty /
picksplit / same / union`** → the methods a **GiST index** needs (its operator class).
  GiST requires exactly this callback set; pg_trgm provides them so you can do
  `CREATE INDEX … USING gist (name gist_trgm_ops)`.

These exist so an index can make `WHERE name ILIKE '%komin%'` or `WHERE name % 'komin'`
fast instead of scanning every row.

---

## Why it matters / the trade-off

Without `pg_trgm`, `ILIKE '%foo%'` can't use a normal B-tree index (the wildcard is on the
left), so it scans the whole table. A GIN/GiST trigram index fixes that — at the cost of
extra write overhead and disk.

- **GIN** = faster reads, slower/heavier to update.
- **GiST** = supports distance ordering (`<->`) and is lighter to update, but reads are a
  bit slower.

Classic read-vs-write index trade-off.

---

## Self-check question

You want a search box where typing `"kominek"` still finds a row named `"Kominek gazowy"`
even with a typo, **sorted by closeness**. Which **operator** goes in the `ORDER BY`, and
which **index type** (GIN or GiST) must back the column for that ordering to be
index-accelerated — and why not the other one?
