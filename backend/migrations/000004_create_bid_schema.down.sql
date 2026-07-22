-- Rollback Migration 000004
DROP TABLE IF EXISTS bid.bid_stage_history;
DROP TABLE IF EXISTS bid.bid_workspace_members;
DROP TABLE IF EXISTS bid.bid_workspaces;
DROP SCHEMA IF EXISTS bid;
