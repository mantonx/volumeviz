-- Health and diagnostic queries

-- name: HealthCheck :one
SELECT 1 as status;

-- name: GetTotalVolumeCount :one
SELECT COUNT(*) FROM volumes;

-- name: GetTotalScanJobCount :one  
SELECT COUNT(*) FROM scan_jobs;

-- name: GetTotalMetricsCount :one
SELECT COUNT(*) FROM volume_metrics;