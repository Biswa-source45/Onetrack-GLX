-- Migration 000038: Field Memory — non-AI autocomplete for repeated free-text
-- fields (Account Name, Department, Location, EMD bank details, OEM names).
--
-- One generic table serves every field: field_key names which input the value
-- came from, normalized_value is the case/whitespace-folded dedup key, and
-- usage_count + last_used_at rank suggestions by how often and how recently
-- a value has actually been used. Values are written once per tender save
-- (see bidService.CreateBid / UpdateBid), never per keystroke.

CREATE TABLE IF NOT EXISTS bid.field_suggestions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_key        TEXT NOT NULL,
    value            TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    usage_count      INT NOT NULL DEFAULT 1,
    last_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (field_key, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_field_suggestions_lookup
    ON bid.field_suggestions (field_key, usage_count DESC, last_used_at DESC);

-- Backfill from every tender already in the database, so the suggestion
-- lists aren't empty on day one. Each block groups by the normalized value
-- so different casings of the same name collapse into one row, keeping the
-- most recently-used casing as the display value.

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'organization_name',
       (ARRAY_AGG(organization_name ORDER BY created_at DESC))[1],
       LOWER(TRIM(organization_name)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE organization_name IS NOT NULL AND LENGTH(TRIM(organization_name)) >= 3
GROUP BY LOWER(TRIM(organization_name))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'department_name',
       (ARRAY_AGG(department_name ORDER BY created_at DESC))[1],
       LOWER(TRIM(department_name)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE department_name IS NOT NULL AND LENGTH(TRIM(department_name)) >= 3
GROUP BY LOWER(TRIM(department_name))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'location',
       (ARRAY_AGG(location ORDER BY created_at DESC))[1],
       LOWER(TRIM(location)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE location IS NOT NULL AND LENGTH(TRIM(location)) >= 3
GROUP BY LOWER(TRIM(location))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'emd_bank_name',
       (ARRAY_AGG(emd_bank_name ORDER BY created_at DESC))[1],
       LOWER(TRIM(emd_bank_name)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE emd_bank_name IS NOT NULL AND LENGTH(TRIM(emd_bank_name)) >= 3
GROUP BY LOWER(TRIM(emd_bank_name))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'emd_beneficiary',
       (ARRAY_AGG(emd_beneficiary ORDER BY created_at DESC))[1],
       LOWER(TRIM(emd_beneficiary)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE emd_beneficiary IS NOT NULL AND LENGTH(TRIM(emd_beneficiary)) >= 3
GROUP BY LOWER(TRIM(emd_beneficiary))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'emd_payable_at',
       (ARRAY_AGG(emd_payable_at ORDER BY created_at DESC))[1],
       LOWER(TRIM(emd_payable_at)),
       COUNT(*),
       MAX(created_at)
FROM bid.bid_workspaces
WHERE emd_payable_at IS NOT NULL AND LENGTH(TRIM(emd_payable_at)) >= 3
GROUP BY LOWER(TRIM(emd_payable_at))
ON CONFLICT (field_key, normalized_value) DO NOTHING;

-- OEM names live inside requested_products JSONB ([{product,description,qty,oem}]),
-- not a plain column, so they need one extra unnest step.
INSERT INTO bid.field_suggestions (field_key, value, normalized_value, usage_count, last_used_at)
SELECT 'oem',
       (ARRAY_AGG(oem_val ORDER BY created_at DESC))[1],
       LOWER(TRIM(oem_val)),
       COUNT(*),
       MAX(created_at)
FROM (
    SELECT b.created_at, elem->>'oem' AS oem_val
    FROM bid.bid_workspaces b,
         jsonb_array_elements(
             CASE WHEN jsonb_typeof(b.requested_products) = 'array'
                  THEN b.requested_products ELSE '[]'::jsonb END
         ) elem
    WHERE b.requested_products IS NOT NULL
) products
WHERE oem_val IS NOT NULL AND LENGTH(TRIM(oem_val)) >= 2
GROUP BY LOWER(TRIM(oem_val))
ON CONFLICT (field_key, normalized_value) DO NOTHING;
