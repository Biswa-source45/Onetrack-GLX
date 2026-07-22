-- Migration 000005: Create task schema and tables
-- Shared execution surface for both MANUAL and INTELLIGENCE modes

CREATE SCHEMA IF NOT EXISTS task;

-- Core task entity (supports hierarchy: Task -> Subtask)
CREATE TABLE task.tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id                  UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    parent_task_id          UUID REFERENCES task.tasks(id) ON DELETE CASCADE,

    -- Classification
    task_type               VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    -- GENERAL | DOCUMENT_COLLECTION | OEM_COORDINATION | QUALIFICATION |
    -- COMMERCIAL | APPROVAL | REVIEW | SUBMISSION | CHECKLIST | CUSTOM
    -- AI_GENERATED is a valid type for intelligence-mode tasks

    task_category           VARCHAR(50),
    title                   TEXT NOT NULL,
    description             TEXT,

    -- Lifecycle
    status                  VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN (
                                'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_EXTERNAL',
                                'BLOCKED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED',
                                'ESCALATED', 'REOPENED'
                            )),
    priority                VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                            CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    -- Assignment
    assigned_to             UUID REFERENCES auth.users(id),
    created_by              UUID NOT NULL REFERENCES auth.users(id),

    -- Deadlines
    due_date                TIMESTAMPTZ,
    sla_deadline            TIMESTAMPTZ,

    -- Progress
    completion_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 0
                            CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

    -- Source tracking (AI-generated tasks carry a reference)
    source                  VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                            CHECK (source IN ('MANUAL', 'AI_GENERATED', 'TEMPLATE')),
    ai_confidence           NUMERIC(5, 4),

    -- Dynamic metadata (OEM details, document refs, etc.)
    metadata                JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable activity timeline for each task
CREATE TABLE task.task_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    activity_type   VARCHAR(50) NOT NULL,
    -- COMMENT | STATUS_CHANGED | ASSIGNED | ATTACHMENT_ADDED |
    -- CALL_LOGGED | EMAIL_LOGGED | ESCALATED | DEADLINE_CHANGED
    activity_data   JSONB NOT NULL DEFAULT '{}',
    performed_by    UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task dependency relationships
CREATE TABLE task.task_dependencies (
    task_id             UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    depends_on_task_id  UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    dependency_type     VARCHAR(30) NOT NULL DEFAULT 'FINISH_TO_START'
                        CHECK (dependency_type IN ('FINISH_TO_START', 'START_TO_START', 'APPROVAL')),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id != depends_on_task_id)
);

-- Checklist items within a task
CREATE TABLE task.task_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT false,
    done_by     UUID REFERENCES auth.users(id),
    done_at     TIMESTAMPTZ,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_bid_id ON task.tasks(bid_id);
CREATE INDEX idx_tasks_parent_task_id ON task.tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned_to ON task.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON task.tasks(status);
CREATE INDEX idx_tasks_priority ON task.tasks(priority);
CREATE INDEX idx_tasks_due_date ON task.tasks(due_date);
CREATE INDEX idx_tasks_created_at ON task.tasks(created_at DESC);
CREATE INDEX idx_task_activities_task_id ON task.task_activities(task_id);
CREATE INDEX idx_task_activities_created_at ON task.task_activities(created_at DESC);
CREATE INDEX idx_task_checklists_task_id ON task.task_checklists(task_id);
