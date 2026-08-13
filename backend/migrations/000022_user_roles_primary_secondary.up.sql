-- Migration 000022: Add Primary & Secondary Role Support to auth.user_roles

-- 1. Add is_primary and role_order columns to auth.user_roles
ALTER TABLE auth.user_roles
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS role_order INT NOT NULL DEFAULT 0;

-- 2. Update existing records so that each user's first assigned role is marked as primary (role_order = 0)
WITH ranked_roles AS (
    SELECT 
        user_id, 
        role_id, 
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY assigned_at ASC) - 1 AS r_order
    FROM auth.user_roles
)
UPDATE auth.user_roles ur
SET 
    is_primary = (rr.r_order = 0),
    role_order = rr.r_order
FROM ranked_roles rr
WHERE ur.user_id = rr.user_id AND ur.role_id = rr.role_id;

-- 3. Create index for fast ordered queries
CREATE INDEX IF NOT EXISTS idx_user_roles_order ON auth.user_roles(user_id, role_order ASC, is_primary DESC);

-- 4. Ensure ADMIN and SUPER_ADMIN roles have all system permissions
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;
