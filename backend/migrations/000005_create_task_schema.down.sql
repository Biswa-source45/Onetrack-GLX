-- Rollback Migration 000005
DROP TABLE IF EXISTS task.task_checklists;
DROP TABLE IF EXISTS task.task_dependencies;
DROP TABLE IF EXISTS task.task_activities;
DROP TABLE IF EXISTS task.tasks;
DROP SCHEMA IF EXISTS task;
