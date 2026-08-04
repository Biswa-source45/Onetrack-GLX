-- Migration 000011: Clean V2 User Data, Role Permissions, and OTP Table

-- 1. Create OTP table for Forgot Password flow
CREATE TABLE IF NOT EXISTS auth.password_otps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    otp_code    VARCHAR(10) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_otps_email ON auth.password_otps(email);

-- 2. Seed clean system users
INSERT INTO auth.users (employee_code, username, email, full_name, password_hash, force_password_change, is_active)
VALUES 
    ('SA001',   'Sadmin',      'biswabhusans@globx.co.in',    'Biswa SuperAdmin', '$2a$10$nO1jIUku8kehdnwKrV2q4u9HKgspwcsX9hFts.OePRaTBOLoZnsXK', false, true),
    ('MGR001',  'biswapvt',    'biswapvt506@gmail.com',       'Biswabhusan Manager', '$2a$10$nO1jIUku8kehdnwKrV2q4u9HKgspwcsX9hFts.OePRaTBOLoZnsXK', false, true),
    ('EXEC001', 'biswabhusan', 'biswabhusansahoo506@gmail.com','Biswabhusan Executive', '$2a$10$nO1jIUku8kehdnwKrV2q4u9HKgspwcsX9hFts.OePRaTBOLoZnsXK', false, true)
ON CONFLICT (username) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- Assign roles
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r WHERE u.username = 'Sadmin' AND r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r WHERE u.username = 'biswapvt' AND r.name = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r WHERE u.username = 'biswabhusan' AND r.name = 'BID_EXECUTIVE'
ON CONFLICT DO NOTHING;

-- Grant permissions to essential roles to ensure seamless operation without authorization blocks
INSERT INTO auth.permissions (resource, action, description) VALUES
    ('bid', 'view',   'Allows viewing bid workspaces'),
    ('bid', 'create', 'Allows creating bid workspaces'),
    ('bid', 'edit',   'Allows modifying bid workspaces'),
    ('user', 'view',  'Allows viewing user directory')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'BID_EXECUTIVE', 'PRE_SALES', 'FINANCE')
  AND (p.resource || '.' || p.action) IN ('bid.view', 'bid.create', 'bid.edit', 'user.view')
ON CONFLICT DO NOTHING;

-- 3. Purge legacy test tender data and alerts for clean V2 baseline
TRUNCATE TABLE public.alerts CASCADE;
TRUNCATE TABLE bid.bid_workspaces CASCADE;
