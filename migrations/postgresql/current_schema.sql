--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: mount_access_mode; Type: TYPE; Schema: public; Owner: volumeviz
--

CREATE TYPE public.mount_access_mode AS ENUM (
    'rw',
    'ro'
);


ALTER TYPE public.mount_access_mode OWNER TO volumeviz;

--
-- Name: mount_type; Type: TYPE; Schema: public; Owner: volumeviz
--

CREATE TYPE public.mount_type AS ENUM (
    'volume',
    'bind',
    'tmpfs'
);


ALTER TYPE public.mount_type OWNER TO volumeviz;

--
-- Name: rule_action; Type: TYPE; Schema: public; Owner: volumeviz
--

CREATE TYPE public.rule_action AS ENUM (
    'include',
    'exclude'
);


ALTER TYPE public.rule_action OWNER TO volumeviz;

--
-- Name: rule_evaluation_status; Type: TYPE; Schema: public; Owner: volumeviz
--

CREATE TYPE public.rule_evaluation_status AS ENUM (
    'pending',
    'success',
    'error',
    'skipped'
);


ALTER TYPE public.rule_evaluation_status OWNER TO volumeviz;

--
-- Name: rule_operator; Type: TYPE; Schema: public; Owner: volumeviz
--

CREATE TYPE public.rule_operator AS ENUM (
    'equals',
    'not_equals',
    'regex',
    'not_regex',
    'prefix',
    'suffix',
    'contains',
    'not_contains',
    'glob',
    'in',
    'not_in'
);


ALTER TYPE public.rule_operator OWNER TO volumeviz;

--
-- Name: cleanup_old_snapshots(integer); Type: FUNCTION; Schema: public; Owner: volumeviz
--

CREATE FUNCTION public.cleanup_old_snapshots(p_retention_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete snapshots older than retention period, keeping at least last 3 per volume
    WITH ranked_snapshots AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY volume_id ORDER BY snapshot_time DESC) as rn,
               created_at
        FROM volume_snapshots
    )
    DELETE FROM volume_snapshots
    WHERE id IN (
        SELECT id FROM ranked_snapshots
        WHERE rn > 10 OR created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_snapshots(p_retention_days integer) OWNER TO volumeviz;

--
-- Name: get_latest_snapshot(text); Type: FUNCTION; Schema: public; Owner: volumeviz
--

CREATE FUNCTION public.get_latest_snapshot(p_volume_id text) RETURNS TABLE(snapshot_id bigint, snapshot_time timestamp with time zone, total_size bigint, file_count bigint, folder_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT id, snapshot_time, total_size, file_count, folder_count
    FROM volume_snapshots
    WHERE volume_id = p_volume_id
    ORDER BY snapshot_time DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION public.get_latest_snapshot(p_volume_id text) OWNER TO volumeviz;

--
-- Name: update_scan_checkpoint_updated_at(); Type: FUNCTION; Schema: public; Owner: volumeviz
--

CREATE FUNCTION public.update_scan_checkpoint_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_scan_checkpoint_updated_at() OWNER TO volumeviz;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: volumeviz
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO volumeviz;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: scan_jobs; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_jobs (
    scan_id text NOT NULL,
    volume_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    total_files bigint DEFAULT 0,
    scanned_files bigint DEFAULT 0,
    failed_files bigint DEFAULT 0,
    total_bytes bigint DEFAULT 0,
    scanned_bytes bigint DEFAULT 0,
    scan_rate_files_per_sec numeric(10,2),
    scan_rate_mb_per_sec numeric(10,2),
    error_message text,
    error_details jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    paused_at timestamp with time zone,
    pause_reason text,
    duration_seconds integer,
    triggered_by text,
    scan_options jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id bigint,
    CONSTRAINT scan_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'paused'::text])))
);


ALTER TABLE public.scan_jobs OWNER TO volumeviz;

--
-- Name: scan_phases; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_phases (
    id bigint NOT NULL,
    scan_id text NOT NULL,
    phase_name text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress_percent integer DEFAULT 0,
    items_total bigint DEFAULT 0,
    items_processed bigint DEFAULT 0,
    items_failed bigint DEFAULT 0,
    current_item text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    throughput_items_per_sec numeric(10,2),
    memory_usage_mb bigint,
    error_message text,
    pause_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sub_phase text,
    progress integer GENERATED ALWAYS AS (progress_percent) STORED,
    CONSTRAINT scan_phases_phase_name_check CHECK ((phase_name = ANY (ARRAY['volume_scan'::text, 'filesystem_indexing'::text, 'media_enrichment'::text, 'discovery'::text, 'analysis'::text, 'indexing'::text, 'metadata_extraction'::text, 'finalization'::text]))),
    CONSTRAINT scan_phases_progress_percent_check CHECK (((progress_percent >= 0) AND (progress_percent <= 100))),
    CONSTRAINT scan_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'paused'::text])))
);


ALTER TABLE public.scan_phases OWNER TO volumeviz;

--
-- Name: COLUMN scan_phases.sub_phase; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.scan_phases.sub_phase IS 'Current sub-phase or enricher being executed (e.g., ffprobe, exiftool)';


--
-- Name: active_scans; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.active_scans AS
 SELECT sj.scan_id,
    sj.volume_id,
    sj.status,
    sj.started_at,
    sj.updated_at,
    sj.completed_at,
    sj.error_message,
    COALESCE(( SELECT avg(
                CASE
                    WHEN (sp.items_total > 0) THEN (((sp.items_processed)::double precision / (sp.items_total)::double precision) * (100)::double precision)
                    ELSE (0)::double precision
                END) AS avg
           FROM public.scan_phases sp
          WHERE (sp.scan_id = sj.scan_id)), (0)::double precision) AS overall_progress_percent,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE (sp.scan_id = sj.scan_id)) AS total_phases,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE ((sp.scan_id = sj.scan_id) AND (sp.status = 'completed'::text))) AS completed_phases,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE ((sp.scan_id = sj.scan_id) AND (sp.status = 'running'::text))) AS running_phases,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE ((sp.scan_id = sj.scan_id) AND (sp.status = 'failed'::text))) AS failed_phases,
    EXTRACT(epoch FROM (COALESCE(sj.completed_at, CURRENT_TIMESTAMP) - sj.started_at)) AS duration_seconds,
    EXTRACT(epoch FROM (CURRENT_TIMESTAMP - sj.updated_at)) AS seconds_since_update
   FROM public.scan_jobs sj
  WHERE (sj.status = ANY (ARRAY['running'::text, 'paused'::text]))
  ORDER BY sj.started_at DESC;


ALTER TABLE public.active_scans OWNER TO volumeviz;

--
-- Name: alert_deliveries; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.alert_deliveries (
    id bigint NOT NULL,
    alert_id bigint NOT NULL,
    destination_id bigint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0,
    last_attempt_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_message text,
    response_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alert_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'retrying'::text])))
);


ALTER TABLE public.alert_deliveries OWNER TO volumeviz;

--
-- Name: alert_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.alert_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alert_deliveries_id_seq OWNER TO volumeviz;

--
-- Name: alert_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.alert_deliveries_id_seq OWNED BY public.alert_deliveries.id;


--
-- Name: alert_destinations; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.alert_destinations (
    id bigint NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    configuration jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alert_destinations_type_check CHECK ((type = ANY (ARRAY['email'::text, 'webhook'::text, 'slack'::text, 'teams'::text])))
);


ALTER TABLE public.alert_destinations OWNER TO volumeviz;

--
-- Name: alert_destinations_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.alert_destinations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alert_destinations_id_seq OWNER TO volumeviz;

--
-- Name: alert_destinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.alert_destinations_id_seq OWNED BY public.alert_destinations.id;


--
-- Name: alert_routes; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.alert_routes (
    id bigint NOT NULL,
    rule_id bigint NOT NULL,
    destination_id bigint NOT NULL,
    severity_filter text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.alert_routes OWNER TO volumeviz;

--
-- Name: alert_routes_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.alert_routes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alert_routes_id_seq OWNER TO volumeviz;

--
-- Name: alert_routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.alert_routes_id_seq OWNED BY public.alert_routes.id;


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.alert_rules (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    rule_type text NOT NULL,
    metric_name text NOT NULL,
    condition_operator text NOT NULL,
    threshold_value numeric(20,4) NOT NULL,
    time_window_minutes integer DEFAULT 60,
    min_occurrences integer DEFAULT 1,
    is_enabled boolean DEFAULT true,
    severity text DEFAULT 'medium'::text NOT NULL,
    cooldown_minutes integer DEFAULT 60,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id bigint,
    CONSTRAINT alert_rules_condition_operator_check CHECK ((condition_operator = ANY (ARRAY['>'::text, '<'::text, '>='::text, '<='::text, '=='::text, '!='::text]))),
    CONSTRAINT alert_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['threshold'::text, 'growth_rate'::text, 'anomaly'::text, 'custom'::text]))),
    CONSTRAINT alert_rules_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


ALTER TABLE public.alert_rules OWNER TO volumeviz;

--
-- Name: alert_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.alert_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alert_rules_id_seq OWNER TO volumeviz;

--
-- Name: alert_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.alert_rules_id_seq OWNED BY public.alert_rules.id;


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.alerts (
    id bigint NOT NULL,
    rule_id bigint NOT NULL,
    volume_id text,
    severity text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    context_data jsonb DEFAULT '{}'::jsonb,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


ALTER TABLE public.alerts OWNER TO volumeviz;

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alerts_id_seq OWNER TO volumeviz;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint,
    action character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id character varying(255),
    ip_address character varying(45),
    user_agent text,
    status character varying(50) NOT NULL,
    details jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO volumeviz;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO volumeviz;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: daily_stats; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.daily_stats (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    date date NOT NULL,
    total_size_bytes bigint DEFAULT 0,
    size_change_bytes bigint DEFAULT 0,
    growth_percent numeric(8,4),
    total_files bigint DEFAULT 0,
    new_files bigint DEFAULT 0,
    deleted_files bigint DEFAULT 0,
    modified_files bigint DEFAULT 0,
    media_files bigint DEFAULT 0,
    document_files bigint DEFAULT 0,
    code_files bigint DEFAULT 0,
    archive_files bigint DEFAULT 0,
    other_files bigint DEFAULT 0,
    scan_duration_ms bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    disk_total_bytes bigint,
    disk_available_bytes bigint
);


ALTER TABLE public.daily_stats OWNER TO volumeviz;

--
-- Name: daily_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.daily_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.daily_stats_id_seq OWNER TO volumeviz;

--
-- Name: daily_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.daily_stats_id_seq OWNED BY public.daily_stats.id;


--
-- Name: docker_mount_attachments; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.docker_mount_attachments (
    id bigint NOT NULL,
    mount_catalog_id bigint,
    container_id text NOT NULL,
    container_name text,
    destination_path text NOT NULL,
    access_mode public.mount_access_mode DEFAULT 'rw'::public.mount_access_mode NOT NULL,
    propagation text,
    container_state text,
    container_image text,
    container_labels jsonb DEFAULT '{}'::jsonb,
    container_compose_project text,
    container_compose_service text,
    container_compose_container_number integer,
    container_compose_config_hash text,
    attached_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    detached_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.docker_mount_attachments OWNER TO volumeviz;

--
-- Name: docker_mount_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.docker_mount_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.docker_mount_attachments_id_seq OWNER TO volumeviz;

--
-- Name: docker_mount_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.docker_mount_attachments_id_seq OWNED BY public.docker_mount_attachments.id;


--
-- Name: docker_mount_catalog; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.docker_mount_catalog (
    id bigint NOT NULL,
    mount_id text NOT NULL,
    mount_type public.mount_type NOT NULL,
    volume_name text,
    volume_driver text,
    volume_options jsonb DEFAULT '{}'::jsonb,
    volume_labels jsonb DEFAULT '{}'::jsonb,
    volume_scope text,
    source_path text NOT NULL,
    container_count integer DEFAULT 0 NOT NULL,
    is_orphaned boolean DEFAULT false NOT NULL,
    compose_project text,
    compose_services text[],
    compose_version text,
    compose_config_files text[],
    first_discovered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    discovery_source text DEFAULT 'docker_engine'::text NOT NULL,
    is_tracked boolean DEFAULT false NOT NULL,
    tracking_enabled_at timestamp with time zone,
    tracking_disabled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    organization_id bigint
);


ALTER TABLE public.docker_mount_catalog OWNER TO volumeviz;

--
-- Name: docker_mount_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.docker_mount_catalog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.docker_mount_catalog_id_seq OWNER TO volumeviz;

--
-- Name: docker_mount_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.docker_mount_catalog_id_seq OWNED BY public.docker_mount_catalog.id;


--
-- Name: docker_mount_statistics; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.docker_mount_statistics (
    id bigint NOT NULL,
    mount_catalog_id bigint NOT NULL,
    peak_container_count integer DEFAULT 0 NOT NULL,
    total_attachments integer DEFAULT 0 NOT NULL,
    compose_projects_count integer DEFAULT 0 NOT NULL,
    compose_services_count integer DEFAULT 0 NOT NULL,
    days_since_creation integer,
    days_since_last_use integer,
    attachment_frequency_score real,
    last_known_size_bytes bigint,
    last_scanned_at timestamp with time zone,
    calculated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.docker_mount_statistics OWNER TO volumeviz;

--
-- Name: docker_mount_statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.docker_mount_statistics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.docker_mount_statistics_id_seq OWNER TO volumeviz;

--
-- Name: docker_mount_statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.docker_mount_statistics_id_seq OWNED BY public.docker_mount_statistics.id;


--
-- Name: docker_projects; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.docker_projects (
    id bigint NOT NULL,
    project_name text NOT NULL,
    compose_file_path text,
    compose_file_hash text,
    working_directory text,
    services text[],
    networks text[],
    volumes text[],
    config_data jsonb DEFAULT '{}'::jsonb,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.docker_projects OWNER TO volumeviz;

--
-- Name: docker_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.docker_projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.docker_projects_id_seq OWNER TO volumeviz;

--
-- Name: docker_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.docker_projects_id_seq OWNED BY public.docker_projects.id;


--
-- Name: file_metadata; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.file_metadata (
    id bigint NOT NULL,
    file_id bigint NOT NULL,
    raw_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    extracted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    extractor_version text,
    extraction_duration_ms integer,
    error_message text
);


ALTER TABLE public.file_metadata OWNER TO volumeviz;

--
-- Name: file_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.file_metadata_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.file_metadata_id_seq OWNER TO volumeviz;

--
-- Name: file_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.file_metadata_id_seq OWNED BY public.file_metadata.id;


--
-- Name: file_previews; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.file_previews (
    id bigint NOT NULL,
    file_id bigint NOT NULL,
    preview_type text NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    width integer,
    height integer,
    format text,
    status text DEFAULT 'pending'::text NOT NULL,
    generated_at timestamp with time zone,
    error_message text,
    processing_duration_ms integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT file_previews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);


ALTER TABLE public.file_previews OWNER TO volumeviz;

--
-- Name: file_previews_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.file_previews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.file_previews_id_seq OWNER TO volumeviz;

--
-- Name: file_previews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.file_previews_id_seq OWNED BY public.file_previews.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.files (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    folder_id bigint,
    path text NOT NULL,
    path_hash text NOT NULL,
    name text NOT NULL,
    extension text,
    mime text,
    size_bytes bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    accessed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    mode integer,
    owner_uid integer,
    owner_gid integer,
    content_hash text,
    is_text boolean DEFAULT false,
    is_binary boolean DEFAULT true,
    media_kind text,
    duration_ms bigint,
    bitrate_kbps integer,
    width integer,
    height integer,
    fps numeric(10,2),
    color_primaries text,
    transfer_characteristic text,
    hdr_format text,
    capture_datetime timestamp with time zone,
    camera_make text,
    camera_model text,
    lens_model text,
    orientation integer,
    gps_latitude numeric(10,7),
    gps_longitude numeric(11,7),
    subtitle_language text,
    subtitle_format text,
    cue_count integer,
    coverage_percent numeric(5,2),
    audio_channels integer,
    audio_codec text,
    audio_sample_rate integer,
    video_codec text,
    video_profile text,
    video_level text,
    first_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_scan_at timestamp with time zone,
    organization_id bigint
);


ALTER TABLE public.files OWNER TO volumeviz;

--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.files_id_seq OWNER TO volumeviz;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: folders; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.folders (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    parent_id bigint,
    path text NOT NULL,
    name text NOT NULL,
    path_hash text NOT NULL,
    size_bytes bigint DEFAULT 0,
    size_bytes_recursive bigint DEFAULT 0,
    file_count integer DEFAULT 0,
    file_count_recursive integer DEFAULT 0,
    subfolder_count integer DEFAULT 0,
    media_file_count integer DEFAULT 0,
    has_media_files boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    accessed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id bigint
);


ALTER TABLE public.folders OWNER TO volumeviz;

--
-- Name: folders_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.folders_id_seq OWNER TO volumeviz;

--
-- Name: folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.folders_id_seq OWNED BY public.folders.id;


--
-- Name: mount_tracking_assignments; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.mount_tracking_assignments (
    id bigint NOT NULL,
    mount_catalog_id bigint,
    rule_id bigint,
    evaluation_id bigint,
    action public.rule_action NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    matched_conditions jsonb,
    rule_priority integer,
    rule_name text,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.mount_tracking_assignments OWNER TO volumeviz;

--
-- Name: mount_tracking_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.mount_tracking_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.mount_tracking_assignments_id_seq OWNER TO volumeviz;

--
-- Name: mount_tracking_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.mount_tracking_assignments_id_seq OWNED BY public.mount_tracking_assignments.id;


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.organization_invitations (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    token character varying(255) NOT NULL,
    invited_by bigint,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    accepted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'expired'::character varying, 'revoked'::character varying])::text[])))
);


ALTER TABLE public.organization_invitations OWNER TO volumeviz;

--
-- Name: organization_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.organization_invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organization_invitations_id_seq OWNER TO volumeviz;

--
-- Name: organization_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.organization_invitations_id_seq OWNED BY public.organization_invitations.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    subdomain text,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    max_users integer DEFAULT 50,
    max_volumes integer DEFAULT 100,
    max_storage_gb bigint DEFAULT 1000,
    plan_type text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT org_display_name_length CHECK ((length(TRIM(BOTH FROM display_name)) >= 3)),
    CONSTRAINT org_name_length CHECK ((length(TRIM(BOTH FROM name)) >= 3)),
    CONSTRAINT organizations_plan_type_check CHECK ((plan_type = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


ALTER TABLE public.organizations OWNER TO volumeviz;

--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organizations_id_seq OWNER TO volumeviz;

--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO volumeviz;

--
-- Name: pending_invitations; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.pending_invitations AS
 SELECT oi.id,
    oi.organization_id,
    o.name AS organization_name,
    oi.email,
    oi.role,
    oi.token,
    oi.invited_by,
    u.username AS invited_by_username,
    oi.expires_at,
    oi.created_at
   FROM ((public.organization_invitations oi
     JOIN public.organizations o ON ((oi.organization_id = o.id)))
     LEFT JOIN public.users u ON ((oi.invited_by = u.id)))
  WHERE (((oi.status)::text = 'pending'::text) AND (oi.expires_at > now()))
  ORDER BY oi.created_at DESC;


ALTER TABLE public.pending_invitations OWNER TO volumeviz;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.permissions (
    id bigint NOT NULL,
    role character varying(50) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    organization_id bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO volumeviz;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.permissions_id_seq OWNER TO volumeviz;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: recent_audit_events; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.recent_audit_events AS
 SELECT al.id,
    al.organization_id,
    al.user_id,
    u.username,
    u.email,
    al.action,
    al.resource_type,
    al.resource_id,
    al.ip_address,
    al.status,
    al.details,
    al.created_at
   FROM (public.audit_logs al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
  ORDER BY al.created_at DESC;


ALTER TABLE public.recent_audit_events OWNER TO volumeviz;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO volumeviz;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO volumeviz;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: saved_searches; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.saved_searches (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    query jsonb NOT NULL,
    tags text[],
    is_public boolean DEFAULT false,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_run_at timestamp with time zone,
    run_count integer DEFAULT 0,
    organization_id bigint,
    CONSTRAINT saved_searches_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


ALTER TABLE public.saved_searches OWNER TO volumeviz;

--
-- Name: saved_searches_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.saved_searches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.saved_searches_id_seq OWNER TO volumeviz;

--
-- Name: saved_searches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.saved_searches_id_seq OWNED BY public.saved_searches.id;


--
-- Name: scan_checkpoints; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_checkpoints (
    id bigint NOT NULL,
    scan_id text NOT NULL,
    volume_id text NOT NULL,
    checkpoint_type text NOT NULL,
    phase text NOT NULL,
    progress double precision DEFAULT 0.0 NOT NULL,
    items_processed bigint DEFAULT 0 NOT NULL,
    bytes_processed bigint DEFAULT 0 NOT NULL,
    errors_count bigint DEFAULT 0 NOT NULL,
    last_path text,
    last_depth integer,
    last_folder_id bigint,
    resume_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.scan_checkpoints OWNER TO volumeviz;

--
-- Name: TABLE scan_checkpoints; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON TABLE public.scan_checkpoints IS 'Stores periodic checkpoints during volume scans to enable resume capability after crashes or interruptions. Critical for 1TB+ volumes with multi-hour scan times.';


--
-- Name: COLUMN scan_checkpoints.checkpoint_type; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.scan_checkpoints.checkpoint_type IS 'Type of scan phase being checkpointed: volume_scan (size calculation), filesystem_indexing (file/folder crawl), enrichment (media metadata)';


--
-- Name: COLUMN scan_checkpoints.last_folder_id; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.scan_checkpoints.last_folder_id IS 'ID of last processed folder in folders table. Used to resume filesystem indexing from exact position.';


--
-- Name: COLUMN scan_checkpoints.resume_data; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.scan_checkpoints.resume_data IS 'JSON object containing phase-specific data needed to resume. Example: {"method": "diskus", "started_at": "2025-10-05T10:00:00Z"}';


--
-- Name: scan_checkpoints_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.scan_checkpoints_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_checkpoints_id_seq OWNER TO volumeviz;

--
-- Name: scan_checkpoints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.scan_checkpoints_id_seq OWNED BY public.scan_checkpoints.id;


--
-- Name: scan_errors; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_errors (
    id bigint NOT NULL,
    scan_id text NOT NULL,
    phase_name text,
    error_type text NOT NULL,
    error_category text,
    severity text,
    component text,
    operation text,
    item_path text,
    item_name text,
    item_type text,
    item_size bigint,
    error_message text NOT NULL,
    error_code text,
    stack_trace text,
    technical_details text,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    context text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 0,
    retry_after timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.scan_errors OWNER TO volumeviz;

--
-- Name: scan_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.scan_errors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_errors_id_seq OWNER TO volumeviz;

--
-- Name: scan_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.scan_errors_id_seq OWNED BY public.scan_errors.id;


--
-- Name: scan_history; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.scan_history AS
 SELECT sj.scan_id,
    sj.volume_id,
    sj.status,
    sj.started_at,
    sj.completed_at,
    EXTRACT(epoch FROM (sj.completed_at - sj.started_at)) AS duration_seconds,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE ((sp.scan_id = sj.scan_id) AND (sp.status = 'completed'::text))) AS completed_phases,
    ( SELECT count(*) AS count
           FROM public.scan_phases sp
          WHERE ((sp.scan_id = sj.scan_id) AND (sp.status = 'failed'::text))) AS failed_phases,
    ( SELECT sum(sp.items_processed) AS sum
           FROM public.scan_phases sp
          WHERE (sp.scan_id = sj.scan_id)) AS total_items_processed
   FROM public.scan_jobs sj
  WHERE (sj.status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text]))
  ORDER BY sj.completed_at DESC;


ALTER TABLE public.scan_history OWNER TO volumeviz;

--
-- Name: scan_performance_metrics; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_performance_metrics (
    id bigint NOT NULL,
    scan_id text NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric(15,4) NOT NULL,
    metric_unit text,
    measured_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    phase text
);


ALTER TABLE public.scan_performance_metrics OWNER TO volumeviz;

--
-- Name: scan_performance_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.scan_performance_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_performance_metrics_id_seq OWNER TO volumeviz;

--
-- Name: scan_performance_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.scan_performance_metrics_id_seq OWNED BY public.scan_performance_metrics.id;


--
-- Name: scan_phase_steps; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.scan_phase_steps (
    id bigint NOT NULL,
    phase_id bigint NOT NULL,
    step_name text NOT NULL,
    step_order integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress_percent integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    result_data jsonb DEFAULT '{}'::jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT scan_phase_steps_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'paused'::text])))
);


ALTER TABLE public.scan_phase_steps OWNER TO volumeviz;

--
-- Name: scan_phase_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.scan_phase_steps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_phase_steps_id_seq OWNER TO volumeviz;

--
-- Name: scan_phase_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.scan_phase_steps_id_seq OWNED BY public.scan_phase_steps.id;


--
-- Name: scan_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.scan_phases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_phases_id_seq OWNER TO volumeviz;

--
-- Name: scan_phases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.scan_phases_id_seq OWNED BY public.scan_phases.id;


--
-- Name: scan_progress_summary; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.scan_progress_summary AS
 SELECT sj.scan_id,
    sj.volume_id,
    sj.status AS scan_status,
    sj.started_at AS scan_started_at,
    sj.completed_at AS scan_completed_at,
    sp.phase_name,
    sp.status AS phase_status,
    sp.started_at AS phase_started_at,
    sp.completed_at AS phase_completed_at,
    sp.items_processed,
    sp.items_total,
    sp.items_failed,
    sp.current_item,
    sp.progress_percent,
    sp.error_message AS phase_error,
    sp.pause_reason,
    sp.throughput_items_per_sec,
    sp.memory_usage_mb,
        CASE
            WHEN (sp.items_total > 0) THEN round((((sp.items_processed)::numeric / (sp.items_total)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS phase_progress_percent,
    EXTRACT(epoch FROM (COALESCE(sp.completed_at, CURRENT_TIMESTAMP) - sp.started_at)) AS phase_duration_seconds
   FROM (public.scan_jobs sj
     LEFT JOIN public.scan_phases sp ON ((sj.scan_id = sp.scan_id)))
  WHERE (sj.started_at >= (CURRENT_TIMESTAMP - '7 days'::interval))
  ORDER BY sj.started_at DESC, sp.started_at;


ALTER TABLE public.scan_progress_summary OWNER TO volumeviz;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO volumeviz;

--
-- Name: stats_jobs; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.stats_jobs (
    id bigint NOT NULL,
    job_id text NOT NULL,
    job_type text NOT NULL,
    volume_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    progress integer DEFAULT 0,
    error_message text,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    duration_ms bigint,
    records_processed bigint DEFAULT 0,
    organization_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stats_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['daily_stats'::text, 'growth_analysis'::text, 'trend_computation'::text, 'media_analysis'::text, 'capacity_prediction'::text]))),
    CONSTRAINT stats_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


ALTER TABLE public.stats_jobs OWNER TO volumeviz;

--
-- Name: TABLE stats_jobs; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON TABLE public.stats_jobs IS 'Background jobs for statistics computation and analysis';


--
-- Name: COLUMN stats_jobs.job_id; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.job_id IS 'Unique identifier for the job (UUID or generated string)';


--
-- Name: COLUMN stats_jobs.job_type; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.job_type IS 'Type of statistics job being executed';


--
-- Name: COLUMN stats_jobs.volume_id; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.volume_id IS 'Volume this job is processing (null for system-wide jobs)';


--
-- Name: COLUMN stats_jobs.progress; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.progress IS 'Job progress percentage (0-100)';


--
-- Name: COLUMN stats_jobs.duration_ms; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.duration_ms IS 'Job execution duration in milliseconds';


--
-- Name: COLUMN stats_jobs.records_processed; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.stats_jobs.records_processed IS 'Number of records/files processed by this job';


--
-- Name: stats_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.stats_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stats_jobs_id_seq OWNER TO volumeviz;

--
-- Name: stats_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.stats_jobs_id_seq OWNED BY public.stats_jobs.id;


--
-- Name: tracking_rule_conditions; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.tracking_rule_conditions (
    id bigint NOT NULL,
    rule_id bigint,
    field_name text NOT NULL,
    operator public.rule_operator NOT NULL,
    value text,
    "values" text[],
    is_case_sensitive boolean DEFAULT true NOT NULL,
    description text,
    match_count integer DEFAULT 0 NOT NULL,
    last_matched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tracking_rule_conditions OWNER TO volumeviz;

--
-- Name: tracking_rule_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.tracking_rule_conditions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tracking_rule_conditions_id_seq OWNER TO volumeviz;

--
-- Name: tracking_rule_conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.tracking_rule_conditions_id_seq OWNED BY public.tracking_rule_conditions.id;


--
-- Name: tracking_rule_evaluations; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.tracking_rule_evaluations (
    id bigint NOT NULL,
    rule_id bigint,
    evaluation_type text NOT NULL,
    triggered_by text,
    status public.rule_evaluation_status NOT NULL,
    mounts_evaluated integer DEFAULT 0 NOT NULL,
    mounts_matched integer DEFAULT 0 NOT NULL,
    mounts_included integer DEFAULT 0 NOT NULL,
    mounts_excluded integer DEFAULT 0 NOT NULL,
    execution_time_ms integer,
    error_message text,
    error_details jsonb,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tracking_rule_evaluations OWNER TO volumeviz;

--
-- Name: tracking_rule_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.tracking_rule_evaluations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tracking_rule_evaluations_id_seq OWNER TO volumeviz;

--
-- Name: tracking_rule_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.tracking_rule_evaluations_id_seq OWNED BY public.tracking_rule_evaluations.id;


--
-- Name: tracking_rule_templates; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.tracking_rule_templates (
    id bigint NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    template_data jsonb NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    is_builtin boolean DEFAULT false NOT NULL,
    tags text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tracking_rule_templates OWNER TO volumeviz;

--
-- Name: tracking_rule_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.tracking_rule_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tracking_rule_templates_id_seq OWNER TO volumeviz;

--
-- Name: tracking_rule_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.tracking_rule_templates_id_seq OWNED BY public.tracking_rule_templates.id;


--
-- Name: tracking_rules; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.tracking_rules (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    action public.rule_action NOT NULL,
    priority integer DEFAULT 1000 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    match_count integer DEFAULT 0 NOT NULL,
    last_matched_at timestamp with time zone,
    last_evaluation_at timestamp with time zone,
    created_by text DEFAULT 'system'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    organization_id bigint
);


ALTER TABLE public.tracking_rules OWNER TO volumeviz;

--
-- Name: tracking_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.tracking_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tracking_rules_id_seq OWNER TO volumeviz;

--
-- Name: tracking_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.tracking_rules_id_seq OWNED BY public.tracking_rules.id;


--
-- Name: usage_snapshots; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.usage_snapshots (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    snapshot_date date NOT NULL,
    total_size_bytes bigint DEFAULT 0 NOT NULL,
    total_files bigint DEFAULT 0 NOT NULL,
    total_directories bigint DEFAULT 0 NOT NULL,
    size_change_bytes bigint DEFAULT 0,
    files_change bigint DEFAULT 0,
    growth_rate numeric(8,4),
    largest_file_size bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.usage_snapshots OWNER TO volumeviz;

--
-- Name: usage_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.usage_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.usage_snapshots_id_seq OWNER TO volumeviz;

--
-- Name: usage_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.usage_snapshots_id_seq OWNED BY public.usage_snapshots.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO volumeviz;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: volume_directory_snapshots; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.volume_directory_snapshots (
    id bigint NOT NULL,
    snapshot_id bigint NOT NULL,
    volume_id text NOT NULL,
    dir_path text NOT NULL,
    dir_mtime timestamp with time zone NOT NULL,
    dir_size bigint DEFAULT 0 NOT NULL,
    file_count integer DEFAULT 0 NOT NULL,
    subdir_count integer DEFAULT 0 NOT NULL,
    content_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.volume_directory_snapshots OWNER TO volumeviz;

--
-- Name: TABLE volume_directory_snapshots; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON TABLE public.volume_directory_snapshots IS 'Stores directory-level snapshots for fine-grained change detection. Allows identifying specific directories that changed.';


--
-- Name: COLUMN volume_directory_snapshots.content_hash; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volume_directory_snapshots.content_hash IS 'Hash of directory contents (filenames + sizes). Used to detect if directory contents changed.';


--
-- Name: volume_directory_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.volume_directory_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.volume_directory_snapshots_id_seq OWNER TO volumeviz;

--
-- Name: volume_directory_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.volume_directory_snapshots_id_seq OWNED BY public.volume_directory_snapshots.id;


--
-- Name: volume_scan_stats; Type: VIEW; Schema: public; Owner: volumeviz
--

CREATE VIEW public.volume_scan_stats AS
 SELECT sj.volume_id,
    count(*) AS total_scans,
    count(*) FILTER (WHERE (sj.status = 'completed'::text)) AS successful_scans,
    count(*) FILTER (WHERE (sj.status = 'failed'::text)) AS failed_scans,
    count(*) FILTER (WHERE (sj.status = 'running'::text)) AS running_scans,
    max(sj.started_at) AS last_scan_started,
    max(sj.completed_at) AS last_scan_completed,
    avg(EXTRACT(epoch FROM (sj.completed_at - sj.started_at))) FILTER (WHERE (sj.status = 'completed'::text)) AS avg_scan_duration_seconds
   FROM public.scan_jobs sj
  WHERE (sj.started_at >= (CURRENT_TIMESTAMP - '30 days'::interval))
  GROUP BY sj.volume_id
  ORDER BY (max(sj.started_at)) DESC;


ALTER TABLE public.volume_scan_stats OWNER TO volumeviz;

--
-- Name: volume_sizes; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.volume_sizes (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    total_size bigint DEFAULT 0 NOT NULL,
    file_count bigint DEFAULT 0 NOT NULL,
    directory_count bigint DEFAULT 0 NOT NULL,
    largest_file_size bigint DEFAULT 0,
    smallest_file_size bigint DEFAULT 0,
    average_file_size bigint DEFAULT 0,
    median_file_size bigint DEFAULT 0,
    type_distribution jsonb DEFAULT '{}'::jsonb,
    extension_distribution jsonb DEFAULT '{}'::jsonb,
    calculated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.volume_sizes OWNER TO volumeviz;

--
-- Name: volume_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.volume_sizes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.volume_sizes_id_seq OWNER TO volumeviz;

--
-- Name: volume_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.volume_sizes_id_seq OWNED BY public.volume_sizes.id;


--
-- Name: volume_snapshots; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.volume_snapshots (
    id bigint NOT NULL,
    volume_id text NOT NULL,
    scan_id text NOT NULL,
    snapshot_time timestamp with time zone DEFAULT now() NOT NULL,
    scan_method text NOT NULL,
    total_size bigint DEFAULT 0 NOT NULL,
    file_count bigint DEFAULT 0 NOT NULL,
    folder_count bigint DEFAULT 0 NOT NULL,
    root_mtime timestamp with time zone,
    content_hash text,
    scan_duration_ms bigint,
    indexing_duration_ms bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.volume_snapshots OWNER TO volumeviz;

--
-- Name: TABLE volume_snapshots; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON TABLE public.volume_snapshots IS 'Stores volume state snapshots for incremental scanning. Enables detecting changes between scans to avoid full rescans of unchanged data.';


--
-- Name: COLUMN volume_snapshots.content_hash; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volume_snapshots.content_hash IS 'Optional hash of directory tree structure. Can be used for quick change detection without walking the filesystem.';


--
-- Name: volume_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: volumeviz
--

CREATE SEQUENCE public.volume_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.volume_snapshots_id_seq OWNER TO volumeviz;

--
-- Name: volume_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volumeviz
--

ALTER SEQUENCE public.volume_snapshots_id_seq OWNED BY public.volume_snapshots.id;


--
-- Name: volumes; Type: TABLE; Schema: public; Owner: volumeviz
--

CREATE TABLE public.volumes (
    volume_id text NOT NULL,
    display_name text,
    mount_point text NOT NULL,
    container_names text[],
    is_active boolean DEFAULT true,
    total_size_bytes bigint DEFAULT 0,
    used_size_bytes bigint DEFAULT 0,
    free_size_bytes bigint DEFAULT 0,
    filesystem_type text,
    container_count integer DEFAULT 0,
    first_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_scan_at timestamp with time zone,
    last_modified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id bigint,
    driver text DEFAULT 'local'::text,
    scope text DEFAULT 'local'::text,
    labels jsonb DEFAULT '{}'::jsonb,
    options jsonb DEFAULT '{}'::jsonb,
    is_tracked boolean DEFAULT true NOT NULL,
    tracked_at timestamp with time zone,
    untracked_at timestamp with time zone
);


ALTER TABLE public.volumes OWNER TO volumeviz;

--
-- Name: COLUMN volumes.driver; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.driver IS 'Docker volume driver (local, nfs, cifs, etc.)';


--
-- Name: COLUMN volumes.scope; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.scope IS 'Docker volume scope (local or global)';


--
-- Name: COLUMN volumes.labels; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.labels IS 'Docker volume labels as JSON object';


--
-- Name: COLUMN volumes.options; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.options IS 'Driver-specific options (e.g., device path for bind mounts)';


--
-- Name: COLUMN volumes.is_tracked; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.is_tracked IS 'Indicates whether this volume is actively tracked in VolumeViz. When FALSE, associated data should be removed from the database.';


--
-- Name: COLUMN volumes.tracked_at; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.tracked_at IS 'Timestamp when the volume was last set to tracked status';


--
-- Name: COLUMN volumes.untracked_at; Type: COMMENT; Schema: public; Owner: volumeviz
--

COMMENT ON COLUMN public.volumes.untracked_at IS 'Timestamp when the volume was last set to untracked status';


--
-- Name: alert_deliveries id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_deliveries ALTER COLUMN id SET DEFAULT nextval('public.alert_deliveries_id_seq'::regclass);


--
-- Name: alert_destinations id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_destinations ALTER COLUMN id SET DEFAULT nextval('public.alert_destinations_id_seq'::regclass);


--
-- Name: alert_routes id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_routes ALTER COLUMN id SET DEFAULT nextval('public.alert_routes_id_seq'::regclass);


--
-- Name: alert_rules id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_rules ALTER COLUMN id SET DEFAULT nextval('public.alert_rules_id_seq'::regclass);


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: daily_stats id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.daily_stats ALTER COLUMN id SET DEFAULT nextval('public.daily_stats_id_seq'::regclass);


--
-- Name: docker_mount_attachments id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_attachments ALTER COLUMN id SET DEFAULT nextval('public.docker_mount_attachments_id_seq'::regclass);


--
-- Name: docker_mount_catalog id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_catalog ALTER COLUMN id SET DEFAULT nextval('public.docker_mount_catalog_id_seq'::regclass);


--
-- Name: docker_mount_statistics id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_statistics ALTER COLUMN id SET DEFAULT nextval('public.docker_mount_statistics_id_seq'::regclass);


--
-- Name: docker_projects id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_projects ALTER COLUMN id SET DEFAULT nextval('public.docker_projects_id_seq'::regclass);


--
-- Name: file_metadata id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_metadata ALTER COLUMN id SET DEFAULT nextval('public.file_metadata_id_seq'::regclass);


--
-- Name: file_previews id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_previews ALTER COLUMN id SET DEFAULT nextval('public.file_previews_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: folders id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders ALTER COLUMN id SET DEFAULT nextval('public.folders_id_seq'::regclass);


--
-- Name: mount_tracking_assignments id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.mount_tracking_assignments ALTER COLUMN id SET DEFAULT nextval('public.mount_tracking_assignments_id_seq'::regclass);


--
-- Name: organization_invitations id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organization_invitations ALTER COLUMN id SET DEFAULT nextval('public.organization_invitations_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: saved_searches id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.saved_searches ALTER COLUMN id SET DEFAULT nextval('public.saved_searches_id_seq'::regclass);


--
-- Name: scan_checkpoints id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_checkpoints ALTER COLUMN id SET DEFAULT nextval('public.scan_checkpoints_id_seq'::regclass);


--
-- Name: scan_errors id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_errors ALTER COLUMN id SET DEFAULT nextval('public.scan_errors_id_seq'::regclass);


--
-- Name: scan_performance_metrics id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_performance_metrics ALTER COLUMN id SET DEFAULT nextval('public.scan_performance_metrics_id_seq'::regclass);


--
-- Name: scan_phase_steps id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phase_steps ALTER COLUMN id SET DEFAULT nextval('public.scan_phase_steps_id_seq'::regclass);


--
-- Name: scan_phases id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phases ALTER COLUMN id SET DEFAULT nextval('public.scan_phases_id_seq'::regclass);


--
-- Name: stats_jobs id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.stats_jobs ALTER COLUMN id SET DEFAULT nextval('public.stats_jobs_id_seq'::regclass);


--
-- Name: tracking_rule_conditions id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_conditions ALTER COLUMN id SET DEFAULT nextval('public.tracking_rule_conditions_id_seq'::regclass);


--
-- Name: tracking_rule_evaluations id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_evaluations ALTER COLUMN id SET DEFAULT nextval('public.tracking_rule_evaluations_id_seq'::regclass);


--
-- Name: tracking_rule_templates id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_templates ALTER COLUMN id SET DEFAULT nextval('public.tracking_rule_templates_id_seq'::regclass);


--
-- Name: tracking_rules id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rules ALTER COLUMN id SET DEFAULT nextval('public.tracking_rules_id_seq'::regclass);


--
-- Name: usage_snapshots id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.usage_snapshots ALTER COLUMN id SET DEFAULT nextval('public.usage_snapshots_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: volume_directory_snapshots id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_directory_snapshots ALTER COLUMN id SET DEFAULT nextval('public.volume_directory_snapshots_id_seq'::regclass);


--
-- Name: volume_sizes id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_sizes ALTER COLUMN id SET DEFAULT nextval('public.volume_sizes_id_seq'::regclass);


--
-- Name: volume_snapshots id; Type: DEFAULT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_snapshots ALTER COLUMN id SET DEFAULT nextval('public.volume_snapshots_id_seq'::regclass);


--
-- Name: alert_deliveries alert_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_deliveries
    ADD CONSTRAINT alert_deliveries_pkey PRIMARY KEY (id);


--
-- Name: alert_destinations alert_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_destinations
    ADD CONSTRAINT alert_destinations_pkey PRIMARY KEY (id);


--
-- Name: alert_routes alert_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_routes
    ADD CONSTRAINT alert_routes_pkey PRIMARY KEY (id);


--
-- Name: alert_routes alert_routes_rule_id_destination_id_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_routes
    ADD CONSTRAINT alert_routes_rule_id_destination_id_key UNIQUE (rule_id, destination_id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: daily_stats daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_pkey PRIMARY KEY (id);


--
-- Name: daily_stats daily_stats_volume_id_date_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_volume_id_date_key UNIQUE (volume_id, date);


--
-- Name: docker_mount_attachments docker_mount_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_attachments
    ADD CONSTRAINT docker_mount_attachments_pkey PRIMARY KEY (id);


--
-- Name: docker_mount_catalog docker_mount_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_catalog
    ADD CONSTRAINT docker_mount_catalog_pkey PRIMARY KEY (id);


--
-- Name: docker_mount_statistics docker_mount_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_statistics
    ADD CONSTRAINT docker_mount_statistics_pkey PRIMARY KEY (id);


--
-- Name: docker_projects docker_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_projects
    ADD CONSTRAINT docker_projects_pkey PRIMARY KEY (id);


--
-- Name: docker_projects docker_projects_project_name_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_projects
    ADD CONSTRAINT docker_projects_project_name_key UNIQUE (project_name);


--
-- Name: file_metadata file_metadata_file_id_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_file_id_key UNIQUE (file_id);


--
-- Name: file_metadata file_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_pkey PRIMARY KEY (id);


--
-- Name: file_previews file_previews_file_id_preview_type_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_previews
    ADD CONSTRAINT file_previews_file_id_preview_type_key UNIQUE (file_id, preview_type);


--
-- Name: file_previews file_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_previews
    ADD CONSTRAINT file_previews_pkey PRIMARY KEY (id);


--
-- Name: files files_path_hash_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_path_hash_key UNIQUE (path_hash);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: folders folders_path_hash_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_path_hash_key UNIQUE (path_hash);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: folders folders_volume_id_path_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_volume_id_path_key UNIQUE (volume_id, path);


--
-- Name: mount_tracking_assignments mount_tracking_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.mount_tracking_assignments
    ADD CONSTRAINT mount_tracking_assignments_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_key UNIQUE (token);


--
-- Name: organizations organizations_name_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_name_key UNIQUE (name);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_key UNIQUE (subdomain);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_role_resource_action_unique; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_role_resource_action_unique UNIQUE (role, resource, action, organization_id);


--
-- Name: roles roles_name_org_unique; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_org_unique UNIQUE (name, organization_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: saved_searches saved_searches_name_unique; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_name_unique UNIQUE (name);


--
-- Name: saved_searches saved_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);


--
-- Name: scan_checkpoints scan_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_checkpoints
    ADD CONSTRAINT scan_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: scan_errors scan_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_errors
    ADD CONSTRAINT scan_errors_pkey PRIMARY KEY (id);


--
-- Name: scan_jobs scan_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_jobs
    ADD CONSTRAINT scan_jobs_pkey PRIMARY KEY (scan_id);


--
-- Name: scan_performance_metrics scan_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_performance_metrics
    ADD CONSTRAINT scan_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: scan_phase_steps scan_phase_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phase_steps
    ADD CONSTRAINT scan_phase_steps_pkey PRIMARY KEY (id);


--
-- Name: scan_phases scan_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phases
    ADD CONSTRAINT scan_phases_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: stats_jobs stats_jobs_job_id_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.stats_jobs
    ADD CONSTRAINT stats_jobs_job_id_key UNIQUE (job_id);


--
-- Name: stats_jobs stats_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.stats_jobs
    ADD CONSTRAINT stats_jobs_pkey PRIMARY KEY (id);


--
-- Name: tracking_rule_conditions tracking_rule_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_conditions
    ADD CONSTRAINT tracking_rule_conditions_pkey PRIMARY KEY (id);


--
-- Name: tracking_rule_evaluations tracking_rule_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_evaluations
    ADD CONSTRAINT tracking_rule_evaluations_pkey PRIMARY KEY (id);


--
-- Name: tracking_rule_templates tracking_rule_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_templates
    ADD CONSTRAINT tracking_rule_templates_name_key UNIQUE (name);


--
-- Name: tracking_rule_templates tracking_rule_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_templates
    ADD CONSTRAINT tracking_rule_templates_pkey PRIMARY KEY (id);


--
-- Name: tracking_rules tracking_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rules
    ADD CONSTRAINT tracking_rules_pkey PRIMARY KEY (id);


--
-- Name: docker_mount_attachments unique_active_attachment; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_attachments
    ADD CONSTRAINT unique_active_attachment UNIQUE (mount_catalog_id, container_id, destination_path) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: docker_mount_catalog unique_mount_id; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_catalog
    ADD CONSTRAINT unique_mount_id UNIQUE (mount_id);


--
-- Name: scan_checkpoints unique_scan_checkpoint; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_checkpoints
    ADD CONSTRAINT unique_scan_checkpoint UNIQUE (scan_id, checkpoint_type);


--
-- Name: usage_snapshots usage_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.usage_snapshots
    ADD CONSTRAINT usage_snapshots_pkey PRIMARY KEY (id);


--
-- Name: usage_snapshots usage_snapshots_volume_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.usage_snapshots
    ADD CONSTRAINT usage_snapshots_volume_id_snapshot_date_key UNIQUE (volume_id, snapshot_date);


--
-- Name: users users_email_org_unique; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_org_unique UNIQUE (email, organization_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_org_unique; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_org_unique UNIQUE (username, organization_id);


--
-- Name: volume_directory_snapshots volume_directory_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_directory_snapshots
    ADD CONSTRAINT volume_directory_snapshots_pkey PRIMARY KEY (id);


--
-- Name: volume_sizes volume_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_sizes
    ADD CONSTRAINT volume_sizes_pkey PRIMARY KEY (id);


--
-- Name: volume_sizes volume_sizes_volume_id_key; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_sizes
    ADD CONSTRAINT volume_sizes_volume_id_key UNIQUE (volume_id);


--
-- Name: volume_snapshots volume_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_snapshots
    ADD CONSTRAINT volume_snapshots_pkey PRIMARY KEY (id);


--
-- Name: volumes volumes_pkey; Type: CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volumes
    ADD CONSTRAINT volumes_pkey PRIMARY KEY (volume_id);


--
-- Name: idx_alert_deliveries_alert_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alert_deliveries_alert_id ON public.alert_deliveries USING btree (alert_id);


--
-- Name: idx_alert_deliveries_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alert_deliveries_status ON public.alert_deliveries USING btree (status);


--
-- Name: idx_alert_rules_enabled; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alert_rules_enabled ON public.alert_rules USING btree (is_enabled);


--
-- Name: idx_alerts_resolved; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alerts_resolved ON public.alerts USING btree (is_resolved);


--
-- Name: idx_alerts_rule_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alerts_rule_id ON public.alerts USING btree (rule_id);


--
-- Name: idx_alerts_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_alerts_volume_id ON public.alerts USING btree (volume_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_details_gin; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_details_gin ON public.audit_logs USING gin (details);


--
-- Name: idx_audit_logs_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs USING btree (organization_id);


--
-- Name: idx_audit_logs_resource_type; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs USING btree (resource_type);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_status ON public.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_daily_stats_date; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_daily_stats_date ON public.daily_stats USING btree (date);


--
-- Name: idx_daily_stats_volume_date; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_daily_stats_volume_date ON public.daily_stats USING btree (volume_id, date);


--
-- Name: idx_docker_mount_attachments_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_active ON public.docker_mount_attachments USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_docker_mount_attachments_compose_project; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_compose_project ON public.docker_mount_attachments USING btree (container_compose_project) WHERE (container_compose_project IS NOT NULL);


--
-- Name: idx_docker_mount_attachments_compose_service; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_compose_service ON public.docker_mount_attachments USING btree (container_compose_service) WHERE (container_compose_service IS NOT NULL);


--
-- Name: idx_docker_mount_attachments_container_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_container_id ON public.docker_mount_attachments USING btree (container_id);


--
-- Name: idx_docker_mount_attachments_mount_catalog_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_mount_catalog_id ON public.docker_mount_attachments USING btree (mount_catalog_id) WHERE (mount_catalog_id IS NOT NULL);


--
-- Name: idx_docker_mount_attachments_mount_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_attachments_mount_id ON public.docker_mount_attachments USING btree (mount_catalog_id);


--
-- Name: idx_docker_mount_catalog_compose_project; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_compose_project ON public.docker_mount_catalog USING btree (compose_project) WHERE (compose_project IS NOT NULL);


--
-- Name: idx_docker_mount_catalog_last_seen; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_last_seen ON public.docker_mount_catalog USING btree (last_seen_at);


--
-- Name: idx_docker_mount_catalog_mount_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_mount_id ON public.docker_mount_catalog USING btree (mount_id);


--
-- Name: idx_docker_mount_catalog_mount_type; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_mount_type ON public.docker_mount_catalog USING btree (mount_type);


--
-- Name: idx_docker_mount_catalog_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_organization_id ON public.docker_mount_catalog USING btree (organization_id);


--
-- Name: idx_docker_mount_catalog_orphaned; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_orphaned ON public.docker_mount_catalog USING btree (is_orphaned) WHERE (is_orphaned = true);


--
-- Name: idx_docker_mount_catalog_tracked; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_tracked ON public.docker_mount_catalog USING btree (is_tracked);


--
-- Name: idx_docker_mount_catalog_volume_name; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_docker_mount_catalog_volume_name ON public.docker_mount_catalog USING btree (volume_name) WHERE (volume_name IS NOT NULL);


--
-- Name: idx_file_metadata_extracted; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_file_metadata_extracted ON public.file_metadata USING btree (extracted_at);


--
-- Name: idx_file_metadata_file_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_file_metadata_file_id ON public.file_metadata USING btree (file_id);


--
-- Name: idx_file_previews_file_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_file_previews_file_id ON public.file_previews USING btree (file_id);


--
-- Name: idx_file_previews_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_file_previews_status ON public.file_previews USING btree (status);


--
-- Name: idx_files_content_hash; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_content_hash ON public.files USING btree (content_hash) WHERE (content_hash IS NOT NULL);


--
-- Name: idx_files_extension; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_extension ON public.files USING btree (extension);


--
-- Name: idx_files_folder_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_folder_id ON public.files USING btree (folder_id);


--
-- Name: idx_files_media_kind; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_media_kind ON public.files USING btree (media_kind) WHERE (media_kind IS NOT NULL);


--
-- Name: idx_files_mime; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_mime ON public.files USING btree (mime);


--
-- Name: idx_files_modified; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_modified ON public.files USING btree (modified_at);


--
-- Name: idx_files_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_organization_id ON public.files USING btree (organization_id);


--
-- Name: idx_files_path_hash; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_path_hash ON public.files USING btree (path_hash);


--
-- Name: idx_files_size; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_size ON public.files USING btree (size_bytes);


--
-- Name: idx_files_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_files_volume_id ON public.files USING btree (volume_id);


--
-- Name: idx_folders_media; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_folders_media ON public.folders USING btree (volume_id, has_media_files) WHERE (has_media_files = true);


--
-- Name: idx_folders_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_folders_organization_id ON public.folders USING btree (organization_id);


--
-- Name: idx_folders_parent_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_folders_parent_id ON public.folders USING btree (parent_id);


--
-- Name: idx_folders_path_hash; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_folders_path_hash ON public.folders USING btree (path_hash);


--
-- Name: idx_folders_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_folders_volume_id ON public.folders USING btree (volume_id);


--
-- Name: idx_mount_assignments_action; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_mount_assignments_action ON public.mount_tracking_assignments USING btree (action) WHERE (is_active = true);


--
-- Name: idx_mount_assignments_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_mount_assignments_active ON public.mount_tracking_assignments USING btree (is_active, assigned_at DESC);


--
-- Name: idx_mount_assignments_mount_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_mount_assignments_mount_id ON public.mount_tracking_assignments USING btree (mount_catalog_id);


--
-- Name: idx_mount_assignments_rule_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_mount_assignments_rule_id ON public.mount_tracking_assignments USING btree (rule_id);


--
-- Name: idx_mount_assignments_unique_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE UNIQUE INDEX idx_mount_assignments_unique_active ON public.mount_tracking_assignments USING btree (mount_catalog_id) WHERE (is_active = true);


--
-- Name: idx_org_invitations_email; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_email ON public.organization_invitations USING btree (email);


--
-- Name: idx_org_invitations_expires_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_expires_at ON public.organization_invitations USING btree (expires_at);


--
-- Name: idx_org_invitations_invited_by; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_invited_by ON public.organization_invitations USING btree (invited_by);


--
-- Name: idx_org_invitations_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_organization_id ON public.organization_invitations USING btree (organization_id);


--
-- Name: idx_org_invitations_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_status ON public.organization_invitations USING btree (status);


--
-- Name: idx_org_invitations_token; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_org_invitations_token ON public.organization_invitations USING btree (token);


--
-- Name: idx_organizations_is_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_organizations_is_active ON public.organizations USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_organizations_name; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_organizations_name ON public.organizations USING btree (name);


--
-- Name: idx_permissions_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_permissions_organization_id ON public.permissions USING btree (organization_id);


--
-- Name: idx_permissions_resource; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_permissions_resource ON public.permissions USING btree (resource);


--
-- Name: idx_permissions_role; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_permissions_role ON public.permissions USING btree (role);


--
-- Name: idx_roles_is_system; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_roles_is_system ON public.roles USING btree (is_system);


--
-- Name: idx_roles_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_roles_organization_id ON public.roles USING btree (organization_id);


--
-- Name: idx_rule_conditions_field; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_conditions_field ON public.tracking_rule_conditions USING btree (field_name);


--
-- Name: idx_rule_conditions_rule_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_conditions_rule_id ON public.tracking_rule_conditions USING btree (rule_id);


--
-- Name: idx_rule_evaluations_rule_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_evaluations_rule_id ON public.tracking_rule_evaluations USING btree (rule_id);


--
-- Name: idx_rule_evaluations_started; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_evaluations_started ON public.tracking_rule_evaluations USING btree (started_at DESC);


--
-- Name: idx_rule_evaluations_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_evaluations_status ON public.tracking_rule_evaluations USING btree (status);


--
-- Name: idx_rule_evaluations_type; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_evaluations_type ON public.tracking_rule_evaluations USING btree (evaluation_type);


--
-- Name: idx_rule_templates_builtin; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_templates_builtin ON public.tracking_rule_templates USING btree (is_builtin);


--
-- Name: idx_rule_templates_category; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_rule_templates_category ON public.tracking_rule_templates USING btree (category);


--
-- Name: idx_saved_searches_is_public; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_saved_searches_is_public ON public.saved_searches USING btree (is_public);


--
-- Name: idx_saved_searches_last_run_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_saved_searches_last_run_at ON public.saved_searches USING btree (last_run_at DESC) WHERE (last_run_at IS NOT NULL);


--
-- Name: idx_saved_searches_name; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_saved_searches_name ON public.saved_searches USING btree (name);


--
-- Name: idx_saved_searches_tags; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_saved_searches_tags ON public.saved_searches USING gin (tags);


--
-- Name: idx_saved_searches_updated_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_saved_searches_updated_at ON public.saved_searches USING btree (updated_at DESC);


--
-- Name: idx_scan_checkpoints_created_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_checkpoints_created_at ON public.scan_checkpoints USING btree (created_at);


--
-- Name: idx_scan_checkpoints_scan_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_checkpoints_scan_id ON public.scan_checkpoints USING btree (scan_id);


--
-- Name: idx_scan_checkpoints_updated_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_checkpoints_updated_at ON public.scan_checkpoints USING btree (updated_at DESC);


--
-- Name: idx_scan_checkpoints_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_checkpoints_volume_id ON public.scan_checkpoints USING btree (volume_id);


--
-- Name: idx_scan_errors_occurred_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_errors_occurred_at ON public.scan_errors USING btree (occurred_at DESC);


--
-- Name: idx_scan_errors_phase; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_errors_phase ON public.scan_errors USING btree (scan_id, phase_name);


--
-- Name: idx_scan_errors_scan_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_errors_scan_id ON public.scan_errors USING btree (scan_id);


--
-- Name: idx_scan_errors_severity; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_errors_severity ON public.scan_errors USING btree (severity) WHERE (severity = ANY (ARRAY['error'::text, 'critical'::text]));


--
-- Name: idx_scan_jobs_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_jobs_organization_id ON public.scan_jobs USING btree (organization_id);


--
-- Name: idx_scan_jobs_started; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_jobs_started ON public.scan_jobs USING btree (started_at);


--
-- Name: idx_scan_jobs_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_jobs_status ON public.scan_jobs USING btree (status);


--
-- Name: idx_scan_jobs_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_scan_jobs_volume_id ON public.scan_jobs USING btree (volume_id);


--
-- Name: idx_stats_jobs_created_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_stats_jobs_created_at ON public.stats_jobs USING btree (created_at DESC);


--
-- Name: idx_stats_jobs_job_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_stats_jobs_job_id ON public.stats_jobs USING btree (job_id);


--
-- Name: idx_stats_jobs_org_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_stats_jobs_org_id ON public.stats_jobs USING btree (organization_id);


--
-- Name: idx_stats_jobs_status; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_stats_jobs_status ON public.stats_jobs USING btree (status);


--
-- Name: idx_stats_jobs_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_stats_jobs_volume_id ON public.stats_jobs USING btree (volume_id);


--
-- Name: idx_tracking_rules_action; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_tracking_rules_action ON public.tracking_rules USING btree (action);


--
-- Name: idx_tracking_rules_enabled; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_tracking_rules_enabled ON public.tracking_rules USING btree (is_enabled);


--
-- Name: idx_tracking_rules_priority; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_tracking_rules_priority ON public.tracking_rules USING btree (priority, id) WHERE (is_enabled = true);


--
-- Name: idx_tracking_rules_updated; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_tracking_rules_updated ON public.tracking_rules USING btree (updated_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_volume_dir_snapshots_mtime; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_dir_snapshots_mtime ON public.volume_directory_snapshots USING btree (dir_mtime DESC);


--
-- Name: idx_volume_dir_snapshots_path; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_dir_snapshots_path ON public.volume_directory_snapshots USING btree (volume_id, dir_path);


--
-- Name: idx_volume_dir_snapshots_snapshot; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_dir_snapshots_snapshot ON public.volume_directory_snapshots USING btree (snapshot_id);


--
-- Name: idx_volume_dir_snapshots_volume; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_dir_snapshots_volume ON public.volume_directory_snapshots USING btree (volume_id);


--
-- Name: idx_volume_snapshots_created_at; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_snapshots_created_at ON public.volume_snapshots USING btree (created_at);


--
-- Name: idx_volume_snapshots_scan_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_snapshots_scan_id ON public.volume_snapshots USING btree (scan_id);


--
-- Name: idx_volume_snapshots_snapshot_time; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_snapshots_snapshot_time ON public.volume_snapshots USING btree (snapshot_time DESC);


--
-- Name: idx_volume_snapshots_volume_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volume_snapshots_volume_id ON public.volume_snapshots USING btree (volume_id);


--
-- Name: idx_volumes_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_active ON public.volumes USING btree (is_active);


--
-- Name: idx_volumes_container_count; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_container_count ON public.volumes USING btree (container_count) WHERE (container_count > 0);


--
-- Name: idx_volumes_driver; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_driver ON public.volumes USING btree (driver);


--
-- Name: idx_volumes_is_tracked; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_is_tracked ON public.volumes USING btree (is_tracked);


--
-- Name: idx_volumes_labels; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_labels ON public.volumes USING gin (labels);


--
-- Name: idx_volumes_last_scan; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_last_scan ON public.volumes USING btree (last_scan_at);


--
-- Name: idx_volumes_options; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_options ON public.volumes USING gin (options);


--
-- Name: idx_volumes_organization_id; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_organization_id ON public.volumes USING btree (organization_id);


--
-- Name: idx_volumes_tracked_active; Type: INDEX; Schema: public; Owner: volumeviz
--

CREATE INDEX idx_volumes_tracked_active ON public.volumes USING btree (is_tracked, is_active) WHERE (is_tracked = true);


--
-- Name: alert_destinations alert_destinations_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER alert_destinations_updated_at_trigger BEFORE UPDATE ON public.alert_destinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: alert_rules alert_rules_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER alert_rules_updated_at_trigger BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: docker_mount_attachments docker_mount_attachments_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER docker_mount_attachments_updated_at_trigger BEFORE UPDATE ON public.docker_mount_attachments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: docker_mount_catalog docker_mount_catalog_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER docker_mount_catalog_updated_at_trigger BEFORE UPDATE ON public.docker_mount_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: mount_tracking_assignments mount_tracking_assignments_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER mount_tracking_assignments_updated_at_trigger BEFORE UPDATE ON public.mount_tracking_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: saved_searches saved_searches_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER saved_searches_updated_at_trigger BEFORE UPDATE ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tracking_rule_conditions tracking_rule_conditions_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER tracking_rule_conditions_updated_at_trigger BEFORE UPDATE ON public.tracking_rule_conditions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tracking_rule_templates tracking_rule_templates_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER tracking_rule_templates_updated_at_trigger BEFORE UPDATE ON public.tracking_rule_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tracking_rules tracking_rules_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER tracking_rules_updated_at_trigger BEFORE UPDATE ON public.tracking_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: scan_checkpoints trigger_update_scan_checkpoint_updated_at; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER trigger_update_scan_checkpoint_updated_at BEFORE UPDATE ON public.scan_checkpoints FOR EACH ROW EXECUTE FUNCTION public.update_scan_checkpoint_updated_at();


--
-- Name: volumes volumes_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: volumeviz
--

CREATE TRIGGER volumes_updated_at_trigger BEFORE UPDATE ON public.volumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: alert_deliveries alert_deliveries_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_deliveries
    ADD CONSTRAINT alert_deliveries_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;


--
-- Name: alert_deliveries alert_deliveries_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_deliveries
    ADD CONSTRAINT alert_deliveries_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.alert_destinations(id) ON DELETE CASCADE;


--
-- Name: alert_routes alert_routes_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_routes
    ADD CONSTRAINT alert_routes_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.alert_destinations(id) ON DELETE CASCADE;


--
-- Name: alert_routes alert_routes_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_routes
    ADD CONSTRAINT alert_routes_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;


--
-- Name: alert_rules alert_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_stats daily_stats_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: docker_mount_attachments docker_mount_attachments_mount_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_attachments
    ADD CONSTRAINT docker_mount_attachments_mount_catalog_id_fkey FOREIGN KEY (mount_catalog_id) REFERENCES public.docker_mount_catalog(id) ON DELETE CASCADE;


--
-- Name: docker_mount_catalog docker_mount_catalog_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_catalog
    ADD CONSTRAINT docker_mount_catalog_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: docker_mount_statistics docker_mount_statistics_mount_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.docker_mount_statistics
    ADD CONSTRAINT docker_mount_statistics_mount_catalog_id_fkey FOREIGN KEY (mount_catalog_id) REFERENCES public.docker_mount_catalog(id) ON DELETE CASCADE;


--
-- Name: file_metadata file_metadata_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_previews file_previews_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.file_previews
    ADD CONSTRAINT file_previews_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: files files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: files files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: files files_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: volume_directory_snapshots fk_snapshot; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_directory_snapshots
    ADD CONSTRAINT fk_snapshot FOREIGN KEY (snapshot_id) REFERENCES public.volume_snapshots(id) ON DELETE CASCADE;


--
-- Name: folders folders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folders folders_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: mount_tracking_assignments mount_tracking_assignments_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.mount_tracking_assignments
    ADD CONSTRAINT mount_tracking_assignments_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.tracking_rule_evaluations(id) ON DELETE SET NULL;


--
-- Name: mount_tracking_assignments mount_tracking_assignments_mount_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.mount_tracking_assignments
    ADD CONSTRAINT mount_tracking_assignments_mount_catalog_id_fkey FOREIGN KEY (mount_catalog_id) REFERENCES public.docker_mount_catalog(id) ON DELETE CASCADE;


--
-- Name: mount_tracking_assignments mount_tracking_assignments_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.mount_tracking_assignments
    ADD CONSTRAINT mount_tracking_assignments_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.tracking_rules(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: permissions permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: saved_searches saved_searches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scan_errors scan_errors_scan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_errors
    ADD CONSTRAINT scan_errors_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scan_jobs(scan_id) ON DELETE CASCADE;


--
-- Name: scan_jobs scan_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_jobs
    ADD CONSTRAINT scan_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scan_jobs scan_jobs_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_jobs
    ADD CONSTRAINT scan_jobs_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: scan_performance_metrics scan_performance_metrics_scan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_performance_metrics
    ADD CONSTRAINT scan_performance_metrics_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scan_jobs(scan_id) ON DELETE CASCADE;


--
-- Name: scan_phase_steps scan_phase_steps_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phase_steps
    ADD CONSTRAINT scan_phase_steps_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.scan_phases(id) ON DELETE CASCADE;


--
-- Name: scan_phases scan_phases_scan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.scan_phases
    ADD CONSTRAINT scan_phases_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scan_jobs(scan_id) ON DELETE CASCADE;


--
-- Name: tracking_rule_conditions tracking_rule_conditions_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_conditions
    ADD CONSTRAINT tracking_rule_conditions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.tracking_rules(id) ON DELETE CASCADE;


--
-- Name: tracking_rule_evaluations tracking_rule_evaluations_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rule_evaluations
    ADD CONSTRAINT tracking_rule_evaluations_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.tracking_rules(id) ON DELETE CASCADE;


--
-- Name: tracking_rules tracking_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.tracking_rules
    ADD CONSTRAINT tracking_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: usage_snapshots usage_snapshots_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.usage_snapshots
    ADD CONSTRAINT usage_snapshots_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: volume_sizes volume_sizes_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volume_sizes
    ADD CONSTRAINT volume_sizes_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(volume_id) ON DELETE CASCADE;


--
-- Name: volumes volumes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volumeviz
--

ALTER TABLE ONLY public.volumes
    ADD CONSTRAINT volumes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

