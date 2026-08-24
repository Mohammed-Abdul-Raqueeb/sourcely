-- Search infrastructure Prisma cannot express in the schema language.
--
-- Two things live here:
--   1. A generated tsvector column plus a GIN index, so keyword search is an
--      index scan rather than a sequence of ILIKE predicates.
--   2. An ivfflat index on the embedding column for vector similarity.
--
-- Both are additive; the application works without them, just slower.

-- ---------------------------------------------------------------------------
-- Full-text search
-- ---------------------------------------------------------------------------

-- array_to_string() is declared STABLE, not IMMUTABLE, so Postgres refuses it
-- inside a generated column. It is STABLE because for an arbitrary element type
-- it calls that type's output function, which can depend on locale or DateStyle.
-- For text[] there is no conversion at all — the result depends only on the
-- input — so a typed wrapper is genuinely immutable rather than a lie to the
-- planner.
CREATE OR REPLACE FUNCTION sourcely_join_text(arr text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $fn$ SELECT array_to_string(arr, ' ') $fn$;

-- The regconfig cast is required: without it Postgres rejects the generated
-- column with "generation expression is not immutable", because a bare
-- 'english' literal is resolved to a regconfig at runtime rather than at
-- definition time.
--
-- Field weighting mirrors documentText() in src/server/catalog/search-engine.ts:
-- a term in the product name is a far stronger signal than the same term buried
-- in prose, and tsvector has no other way to express that.
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce("sku", '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, sourcely_join_text("tags")), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce("shortDescription", '')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce("description", '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS "products_search_vector_idx"
  ON "products" USING GIN ("searchVector");

-- Trigram index for prefix and fuzzy SKU lookup ("VTK-BV" finding VTK-BV2S-050).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE INDEX IF NOT EXISTS "products_sku_trgm_idx"
  ON "products" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
  ON "products" USING GIN ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Vector similarity
-- ---------------------------------------------------------------------------

-- ivfflat trades exactness for sublinear lookup. `lists` should be roughly
-- sqrt(row count); 100 suits a catalogue in the tens of thousands. The index is
-- only effective once the table has data, so this runs after the seed.
CREATE INDEX IF NOT EXISTS "product_embeddings_vector_idx"
  ON "product_embeddings" USING ivfflat ("vector" vector_cosine_ops)
  WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- Analytics
-- ---------------------------------------------------------------------------

-- The admin dashboard's headline metric is the zero-result rate. A partial
-- index keeps that query cheap as the events table grows.
CREATE INDEX IF NOT EXISTS "search_events_zero_result_idx"
  ON "search_events" ("createdAt")
  WHERE "resultCount" = 0;

-- Quotations awaiting a supplier response — the admin queue's default sort.
CREATE INDEX IF NOT EXISTS "rfqs_awaiting_idx"
  ON "rfqs" ("updatedAt")
  WHERE "status" IN ('submitted', 'under_review');
