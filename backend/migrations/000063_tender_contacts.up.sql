-- Migration 000063: tender contacts
--
-- One row per contact of a tender (customer, bidder = us, OEM, other), edited row by row so two
-- people never overwrite each other. Replaces the Finance "post-bid contacts" JSON (000061) and the
-- contactName/contactEmail typed into the OEM Authorization matrix: both are copied here once.
CREATE TABLE IF NOT EXISTS bid.tender_contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id        UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('CUSTOMER', 'BIDDER', 'OEM', 'OTHER')),
    name          TEXT NOT NULL,
    org           TEXT NOT NULL DEFAULT '',
    designation   TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    -- OEM_AUTH: typed in OEM Authorization; source_ref is that matrix row's id.
    source        TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'OEM_AUTH')),
    source_ref    TEXT NOT NULL DEFAULT '',
    -- Banned = "do not use": stays listed, greyed out, with the reason.
    banned        BOOLEAN NOT NULL DEFAULT false,
    banned_reason TEXT NOT NULL DEFAULT '',
    banned_at     TIMESTAMPTZ,
    sort_order    INT NOT NULL DEFAULT 0,
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_contacts_bid_kind ON bid.tender_contacts (bid_id, kind, sort_order);

-- A person is listed once per tender: the same email, or the same phone number (digits only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_contacts_email
    ON bid.tender_contacts (bid_id, lower(email)) WHERE email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_contacts_phone
    ON bid.tender_contacts (bid_id, regexp_replace(phone, '\D', '', 'g')) WHERE regexp_replace(phone, '\D', '', 'g') <> '';

-- Copy 1: contacts typed in the OEM Authorization matrix (bid_workspaces.oem_workspace rows).
INSERT INTO bid.tender_contacts (bid_id, kind, name, org, email, source, source_ref)
SELECT b.id, 'OEM',
       COALESCE(NULLIF(btrim(o->>'contactName'), ''), btrim(o->>'contactEmail')),
       btrim(COALESCE(o->>'name', '')),
       lower(btrim(COALESCE(o->>'contactEmail', ''))),
       'OEM_AUTH', COALESCE(o->>'id', '')
FROM bid.bid_workspaces b
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(b.oem_workspace) = 'array' THEN b.oem_workspace
         WHEN jsonb_typeof(b.oem_workspace->'oems') = 'array' THEN b.oem_workspace->'oems'
         ELSE '[]'::jsonb END) AS o
WHERE (btrim(COALESCE(o->>'contactName', '')) <> '' OR btrim(COALESCE(o->>'contactEmail', '')) <> '')
  AND NOT EXISTS (
      SELECT 1 FROM bid.tender_contacts c
      WHERE c.bid_id = b.id AND c.source = 'OEM_AUTH' AND c.source_ref = COALESCE(o->>'id', '')
        AND lower(c.name) = lower(COALESCE(NULLIF(btrim(o->>'contactName'), ''), btrim(o->>'contactEmail'))))
ON CONFLICT DO NOTHING;

-- Copy 2: the Finance post-bid contacts. Customer, customer finance manager and accounts are all CUSTOMER.
INSERT INTO bid.tender_contacts (bid_id, kind, name, org, phone, email)
SELECT DISTINCT ON (b.id, lower(btrim(c->>'name')), lower(btrim(COALESCE(c->>'org', ''))))
       b.id, m.kind, btrim(c->>'name'), btrim(COALESCE(c->>'org', '')), btrim(COALESCE(c->>'phone', '')), lower(btrim(COALESCE(c->>'email', '')))
FROM bid.bid_workspaces b
CROSS JOIN (VALUES ('customer', 'CUSTOMER'), ('customerFinance', 'CUSTOMER'), ('accounts', 'CUSTOMER'), ('oem', 'OEM'), ('payment', 'OTHER')) AS m(grp, kind)
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(b.post_bid->'contacts'->m.grp) = 'array' THEN b.post_bid->'contacts'->m.grp ELSE '[]'::jsonb END) AS c
WHERE btrim(COALESCE(c->>'name', '')) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM bid.tender_contacts x
      WHERE x.bid_id = b.id AND lower(x.name) = lower(btrim(c->>'name')) AND lower(x.org) = lower(btrim(COALESCE(c->>'org', ''))))
-- the same person listed twice in the post-bid data: keep the entry with the most detail
ORDER BY b.id, lower(btrim(c->>'name')), lower(btrim(COALESCE(c->>'org', ''))),
         (btrim(COALESCE(c->>'email', '')) <> '') DESC, (btrim(COALESCE(c->>'phone', '')) <> '') DESC
ON CONFLICT DO NOTHING;

-- Stable order inside each column.
UPDATE bid.tender_contacts t SET sort_order = r.rn
FROM (SELECT id, row_number() OVER (PARTITION BY bid_id, kind ORDER BY created_at, name) AS rn FROM bid.tender_contacts) r
WHERE t.id = r.id AND t.sort_order = 0;

-- post_bid keeps only what Bid Submission needs: submittedAt / submittedBy / submittedPrice.
UPDATE bid.bid_workspaces
SET post_bid = post_bid - 'contacts' - 'na' - 'financeUserId' - 'financeUserName' - 'assignedAt' - 'assignedById' - 'assignedByName' - 'doneAt' - 'doneBy'
WHERE jsonb_typeof(post_bid) = 'object';
