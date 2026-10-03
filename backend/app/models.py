import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(16), unique=True, index=True, nullable=False)  # room_id (e.g. RT-48291)
    title = Column(String(128), default="Roundtable Discussion")
    host_device_id = Column(String(64), nullable=True)
    host_id = Column(String(64), nullable=True)  # Host participant ID
    status = Column(String(16), default="active")  # 'active' | 'ended'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    participants = relationship("ParticipantModel", back_populates="session", cascade="all, delete-orphan")
    transcript_segments = relationship("TranscriptSegmentModel", back_populates="session", cascade="all, delete-orphan")
    metrics = relationship("EvaluationMetricModel", back_populates="session", cascade="all, delete-orphan")

    @property
    def room_id(self) -> str:
        return self.code

class ParticipantModel(Base):
    __tablename__ = "participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String(16), index=True, nullable=True)
    participant_id = Column(String(64), index=True, nullable=True)  # Public unique ID (e.g. P123 or stable UUID)
    device_id = Column(String(64), nullable=False, index=True)
    display_name = Column(String(64), nullable=False)
    avatar_color = Column(String(32), default="#6366F1")
    role = Column(String(16), default="participant")  # 'host' or 'participant'
    connection_status = Column(String(16), default="connected")  # 'connected' | 'reconnecting' | 'disconnected'
    is_connected = Column(Boolean, default=True)
    mic_muted = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True), default=utc_now)
    last_seen_at = Column(DateTime(timezone=True), default=utc_now)

    session = relationship("SessionModel", back_populates="participants")


class TranscriptSegmentModel(Base):
    __tablename__ = "transcript_segments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(String(64), nullable=True, index=True)
    speaker_name = Column(String(64), nullable=False)
    text = Column(Text, nullable=False)
    start_timestamp = Column(Float, nullable=False)  # Session relative or epoch seconds
    end_timestamp = Column(Float, nullable=False)
    confidence = Column(Float, default=1.0)
    is_overlap = Column(Boolean, default=False)
    overlap_with = Column(String(128), nullable=True)  # Comma-separated names of overlapping speakers
    device_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    session = relationship("SessionModel", back_populates="transcript_segments")


class EvaluationMetricModel(Base):
    __tablename__ = "evaluation_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    wer = Column(Float, nullable=True)
    speaker_accuracy = Column(Float, nullable=True)
    avg_latency_ms = Column(Float, default=0.0)
    active_speakers = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    overlap_count = Column(Integer, default=0)

    session = relationship("SessionModel", back_populates="metrics")
