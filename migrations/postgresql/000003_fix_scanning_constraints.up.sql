-- Migration: Fix scanning system constraints
-- Created: 2025-10-01
-- Purpose: Align database constraints with actual application code usage

-- =============================================================================
-- Fix scan_phases phase_name constraint
-- =============================================================================
-- The original constraint only allowed: discovery, analysis, indexing, metadata_extraction, finalization
-- But the code uses: volume_scan, filesystem_indexing, media_enrichment
-- This migration adds the code's phase names while keeping originals for backwards compatibility

ALTER TABLE scan_phases DROP CONSTRAINT IF EXISTS scan_phases_phase_name_check;
ALTER TABLE scan_phases ADD CONSTRAINT scan_phases_phase_name_check
  CHECK (phase_name IN (
    -- New phase names used by application code
    'volume_scan',
    'filesystem_indexing',
    'media_enrichment',
    -- Original phase names (kept for backwards compatibility)
    'discovery',
    'analysis',
    'indexing',
    'metadata_extraction',
    'finalization'
  ));

-- =============================================================================
-- Fix scan_phases status constraint
-- =============================================================================
-- The original constraint didn't include 'pending' status
-- But the code creates phases with status='pending'

ALTER TABLE scan_phases DROP CONSTRAINT IF EXISTS scan_phases_status_check;
ALTER TABLE scan_phases ADD CONSTRAINT scan_phases_status_check
  CHECK (status IN (
    'pending',    -- Added: code creates phases with this status
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'paused'
  ));

-- =============================================================================
-- Create scan_errors table
-- =============================================================================
-- This table was missing from original migrations but is referenced throughout the code

CREATE TABLE IF NOT EXISTS scan_errors (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    phase_name TEXT,

    -- Error classification
    error_type TEXT NOT NULL,      -- ffprobe_failed, permission_denied, file_not_found, timeout, etc.
    error_category TEXT,            -- system, tool, file, network, timeout, permission
    severity TEXT,                  -- warning, error, critical

    -- Error context
    component TEXT,                 -- ffprobe, exiftool, filesystem_indexer, volume_scanner
    operation TEXT,                 -- scan_volume, index_file, enrich_media, extract_metadata

    -- Item that failed
    item_path TEXT,
    item_name TEXT,
    item_type TEXT,
    item_size BIGINT,

    -- Error details
    error_message TEXT NOT NULL,
    error_code TEXT,
    stack_trace TEXT,
    technical_details TEXT,         -- JSON encoded details

    -- Timing
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Context (JSON encoded context)
    context TEXT,

    -- Recovery attempts
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 0,
    retry_after TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scan_errors_scan_id ON scan_errors(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_errors_occurred_at ON scan_errors(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_errors_severity ON scan_errors(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_scan_errors_phase ON scan_errors(scan_id, phase_name);
