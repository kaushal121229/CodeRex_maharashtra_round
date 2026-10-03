import time
import json
import base64
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
import numpy as np
from app.audio_coordinator import audio_registry
from app.database import AsyncSessionLocal
from app.models import SessionModel, ParticipantModel, TranscriptSegmentModel

logger = logging.getLogger("roundtable.session_manager")

class ConnectionManager:
    def __init__(self):
        # session_code -> dict of participant_id -> WebSocket
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # session_code -> dict of participant_id -> participant metadata
        self.participant_states: Dict[str, Dict[str, dict]] = {}

    async def connect(
        self,
        session_code: str,
        participant_id: str,
        device_id: str,
        display_name: str,
        avatar_color: str,
        websocket: WebSocket
    ):
        await websocket.accept()
        
        if session_code not in self.active_connections:
            self.active_connections[session_code] = {}
            self.participant_states[session_code] = {}

        self.active_connections[session_code][participant_id] = websocket
        
        # Save or update state
        self.participant_states[session_code][participant_id] = {
            "participant_id": participant_id,
            "device_id": device_id,
            "display_name": display_name,
            "avatar_color": avatar_color,
            "status": "connected",
            "last_seen": time.time(),
            "mic_active": True,
            "rms_level": 0.0
        }

        # Register with audio coordinator
        coordinator = audio_registry.get_or_create(session_code)
        coordinator.register_device(participant_id, device_id, display_name, avatar_color)

        # Notify all participants in this session
        await self.broadcast_participant_list(session_code)
        logger.info(f"Participant {display_name} connected to session {session_code}")

    async def disconnect(self, session_code: str, participant_id: str):
        """
        Marks participant as 'reconnecting' instead of destroying their session state!
        """
        if session_code in self.active_connections:
            if participant_id in self.active_connections[session_code]:
                del self.active_connections[session_code][participant_id]

        if session_code in self.participant_states:
            if participant_id in self.participant_states[session_code]:
                self.participant_states[session_code][participant_id]["status"] = "reconnecting"
                self.participant_states[session_code][participant_id]["last_seen"] = time.time()

        # Broadcast update so UI shows "Reconnecting..."
        await self.broadcast_participant_list(session_code)
        logger.info(f"Participant {participant_id} disconnected from {session_code} (status: reconnecting)")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, session_code: str, message: dict):
        if session_code not in self.active_connections:
            return
        
        dead_connections = []
        payload = json.dumps(message)

        for pid, ws in self.active_connections[session_code].items():
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to participant {pid}: {e}")
                dead_connections.append(pid)

        # Cleanup failed connections
        for pid in dead_connections:
            await self.disconnect(session_code, pid)

    async def broadcast_participant_list(self, session_code: str):
        if session_code not in self.participant_states:
            return
        
        participants_data = list(self.participant_states[session_code].values())
        connected_count = sum(1 for p in participants_data if p["status"] == "connected")

        msg = {
            "type": "participants_update",
            "session_code": session_code,
            "connected_count": connected_count,
            "total_count": len(participants_data),
            "participants": participants_data
        }
        await self.broadcast(session_code, msg)

    async def handle_audio_payload(
        self,
        session_code: str,
        participant_id: str,
        data: dict
    ):
        """
        Receives audio chunk from WebSocket client, decodes PCM samples,
        and feeds into multi-device coordinator.
        """
        device_id = data.get("device_id", "")
        client_timestamp = float(data.get("timestamp", time.time()))
        rms_energy = float(data.get("rms_energy", 0.0))
        audio_b64 = data.get("audio_base64", "")

        # Update live RMS meter for visualizer
        if session_code in self.participant_states and participant_id in self.participant_states[session_code]:
            self.participant_states[session_code][participant_id]["rms_level"] = rms_energy
            self.participant_states[session_code][participant_id]["last_seen"] = time.time()

        if not audio_b64:
            return

        try:
            raw_bytes = base64.b64decode(audio_b64)
            # 16-bit mono PCM 16kHz
            samples = np.frombuffer(raw_bytes, dtype=np.int16)
        except Exception as e:
            logger.error(f"Error decoding audio payload: {e}")
            return

        coordinator = audio_registry.get_or_create(session_code)
        new_segments = await coordinator.ingest_audio_chunk(
            participant_id=participant_id,
            audio_chunk=samples,
            client_timestamp=client_timestamp
        )

        for seg in new_segments:
            # Broadcast live caption to all participants
            caption_msg = {
                "type": "new_caption",
                "segment": seg
            }
            await self.broadcast(session_code, caption_msg)

            # If overlap detected, broadcast distinct overlap alert
            if seg.get("is_overlap"):
                overlap_msg = {
                    "type": "overlap_alert",
                    "speakers": seg.get("overlap_with", ""),
                    "timestamp": seg.get("start_timestamp")
                }
                await self.broadcast(session_code, overlap_msg)

            # Persist to database asynchronously
            asyncio.create_task(self._persist_segment(session_code, seg))

    async def _persist_segment(self, session_code: str, segment: dict):
        try:
            async with AsyncSessionLocal() as db:
                from sqlalchemy import select
                # Find session
                stmt = select(SessionModel).where(SessionModel.code == session_code)
                res = await db.execute(stmt)
                session_obj = res.scalar_one_or_none()
                if not session_obj:
                    return

                new_seg = TranscriptSegmentModel(
                    session_id=session_obj.id,
                    participant_id=segment.get("participant_id"),
                    speaker_name=segment.get("speaker_name", "Speaker"),
                    text=segment.get("text", ""),
                    start_timestamp=segment.get("start_timestamp", 0.0),
                    end_timestamp=segment.get("end_timestamp", 0.0),
                    confidence=segment.get("confidence", 1.0),
                    is_overlap=segment.get("is_overlap", False),
                    overlap_with=segment.get("overlap_with"),
                    device_id=segment.get("device_id")
                )
                db.add(new_seg)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to persist transcript segment: {e}")

manager = ConnectionManager()
