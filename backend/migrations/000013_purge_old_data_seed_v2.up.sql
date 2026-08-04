-- Migration 000013: Clean Purge of Legacy Data and Fresh V2 Data Seeding

-- 1. Truncate legacy tender workspaces, history, checklists, members, and alerts
TRUNCATE TABLE public.alerts CASCADE;
TRUNCATE TABLE bid.bid_stage_history CASCADE;
TRUNCATE TABLE bid.bid_checklists CASCADE;
TRUNCATE TABLE bid.bid_workspace_members CASCADE;
TRUNCATE TABLE bid.bid_workspaces CASCADE;

-- 2. Delete non-system users (keep Sadmin, biswapvt, biswabhusan)
DELETE FROM auth.user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE username NOT IN ('Sadmin', 'biswapvt', 'biswabhusan')
);

DELETE FROM auth.users 
WHERE username NOT IN ('Sadmin', 'biswapvt', 'biswabhusan');

-- Standardize bcrypt hash for Password123! across all three users
UPDATE auth.users 
SET password_hash = '$2a$12$BqlJFo63KiMfto6RhUB4Yehf6HqvEmf6X12nfpFgs367aduIyJIKi',
    is_active = true,
    force_password_change = false;

-- 3. Seed Fresh Enterprise Sample GeM Tender
INSERT INTO bid.bid_workspaces (
    id, title, gem_bid_no, bid_no, portal_source, creation_mode, category, bid_type,
    organization_name, department_name, estimated_value, emd_amount, emd_exempted,
    closing_date, workflow_stage, bid_status, bid_owner_id, created_by
)
SELECT 
    'ead7ee9f-5e2e-4c1a-9ca2-9b316f069ea6'::uuid,
    'Enterprise Network Upgrade & Firewall Deployment',
    'GEM/2026/B/9821450',
    'BID-2026-NET-001',
    'GeM Portal',
    'MANUAL',
    'IT & Telecom Infrastructure',
    'BID_TO_RA',
    'National Informatics Centre (NIC)',
    'Department of Information Technology',
    2500000.00,
    50000.00,
    false,
    NOW() + INTERVAL '14 days',
    'DISCOVERED',
    'ACTIVE',
    u.id,
    u.id
FROM auth.users u
WHERE u.username = 'Sadmin'
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    workflow_stage = 'DISCOVERED',
    bid_status = 'ACTIVE';

-- Seed initial stage history entry
INSERT INTO bid.bid_stage_history (
    bid_id, from_stage, to_stage, transitioned_by, transition_reason
)
SELECT 
    'ead7ee9f-5e2e-4c1a-9ca2-9b316f069ea6'::uuid,
    'DISCOVERED',
    'DISCOVERED',
    u.id,
    'Tender initialized in Discovered stage (Migration V2 Data Cleanse).'
FROM auth.users u
WHERE u.username = 'Sadmin'
ON CONFLICT DO NOTHING;
