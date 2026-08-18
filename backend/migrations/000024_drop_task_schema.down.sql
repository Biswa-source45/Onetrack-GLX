-- Rollback Migration 000024: recreate the task schema exactly as 000005 defined it
CREATE SCHEMA IF NOT EXISTS task;

CREATE TABLE task.tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id                  UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    parent_task_id          UUID REFERENCES task.tasks(id) ON DELETE CASCADE,

    task_type               VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    task_category           VARCHAR(50),
    title                   TEXT NOT NULL,
    description             TEXT,

    status                  VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN (
                                'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_EXTERNAL',
                                'BLOCKED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED',
                                'ESCALATED', 'REOPENED'
                            )),
    priority                VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                            CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    assigned_to             UUID REFERENCES auth.users(id),
    created_by              UUID NOT NULL REFERENCES auth.users(id),

    due_date                TIMESTAMPTZ,
    sla_deadline            TIMESTAMPTZ,

    completion_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 0
                            CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

    source                  VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                            CHECK (source IN ('MANUAL', 'AI_GENERATED', 'TEMPLATE')),
    ai_confidence           NUMERIC(5, 4),

    metadata                JSONB NOT NULL DEFAULT '{}',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task.task_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    activity_type   VARCHAR(50) NOT NULL,
    activity_data   JSONB NOT NULL DEFAULT '{}',
    performed_by    UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task.task_dependencies (
    task_id             UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    depends_on_task_id  UUID NOT NULL REFERENCES task.tasks(id) ON DELETE CASCADE,
    dependency_type     VARCHAR(30) NOT NULL DEFAULT 'FINISH_TO_START'
                        CHECK (dependency_type IN ('FINISH_TO_START', 'START_TO_START', 'APPROVAL')),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id != depends_on_task_id)
);

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
