from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class CreateSessionRequest(BaseModel):
    title: Optional[str] = "Roundtable Discussion"
    host_name: str = "Host"
    device_id: Optional[str] = None

class CreateRoomRequest(BaseModel):
    title: Optional[str] = "Roundtable Meeting"
    host_name: str = "Host"
    device_id: Optional[str] = None

class JoinSessionRequest(BaseModel):
    session_code: str
    display_name: str
    device_id: str
    avatar_color: Optional[str] = None
    participant_id: Optional[str] = None

class JoinRoomRequest(BaseModel):
    room_id: Optional[str] = None
    display_name: str
    device_id: str
    avatar_color: Optional[str] = None
    participant_id: Optional[str] = None

class LeaveRoomRequest(BaseModel):
    room_id: Optional[str] = None
    participant_id: str

class EndRoomRequest(BaseModel):
    room_id: Optional[str] = None
    host_id: Optional[str] = None

class RemoveParticipantRequest(BaseModel):
    room_id: Optional[str] = None
    host_id: Optional[str] = None
    participant_id: str

class ParticipantInfo(BaseModel):
    id: str
    participant_id: Optional[str] = None
    device_id: str
    display_name: str
    avatar_color: str
    role: str
    connection_status: Optional[str] = "connected"
    is_connected: bool
    mic_muted: bool
    joined_at: datetime
    last_seen_at: datetime

    class Config:
        from_attributes = True

class RoomResponse(BaseModel):
    id: str
    room_id: str
    code: str
    title: str
    host_id: Optional[str] = None
    host_device_id: Optional[str] = None
    status: str = "active"
    is_active: bool = True
    created_at: datetime
    join_url: Optional[str] = None
    host_participant: Optional[ParticipantInfo] = None
    participant_count: int = 0
    participants: List[ParticipantInfo] = []

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: str
    code: str
    room_id: Optional[str] = None
    title: str
    host_device_id: Optional[str]
    host_id: Optional[str] = None
    status: Optional[str] = "active"
    is_active: bool
    created_at: datetime
    join_url: Optional[str] = None
    participant_count: int = 0
    participants: List[ParticipantInfo] = []

    class Config:
        from_attributes = True


class TranscriptSegmentResponse(BaseModel):
    id: str
    session_id: str
    participant_id: Optional[str]
    speaker_name: str
    text: str
    start_timestamp: float
    end_timestamp: float
    confidence: float
    is_overlap: bool
    overlap_with: Optional[str] = None
    device_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AudioChunkPayload(BaseModel):
    type: str = "audio_chunk"
    session_code: str
    participant_id: str
    device_id: str
    timestamp: float
    rms_energy: float
    audio_base64: Optional[str] = None

class LiveMetricPayload(BaseModel):
    type: str = "live_metrics"
    session_code: str
    active_participants: int
    connected_devices: int
    avg_latency_ms: float
    last_transcription_latency_ms: float
    overlap_detected: bool
    overlap_speakers: List[str] = []
    total_segments_count: int
    system_status: str

class WERBenchmarkRequest(BaseModel):
    reference_text: str
    hypothesis_text: str

class WERBenchmarkResponse(BaseModel):
    reference_text: str
    hypothesis_text: str
    substitutions: int
    deletions: int
    insertions: int
    hits: int
    reference_words_count: int
    wer: float  # Word Error Rate (0.0 to 1.0+)
    accuracy: float  # 1.0 - wer (clamped at 0)
    alignment_details: List[dict] = []
