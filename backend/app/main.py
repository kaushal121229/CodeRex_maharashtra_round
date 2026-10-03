import random
import string
import asyncio
import time
import uuid
import os
import httpx
from datetime import datetime, timezone

import json
import logging
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.config import settings
from app.database import init_db, get_db
from app.models import SessionModel, ParticipantModel, TranscriptSegmentModel, EvaluationMetricModel
from app.schemas import (
    CreateSessionRequest,
    CreateRoomRequest,
    JoinSessionRequest,
    JoinRoomRequest,
    LeaveRoomRequest,
    EndRoomRequest,
    RemoveParticipantRequest,
    SessionResponse,
    RoomResponse,
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
cors_origins = [o for o in settings.CORS_ORIGINS if o != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*",
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

# ================= CLOUD MEETING ROOM ROUTES =================

@app.post("/rooms", response_model=RoomResponse)
@app.post("/api/rooms", response_model=RoomResponse)
@app.post("/api/sessions", response_model=SessionResponse)
async def create_room(payload: CreateRoomRequest, db: AsyncSession = Depends(get_db)):
    code = generate_session_code()
    for _ in range(10):
        stmt = select(SessionModel).where(SessionModel.code == code)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            break
        code = generate_session_code()

    host_pid = "P001"
    effective_dev_id = payload.device_id or f"dev-{uuid.uuid4().hex[:8]}"

    session_obj = SessionModel(
        code=code,
        title=payload.title or "Roundtable Meeting",
        host_device_id=effective_dev_id,
        host_id=host_pid,
        status="active",
        is_active=True
    )
    db.add(session_obj)
    await db.flush()

    host_participant = ParticipantModel(
        session_id=session_obj.id,
        room_id=code,
        participant_id=host_pid,
        device_id=effective_dev_id,
        display_name=payload.host_name or "Host",
        avatar_color=random_avatar_color(),
        role="host",
        connection_status="connected",
        is_connected=True
    )
    db.add(host_participant)
    await db.commit()
    await db.refresh(session_obj)

    join_url = f"/join/{code}"

    host_info = ParticipantInfo(
        id=host_participant.id,
        participant_id=host_pid,
        device_id=host_participant.device_id,
        display_name=host_participant.display_name,
        avatar_color=host_participant.avatar_color,
        role="host",
        connection_status="connected",
        is_connected=True,
        mic_muted=False,
        joined_at=host_participant.joined_at,
        last_seen_at=host_participant.last_seen_at
    )

    return RoomResponse(
        id=session_obj.id,
        room_id=session_obj.code,
        code=session_obj.code,
        title=session_obj.title,
        host_id=host_pid,
        host_device_id=session_obj.host_device_id,
        status="active",
        is_active=True,
        created_at=session_obj.created_at,
        join_url=join_url,
        host_participant=host_info,
        participant_count=1,
        participants=[host_info]
    )

@app.get("/rooms/{room_id}", response_model=RoomResponse)
@app.get("/api/rooms/{room_id}", response_model=RoomResponse)
@app.get("/api/sessions/{room_id}", response_model=SessionResponse)
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    clean_id = room_id.strip().upper()
    stmt = select(SessionModel).where(SessionModel.code == clean_id)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Meeting room not found")

    p_stmt = select(ParticipantModel).where(ParticipantModel.session_id == session_obj.id)
    p_res = await db.execute(p_stmt)
    participants = p_res.scalars().all()

    p_list = []
    for p in participants:
        p_list.append(ParticipantInfo(
            id=p.id,
            participant_id=p.participant_id or p.id,
            device_id=p.device_id,
            display_name=p.display_name,
            avatar_color=p.avatar_color,
            role=p.role,
            connection_status=p.connection_status or ("connected" if p.is_connected else "disconnected"),
            is_connected=p.is_connected,
            mic_muted=p.mic_muted,
            joined_at=p.joined_at,
            last_seen_at=p.last_seen_at
        ))

    return RoomResponse(
        id=session_obj.id,
        room_id=session_obj.code,
        code=session_obj.code,
        title=session_obj.title,
        host_id=session_obj.host_id,
        host_device_id=session_obj.host_device_id,
        status=session_obj.status or ("active" if session_obj.is_active else "ended"),
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        join_url=f"/join/{session_obj.code}",
        participant_count=len(participants),
        participants=p_list
    )

@app.post("/rooms/{room_id}/join")
@app.post("/api/rooms/{room_id}/join")
@app.post("/api/sessions/{room_id}/join")
async def join_room(room_id: str, payload: JoinRoomRequest, db: AsyncSession = Depends(get_db)):
    clean_id = (payload.room_id or room_id).strip().upper()
    stmt = select(SessionModel).where(SessionModel.code == clean_id)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj or not session_obj.is_active or session_obj.status == "ended":
        raise HTTPException(status_code=404, detail="Active meeting room not found or meeting has ended")

    # Check for existing participant to prevent duplicates on reconnection
    conditions = [ParticipantModel.device_id == payload.device_id]
    if payload.participant_id:
        conditions.append(ParticipantModel.participant_id == payload.participant_id)

    p_stmt = select(ParticipantModel).where(
        ParticipantModel.session_id == session_obj.id,
        or_(*conditions)
    )
    p_res = await db.execute(p_stmt)
    existing_p = p_res.scalar_one_or_none()

    if existing_p:
        # Reconnect existing participant with identical participant_id!
        existing_p.display_name = payload.display_name
        if payload.avatar_color:
            existing_p.avatar_color = payload.avatar_color
        existing_p.is_connected = True
        existing_p.connection_status = "connected"
        existing_p.last_seen_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing_p)

        part_info = ParticipantInfo(
            id=existing_p.id,
            participant_id=existing_p.participant_id or existing_p.id,
            device_id=existing_p.device_id,
            display_name=existing_p.display_name,
            avatar_color=existing_p.avatar_color,
            role=existing_p.role,
            connection_status="connected",
            is_connected=True,
            mic_muted=existing_p.mic_muted,
            joined_at=existing_p.joined_at,
            last_seen_at=existing_p.last_seen_at
        )

        return {
            "room_id": session_obj.code,
            "session_id": session_obj.id,
            "session_code": session_obj.code,
            "title": session_obj.title,
            "participant_id": existing_p.participant_id or existing_p.id,
            "device_id": existing_p.device_id,
            "display_name": existing_p.display_name,
            "participant": part_info,
            "is_reconnect": True
        }

    # Brand new participant in room
    # Compute next sequential participant ID (P002, P003, ...)
    count_stmt = select(ParticipantModel).where(ParticipantModel.session_id == session_obj.id)
    all_p = (await db.execute(count_stmt)).scalars().all()
    next_pid = f"P{len(all_p) + 1:03d}"

    new_p = ParticipantModel(
        session_id=session_obj.id,
        room_id=session_obj.code,
        participant_id=next_pid,
        device_id=payload.device_id,
        display_name=payload.display_name,
        avatar_color=payload.avatar_color or random_avatar_color(),
        role="participant",
        connection_status="connected",
        is_connected=True
    )
    db.add(new_p)
    await db.commit()
    await db.refresh(new_p)

    part_info = ParticipantInfo(
        id=new_p.id,
        participant_id=new_p.participant_id,
        device_id=new_p.device_id,
        display_name=new_p.display_name,
        avatar_color=new_p.avatar_color,
        role=new_p.role,
        connection_status="connected",
        is_connected=True,
        mic_muted=False,
        joined_at=new_p.joined_at,
        last_seen_at=new_p.last_seen_at
    )

    return {
        "room_id": session_obj.code,
        "session_id": session_obj.id,
        "session_code": session_obj.code,
        "title": session_obj.title,
        "participant_id": next_pid,
        "device_id": new_p.device_id,
        "display_name": new_p.display_name,
        "participant": part_info,
        "is_reconnect": False
    }

@app.post("/rooms/{room_id}/leave")
@app.post("/api/rooms/{room_id}/leave")
async def leave_room_endpoint(room_id: str, payload: LeaveRoomRequest):
    clean_id = room_id.strip().upper()
    await manager.disconnect(clean_id, payload.participant_id)
    return {"status": "left", "room_id": clean_id, "participant_id": payload.participant_id}

@app.post("/rooms/{room_id}/end")
@app.post("/api/rooms/{room_id}/end")
async def end_room_endpoint(room_id: str, payload: Optional[EndRoomRequest] = None, db: AsyncSession = Depends(get_db)):
    clean_id = room_id.strip().upper()
    stmt = select(SessionModel).where(SessionModel.code == clean_id)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if session_obj:
        session_obj.is_active = False
        session_obj.status = "ended"
        session_obj.ended_at = datetime.now(timezone.utc)
        await db.commit()

    host_id = payload.host_id if payload else None
    await manager.end_meeting(clean_id, host_id)
    return {"status": "ended", "room_id": clean_id, "message": "Meeting ended by host."}

@app.post("/rooms/{room_id}/participants/{participant_id}/remove")
@app.post("/api/rooms/{room_id}/participants/{participant_id}/remove")
async def remove_participant_endpoint(room_id: str, participant_id: str):
    clean_id = room_id.strip().upper()
    await manager.remove_participant(clean_id, participant_id)
@app.get("/api/sessions/{code}/transcript", response_model=List[TranscriptSegmentResponse])
@app.get("/rooms/{code}/transcript", response_model=List[TranscriptSegmentResponse])
@app.get("/api/rooms/{code}/transcript", response_model=List[TranscriptSegmentResponse])

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

@app.post("/api/sessions/{code}/ai-summary")
@app.post("/rooms/{code}/ai-summary")
async def generate_ai_meeting_summary(code: str, db: AsyncSession = Depends(get_db)):
    """
    Leverages OpenRouter AI intelligence to generate executive summary, key decisions,
    and speaker-attributed action items from live conversation transcripts.
    """
    clean_code = code.strip().upper()
    stmt = select(SessionModel).where(SessionModel.code == clean_code)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Meeting room not found")

    t_stmt = select(TranscriptSegmentModel).where(
        TranscriptSegmentModel.session_id == session_obj.id
    ).order_by(TranscriptSegmentModel.start_timestamp.asc())
    segments = (await db.execute(t_stmt)).scalars().all()

    if not segments:
        return {
            "room_id": clean_code,
            "title": session_obj.title,
            "summary": "No spoken dialogue recorded yet in this meeting to summarize.",
            "action_items": [],
            "key_decisions": []
        }

    dialogue = "\n".join([f"[{s.speaker_name}]: {s.text}" for s in segments])
    api_key = settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "")

    if not api_key:
        return {
            "room_id": clean_code,
            "title": session_obj.title,
            "summary": f"Meeting '{session_obj.title}' concluded with {len(segments)} spoken turns.",
            "action_items": ["Configure OPENROUTER_API_KEY for deep LLM summarization"],
            "key_decisions": []
        }

    prompt = (
        f"You are the Roundtable AI executive assistant. Given this speaker-attributed conversation transcript:\n\n"
        f"{dialogue}\n\n"
        f"Provide a clear, high-impact summary with:\n"
        f"1. Executive Summary (2-3 sentences)\n"
        f"2. Key Decisions Made\n"
        f"3. Action Items (assignee + task)\n"
    )

    models_to_try = [
        os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-2.6b:free"),
        "qwen/qwen3.8-27b:free",
        "apodex/apodex-1.1-mini:free"
    ]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            last_err = None
            for model_name in models_to_try:
                try:
                    resp = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "HTTP-Referer": "https://roundtable.live",
                            "X-Title": "Roundtable Live Captions",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model_name,
                            "messages": [
                                {"role": "system", "content": "You are Roundtable AI. Generate crisp, professional meeting summaries with markdown formatting."},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.3
                        }
                    )
                    if resp.status_code == 200:
                        result = resp.json()
                        content = result["choices"][0]["message"]["content"]
                        return {
                            "room_id": clean_code,
                            "title": session_obj.title,
                            "summary": content,
                            "model_used": result.get("model", model_name)
                        }
                    else:
                        last_err = f"Model {model_name} returned {resp.status_code}: {resp.text[:150]}"
                except Exception as inner_e:
                    last_err = str(inner_e)
                    continue

            return {
                "room_id": clean_code,
                "title": session_obj.title,
                "summary": f"Could not generate AI summary: {last_err}",
                "error": last_err
            }
    except Exception as e:
        logger.error(f"OpenRouter call failed: {e}")
        return {
            "room_id": clean_code,
            "title": session_obj.title,
            "summary": "AI summary generation encountered a network error.",
            "error": str(e)
        }

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

# ================= WEBSOCKET STREAMING =================

@app.websocket("/ws/{room_id}")
@app.websocket("/ws/{room_id}/{participant_id}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    room_id: str,
    participant_id: Optional[str] = None,
    device_id: Optional[str] = Query(None),
    display_name: Optional[str] = Query(None),
    avatar_color: Optional[str] = Query(None)
):
    clean_room_id = room_id.strip().upper()
    current_pid = participant_id
    current_device_id = device_id
    current_display_name = display_name
    current_avatar_color = avatar_color or "#6366F1"
    is_joined = False

    # If query parameters were provided in URL, we can join immediately
    if current_pid and current_device_id and current_display_name:
        await manager.connect(
            session_code=clean_room_id,
            participant_id=current_pid,
            device_id=current_device_id,
            display_name=current_display_name,
            avatar_color=current_avatar_color,
            websocket=websocket
        )
        is_joined = True
    else:
        from starlette.websockets import WebSocketState
        if websocket.client_state == WebSocketState.CONNECTING:
            await websocket.accept()

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)
            msg_type = data.get("type")

            # 1. Join Room Event
            if msg_type in ("join_room", "reconnect"):
                target_room = (data.get("room_id") or clean_room_id).strip().upper()
                current_pid = data.get("participant_id") or current_pid or f"P{int(time.time()*1000)%10000}"
                current_device_id = data.get("device_id") or current_device_id or f"dev-{current_pid}"
                current_display_name = data.get("display_name") or current_display_name or "Participant"
                current_avatar_color = data.get("avatar_color") or current_avatar_color

                await manager.connect(
                    session_code=target_room,
                    participant_id=current_pid,
                    device_id=current_device_id,
                    display_name=current_display_name,
                    avatar_color=current_avatar_color,
                    websocket=websocket
                )
                is_joined = True

            # 2. Heartbeat / Ping Event
            elif msg_type in ("heartbeat", "ping"):
                client_t = data.get("client_time", time.time())
                server_t = time.time()
                await manager.send_personal_message({
                    "type": "heartbeat_ack" if msg_type == "heartbeat" else "pong",
                    "client_time": client_t,
                    "server_time": server_t,
                    "connection_status": "connected"
                }, websocket)

                # Update participant's last_seen
                if is_joined and current_pid and clean_room_id in manager.participant_states:
                    if current_pid in manager.participant_states[clean_room_id]:
                        manager.participant_states[clean_room_id][current_pid]["last_seen"] = server_t

            # 3. Leave Room Event
            elif msg_type == "leave_room":
                target_pid = data.get("participant_id") or current_pid
                if target_pid:
                    await manager.disconnect(clean_room_id, target_pid)
                break

            # 4. Host End Meeting Event
            elif msg_type == "end_meeting":
                host_id = data.get("host_id") or current_pid
                await manager.end_meeting(clean_room_id, host_id)
                break

            # 5. Host Remove Participant Event
            elif msg_type == "remove_participant":
                target_pid = data.get("participant_id")
                if target_pid:
                    await manager.remove_participant(clean_room_id, target_pid)

            # 6. Audio Chunk Streaming Event
            elif msg_type == "audio_chunk":
                if is_joined and current_pid:
                    await manager.handle_audio_payload(
                        session_code=clean_room_id,
                        participant_id=current_pid,
                        data=data
                    )

            # 7. Sync Speech (Assistive dual speech-to-text)
            elif msg_type == "sync_speech":
                if is_joined and current_pid:
                    text = data.get("text", "").strip()
                    if text:
                        t_start = float(data.get("start_timestamp", time.time() - 1.5))
                        t_end = float(data.get("end_timestamp", time.time()))
                        confidence = float(data.get("confidence", 0.95))

                        coordinator = audio_registry.get_or_create(clean_room_id)
                        active_speakers = [
                            d.display_name for pid, d in coordinator.devices.items()
                            if pid != current_pid and d.get_avg_recent_rms() > settings.VAD_RMS_THRESHOLD
                        ]
                        is_overlap = len(active_speakers) > 0

                        segment = {
                            "participant_id": current_pid,
                            "speaker_name": current_display_name or "Speaker",
                            "avatar_color": current_avatar_color,
                            "device_id": current_device_id,
                            "text": text,
                            "start_timestamp": round(t_start, 2),
                            "end_timestamp": round(t_end, 2),
                            "confidence": round(confidence, 2),
                            "is_overlap": is_overlap,
                            "overlap_with": ", ".join(active_speakers) if is_overlap else None,
                            "latency_ms": round((time.time() - t_start) * 1000.0, 1)
                        }

                        await manager.broadcast(clean_room_id, {"type": "new_caption", "segment": segment})
                        if is_overlap:
                            await manager.broadcast(clean_room_id, {
                                "type": "overlap_alert",
                                "speakers": f"{current_display_name}, {active_speakers[0]}",
                                "timestamp": t_start
                            })
                        asyncio.create_task(manager._persist_segment(clean_room_id, segment))

            # 8. Toggle Microphone Mute
            elif msg_type == "toggle_mic":
                is_muted = data.get("is_muted", False)
                if clean_room_id in manager.participant_states and current_pid in manager.participant_states[clean_room_id]:
                    manager.participant_states[clean_room_id][current_pid]["mic_active"] = not is_muted
                    await manager.broadcast_participant_list(clean_room_id)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {current_display_name} ({current_pid}) in room {clean_room_id}")
        if is_joined and current_pid:
            await manager.disconnect(clean_room_id, current_pid)
    except Exception as e:
        logger.error(f"WebSocket error for {current_display_name}: {e}")
        if is_joined and current_pid:
            await manager.disconnect(clean_room_id, current_pid)

