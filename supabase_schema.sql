-- ==========================================================
-- ROUNDTABLE CLOUD MEETING: SUPABASE POSTGRESQL SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==========================================================

-- 1. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(16) UNIQUE NOT NULL,
    title VARCHAR(128) DEFAULT 'Roundtable Discussion',
    host_device_id VARCHAR(64),
    host_id VARCHAR(64),
    status VARCHAR(16) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);

-- 2. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES sessions(id) ON DELETE CASCADE,
    room_id VARCHAR(16),
    participant_id VARCHAR(64),
    device_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    avatar_color VARCHAR(32) DEFAULT '#6366F1',
    role VARCHAR(16) DEFAULT 'participant',
    connection_status VARCHAR(16) DEFAULT 'connected',
    is_connected BOOLEAN DEFAULT TRUE,
    mic_muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_participant_id ON participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_participants_device_id ON participants(device_id);

-- 3. TRANSCRIPT SEGMENTS TABLE
CREATE TABLE IF NOT EXISTS transcript_segments (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id VARCHAR(64),
    speaker_name VARCHAR(64) NOT NULL,
    text TEXT NOT NULL,
    start_timestamp DOUBLE PRECISION NOT NULL,
    end_timestamp DOUBLE PRECISION NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    is_overlap BOOLEAN DEFAULT FALSE,
    overlap_with VARCHAR(128),
    device_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_session_id ON transcript_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_start_timestamp ON transcript_segments(start_timestamp);

-- 4. EVALUATION METRICS TABLE
CREATE TABLE IF NOT EXISTS evaluation_metrics (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    wer DOUBLE PRECISION,
    speaker_accuracy DOUBLE PRECISION,
    avg_latency_ms DOUBLE PRECISION DEFAULT 0.0,
    active_speakers INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    overlap_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_metrics_session_id ON evaluation_metrics(session_id);
