-- Migration 000024: Drop the unused task schema
-- The task module (task board / checklist system) was fully built but never
-- wired into any route or nav item on the frontend, and carried zero rows.
-- Removing it along with its backend module and frontend components.

DROP SCHEMA IF EXISTS task CASCADE;
