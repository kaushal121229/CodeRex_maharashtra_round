import random
import string
import asyncio
import time

import json
import logging
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import settings
from app.database import init_db, get_db
from app.models import SessionModel, ParticipantModel, TranscriptSegmentModel, EvaluationMetricModel
from app.schemas import (
    CreateSessionRequest,
    JoinSessionRequest,
    SessionResponse,
    ParticipantInfo,
    TranscriptSegmentResponse,
    LiveMetricPayload,
    WERBenchmarkRequest,
    WERBenchmarkResponse
)
from app.session_manager import manager
from app.audio_coordinator import audio_registry
from app.stt_engine import stt_engine
from app.evaluation import compute_wer_detailed, compute_attribution_accuracy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roundtable.main")

def generate_session_code() -> str:
    """Generates an aesthetic 6-digit session code like RT-48291."""
    digits = "".join(random.choices(string.digits, k=5))
    return f"RT-{digits}"

def random_avatar_color() -> str:
    colors = [
        "#10B981",  # Emerald
        "#3B82F6",  # Blue
        "#8B5CF6",  # Purple
        "#EC4899",  # Pink
        "#F59E0B",  # Amber
        "#06B6D4",  # Cyan
        "#EF4444",  # Rose
        "#14B8A6"   # Teal
    ]
    return random.choice(colors)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    logger.info("Initializing database...")
    await init_db()
    
    # Warm up STT engine in background
    logger.info("Starting STT engine initialization...")
    import asyncio
    asyncio.create_task(asyncio.to_thread(stt_engine.initialize))
    yield
    logger.info("Shutting down Roundtable...")

app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-Device Collaborative Live Captions Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= REST API ROUTES =================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "stt_engine_ready": stt_engine.is_ready,
        "whisper_model": settings.WHISPER_MODEL_SIZE,
        "server_time": time.time()
    }

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(payload: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    # Generate unique code
    code = generate_session_code()
    for _ in range(10):
        stmt = select(SessionModel).where(SessionModel.code == code)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            break
        code = generate_session_code()

    session_obj = SessionModel(
        code=code,
        title=payload.title or "Roundtable Discussion",
        host_device_id=payload.device_id,
        is_active=True
    )
    db.add(session_obj)
    await db.flush()

    # Create host participant
    host_participant = ParticipantModel(
        session_id=session_obj.id,
        device_id=payload.device_id,
        display_name=payload.host_name or "Host",
        avatar_color=random_avatar_color(),
        role="host",
        is_connected=False
    )
    db.add(host_participant)
    await db.commit()
    await db.refresh(session_obj)

    return SessionResponse(
        id=session_obj.id,
        code=session_obj.code,
        title=session_obj.title,
        host_device_id=session_obj.host_device_id,
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        participant_count=1,
        participants=[ParticipantInfo.model_validate(host_participant)]
    )

@app.get("/api/sessions/{code}", response_model=SessionResponse)
async def get_session(code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionModel).where(SessionModel.code == code)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    p_stmt = select(ParticipantModel).where(ParticipantModel.session_id == session_obj.id)
    p_res = await db.execute(p_stmt)
    participants = p_res.scalars().all()

    return SessionResponse(
        id=session_obj.id,
        code=session_obj.code,
        title=session_obj.title,
        host_device_id=session_obj.host_device_id,
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        participant_count=len(participants),
        participants=[ParticipantInfo.model_validate(p) for p in participants]
    )

@app.post("/api/sessions/{code}/join")
async def join_session(code: str, payload: JoinSessionRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionModel).where(SessionModel.code == code)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj or not session_obj.is_active:
        raise HTTPException(status_code=404, detail="Active session not found")

    # Check if participant with same device_id already exists in this session (Reconnection support)
    p_stmt = select(ParticipantModel).where(
        ParticipantModel.session_id == session_obj.id,
        ParticipantModel.device_id == payload.device_id
    )
    p_res = await db.execute(p_stmt)
    existing_p = p_res.scalar_one_or_none()

    if existing_p:
        # Reconnecting existing participant
        existing_p.display_name = payload.display_name
        if payload.avatar_color:
            existing_p.avatar_color = payload.avatar_color
        existing_p.is_connected = True
        await db.commit()
        await db.refresh(existing_p)
        return {
            "session_id": session_obj.id,
            "session_code": session_obj.code,
            "title": session_obj.title,
            "participant": ParticipantInfo.model_validate(existing_p),
            "is_reconnect": True
        }

    # New participant
    new_p = ParticipantModel(
        session_id=session_obj.id,
        device_id=payload.device_id,
        display_name=payload.display_name,
        avatar_color=payload.avatar_color or random_avatar_color(),
        role="participant",
        is_connected=True
    )
    db.add(new_p)
    await db.commit()
    await db.refresh(new_p)

    return {
        "session_id": session_obj.id,
        "session_code": session_obj.code,
        "title": session_obj.title,
        "participant": ParticipantInfo.model_validate(new_p),
        "is_reconnect": False
    }

@app.get("/api/sessions/{code}/transcript", response_model=List[TranscriptSegmentResponse])
async def get_transcript(code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionModel).where(SessionModel.code == code)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    t_stmt = select(TranscriptSegmentModel).where(
        TranscriptSegmentModel.session_id == session_obj.id
    ).order_by(TranscriptSegmentModel.start_timestamp.asc())
    
    t_res = await db.execute(t_stmt)
    segments = t_res.scalars().all()
    return [TranscriptSegmentResponse.model_validate(s) for s in segments]

@app.get("/api/sessions/{code}/transcript/export")
async def export_transcript_txt(code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionModel).where(SessionModel.code == code)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    t_stmt = select(TranscriptSegmentModel).where(
        TranscriptSegmentModel.session_id == session_obj.id
    ).order_by(TranscriptSegmentModel.start_timestamp.asc())
    segments = (await db.execute(t_stmt)).scalars().all()

    lines = [
        f"===========================================================",
        f"ROUNDTABLE CONVERSATION TRANSCRIPT",
        f"Session: {session_obj.title} ({session_obj.code})",
        f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        f"Total Segments: {len(segments)}",
        f"===========================================================\n"
    ]

    for s in segments:
        overlap_tag = f" [OVERLAP with {s.overlap_with}]" if s.is_overlap else ""
        mins, secs = divmod(int(s.start_timestamp), 60)
        time_str = f"{mins:02d}:{secs:02d}"
        lines.append(f"[{time_str}] {s.speaker_name}{overlap_tag}:\n  \"{s.text}\"\n")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=roundtable_{code}_transcript.txt"}
    )

@app.get("/api/sessions/{code}/metrics")
async def get_session_metrics(code: str, db: AsyncSession = Depends(get_db)):
    coordinator = audio_registry.get_or_create(code)
    connected_participants = manager.participant_states.get(code, {})
    active_count = sum(1 for p in connected_participants.values() if p.get("status") == "connected")
    
    # Query segments count from DB
    stmt = select(SessionModel).where(SessionModel.code == code)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    total_segments = 0
    if session_obj:
        from sqlalchemy import func
        c_stmt = select(func.count(TranscriptSegmentModel.id)).where(TranscriptSegmentModel.session_id == session_obj.id)
        total_segments = (await db.execute(c_stmt)).scalar() or 0

    avg_lat = coordinator.get_avg_latency()
    last_lat = coordinator.latency_records[-1] if coordinator.latency_records else 0.0

    return {
        "session_code": code,
        "connected_devices": len(coordinator.devices),
        "active_participants": active_count,
        "avg_latency_ms": round(avg_lat, 1),
        "last_transcription_latency_ms": round(last_lat, 1),
        "total_processed_chunks": coordinator.total_processed_chunks,
        "total_segments_count": total_segments,
        "overlap_count": coordinator.overlap_count,
        "active_overlap_speakers": coordinator.active_overlap_speakers,
        "connection_status": "Healthy" if active_count > 0 else "Idle"
    }

# ================= EVALUATION BENCHMARKS =================

@app.post("/api/evaluation/wer", response_model=WERBenchmarkResponse)
async def benchmark_wer(payload: WERBenchmarkRequest):
    """
    Computes exact Word Error Rate (WER) using dynamic programming Levenshtein distance.
    Provides complete breakdown of Substitutions, Deletions, Insertions, Hits, and word alignment.
    """
    res = compute_wer_detailed(payload.reference_text, payload.hypothesis_text)
    return WERBenchmarkResponse(**res)

@app.post("/api/evaluation/attribution-test")
async def benchmark_speaker_attribution(trials: List[dict]):
    """
    Calculates measured speaker attribution accuracy from testing trials.
    """
    return compute_attribution_accuracy(trials)

@app.post("/api/evaluation/simulate-overlap/{code}")
async def simulate_overlap_demo(code: str):
    """
    Hackathon evaluation trigger: simulates simultaneous speech from two devices
    to demonstrate live overlap separation and alert broadcasting.
    """
    coordinator = audio_registry.get_or_create(code)
    devices = list(coordinator.devices.values())
    
    name1 = devices[0].display_name if len(devices) > 0 else "Saish"
    name2 = devices[1].display_name if len(devices) > 1 else "Rahul"
    
    t_now = time.time()
    
    # Broadcast alert
    await manager.broadcast(code, {
        "type": "overlap_alert",
        "speakers": f"{name1}, {name2}",
        "timestamp": t_now
    })

    # Broadcast two separated speaker captions
    seg1 = {
        "participant_id": "sim-1",
        "speaker_name": name1,
        "avatar_color": "#10B981",
        "device_id": "dev-sim-1",
        "text": "We should use Python for the backend architecture.",
        "start_timestamp": round(t_now, 2),
        "end_timestamp": round(t_now + 1.8, 2),
        "confidence": 0.98,
        "is_overlap": True,
        "overlap_with": name2,
        "latency_ms": 320.0
    }
    
    seg2 = {
        "participant_id": "sim-2",
        "speaker_name": name2,
        "avatar_color": "#3B82F6",
        "device_id": "dev-sim-2",
        "text": "I think FastAPI with WebSockets would be much faster.",
        "start_timestamp": round(t_now + 0.2, 2),
        "end_timestamp": round(t_now + 2.0, 2),
        "confidence": 0.96,
        "is_overlap": True,
        "overlap_with": name1,
        "latency_ms": 340.0
    }

    await manager.broadcast(code, {"type": "new_caption", "segment": seg1})
    await manager.broadcast(code, {"type": "new_caption", "segment": seg2})

    asyncio.create_task(manager._persist_segment(code, seg1))
    asyncio.create_task(manager._persist_segment(code, seg2))

    return {"status": "simulated", "speakers": [name1, name2]}

# ================= WEBSOCKET STREAMING =================

@app.websocket("/ws/{session_code}/{participant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_code: str,
    participant_id: str,
    device_id: str = Query(...),
    display_name: str = Query(...),
    avatar_color: str = Query("#6366F1")
):
    await manager.connect(
        session_code=session_code,
        participant_id=participant_id,
        device_id=device_id,
        display_name=display_name,
        avatar_color=avatar_color,
        websocket=websocket
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)
            msg_type = data.get("type")

            if msg_type == "ping":
                # Clock sync & heartbeat
                client_t = data.get("client_time", time.time())
                await manager.send_personal_message({
                    "type": "pong",
                    "client_time": client_t,
                    "server_time": time.time()
                }, websocket)

            elif msg_type == "audio_chunk":
                # Multi-device streaming audio payload
                await manager.handle_audio_payload(
                    session_code=session_code,
                    participant_id=participant_id,
                    data=data
                )

            elif msg_type == "sync_speech":
                # Direct speech transcription payload (e.g. from frontend Web Speech or hybrid stream)
                text = data.get("text", "").strip()
                if text:
                    t_start = float(data.get("start_timestamp", time.time() - 1.5))
                    t_end = float(data.get("end_timestamp", time.time()))
                    confidence = float(data.get("confidence", 0.95))
                    
                    coordinator = audio_registry.get_or_create(session_code)
                    # Check overlap with any other recent speech
                    active_speakers = [
                        d.display_name for pid, d in coordinator.devices.items()
                        if pid != participant_id and d.get_avg_recent_rms() > settings.VAD_RMS_THRESHOLD
                    ]
                    is_overlap = len(active_speakers) > 0

                    segment = {
                        "participant_id": participant_id,
                        "speaker_name": display_name,
                        "avatar_color": avatar_color,
                        "device_id": device_id,
                        "text": text,
                        "start_timestamp": round(t_start, 2),
                        "end_timestamp": round(t_end, 2),
                        "confidence": round(confidence, 2),
                        "is_overlap": is_overlap,
                        "overlap_with": ", ".join(active_speakers) if is_overlap else None,
                        "latency_ms": round((time.time() - t_start) * 1000.0, 1)
                    }

                    await manager.broadcast(session_code, {"type": "new_caption", "segment": segment})
                    if is_overlap:
                        await manager.broadcast(session_code, {
                            "type": "overlap_alert",
                            "speakers": f"{display_name}, {active_speakers[0]}",
                            "timestamp": t_start
                        })
                    asyncio.create_task(manager._persist_segment(session_code, segment))

            elif msg_type == "toggle_mic":
                is_muted = data.get("is_muted", False)
                if session_code in manager.participant_states and participant_id in manager.participant_states[session_code]:
                    manager.participant_states[session_code][participant_id]["mic_active"] = not is_muted
                    await manager.broadcast_participant_list(session_code)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {display_name} in session {session_code}")
        await manager.disconnect(session_code, participant_id)
    except Exception as e:
        logger.error(f"WebSocket error for {display_name}: {e}")
        await manager.disconnect(session_code, participant_id)
