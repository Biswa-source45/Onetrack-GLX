-- Migration 000017: Purge all tenders, tasks, alerts, and non-Sadmin users for clean system state

-- 1. Truncate all task schema tables
TRUNCATE TABLE task.task_activities CASCADE;
TRUNCATE TABLE task.task_checklists CASCADE;
TRUNCATE TABLE task.task_dependencies CASCADE;
TRUNCATE TABLE task.tasks CASCADE;

-- 2. Truncate all bid schema tables and public alerts
TRUNCATE TABLE public.alerts CASCADE;
TRUNCATE TABLE bid.bid_oem_entries CASCADE;
TRUNCATE TABLE bid.bid_distributor_quotes CASCADE;
TRUNCATE TABLE bid.bid_stage_history CASCADE;
TRUNCATE TABLE bid.bid_checklists CASCADE;
TRUNCATE TABLE bid.bid_workspace_members CASCADE;
TRUNCATE TABLE bid.bid_workspaces CASCADE;

-- 3. Delete non-Sadmin user mappings
DELETE FROM auth.user_roles 
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE LOWER(username) = 'sadmin'
);

DELETE FROM auth.user_permission_overrides 
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE LOWER(username) = 'sadmin'
);

DELETE FROM auth.password_otps;

-- 4. Delete all users except Sadmin
DELETE FROM auth.users WHERE LOWER(username) != 'sadmin';

-- 5. Reset / Ensure Sadmin account exists cleanly with password Admin@123
INSERT INTO auth.users (employee_code, username, email, full_name, password_hash, force_password_change, is_active)
VALUES ('SA001', 'sadmin', 'biswabhusans@globx.co.in', 'Biswa SuperAdmin', 
        '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK', false, true)
ON CONFLICT (username) DO UPDATE SET
    username = 'sadmin',
    email = 'biswabhusans@globx.co.in',
    password_hash = '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK',
    is_active = true,
    force_password_change = false;

UPDATE auth.users SET username = LOWER(username);

-- 6. Ensure Sadmin has SUPER_ADMIN role assigned
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r 
WHERE LOWER(u.username) = 'sadmin' AND r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
