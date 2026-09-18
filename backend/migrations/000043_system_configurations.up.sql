-- Migration 000043: System Configurations table for global runtime settings.
--
-- auth.system_configurations stores dynamic platform settings managed by SUPER_ADMIN,
-- such as Stage 2 workflow requirements, automated notifications, etc.

CREATE TABLE IF NOT EXISTS auth.system_configurations (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES auth.users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial seed: stage2_require_am_presales defaults to true (maintaining existing strict AM/Pre-Sales flow)
INSERT INTO auth.system_configurations (key, value, description)
VALUES (
    'stage2_require_am_presales',
    'true'::jsonb,
    'Require Account Manager and Pre-Sales roles to execute Stage 2 Primary Review'
)
ON CONFLICT (key) DO NOTHING;
