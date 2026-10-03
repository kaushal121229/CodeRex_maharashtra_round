-- ==========================================================
-- ROUNDTABLE CLOUD MEETING: SUPABASE POSTGRESQL SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==========================================================

-- 1. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(32) UNIQUE NOT NULL,
    host_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) DEFAULT 'Roundtable Meeting',
    status VARCHAR(32) DEFAULT 'active', -- 'active' or 'ended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON rooms(room_id);

-- 2. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(32) NOT NULL,
    participant_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    avatar_color VARCHAR(32) DEFAULT '#14B8A6',
    role VARCHAR(32) DEFAULT 'participant', -- 'host' or 'participant'
    connection_status VARCHAR(32) DEFAULT 'connected', -- 'connected', 'reconnecting', 'disconnected'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_device_id ON participants(device_id);

-- 3. TRANSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(32) NOT NULL,
    participant_id VARCHAR(64),
    speaker VARCHAR(128) NOT NULL,
    text TEXT NOT NULL,
    timestamp NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_room_id ON transcripts(room_id);
