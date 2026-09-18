-- Migration 000042: Backfill Field Memory for the fields added this round
-- (title, portal_source, category, scope_type, product) — mirrors migration
-- 000038's backfill exactly. Without this, Field Memory only records a value
-- going forward from a create/update; every tender already in the system
-- (including tenders sharing the same title, portal source, or category)
-- contributes nothing to the suggestion list until someone happens to
-- re-save it.

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'title',
       (ARRAY_AGG(title ORDER BY created_at DESC))[1],
       LOWER(TRIM(title)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE title IS NOT NULL AND LENGTH(TRIM(title)) >= 3
GROUP BY LOWER(TRIM(title))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'portal_source',
       (ARRAY_AGG(portal_source ORDER BY created_at DESC))[1],
       LOWER(TRIM(portal_source)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE portal_source IS NOT NULL AND LENGTH(TRIM(portal_source)) >= 2
GROUP BY LOWER(TRIM(portal_source))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'category',
       (ARRAY_AGG(category ORDER BY created_at DESC))[1],
       LOWER(TRIM(category)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE category IS NOT NULL AND LENGTH(TRIM(category)) >= 2
GROUP BY LOWER(TRIM(category))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'scope_type',
       (ARRAY_AGG(scope_type ORDER BY created_at DESC))[1],
       LOWER(TRIM(scope_type)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE scope_type IS NOT NULL AND LENGTH(TRIM(scope_type)) >= 2
GROUP BY LOWER(TRIM(scope_type))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

-- Product names live inside requested_products JSONB ([{product,description,qty,oem}]),
-- same extra unnest step migration 000038 used for "oem".
INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'product',
       (ARRAY_AGG(product_val ORDER BY created_at DESC))[1],
       LOWER(TRIM(product_val)),
       COUNT(*),
       MAX(created_at)
FROM (
    SELECT b.created_at, elem->>'product' AS product_val
    FROM bid.bid_workspaces b,
         jsonb_array_elements(
             CASE WHEN jsonb_typeof(b.requested_products) = 'array'
                  THEN b.requested_products ELSE '[]'::jsonb END
         ) elem
    WHERE b.requested_products IS NOT NULL
) products
WHERE product_val IS NOT NULL AND LENGTH(TRIM(product_val)) >= 2
GROUP BY LOWER(TRIM(product_val))
ON CONFLICT (field_key, normalized_value) DO NOTHING;
