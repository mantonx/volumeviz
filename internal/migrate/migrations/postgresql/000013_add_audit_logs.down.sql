-- Migration 000013 Rollback: Remove Audit Logs Table

DROP VIEW IF EXISTS recent_audit_events;
DROP TABLE IF EXISTS audit_logs CASCADE;
