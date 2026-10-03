import time
import json
import base64
import logging
import asyncio
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket
import numpy as np
from app.audio_coordinator import audio_registry
from app.database import AsyncSessionLocal
from app.models import SessionModel, ParticipantModel, TranscriptSegmentModel
from sqlalchemy import select, update

logger = logging.getLogger("roundtable.session_manager")

class ConnectionManager:
    def __init__(self):
        # room_id -> dict of participant_id -> WebSocket
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # room_id -> dict of participant_id -> participant metadata
        self.participant_states: Dict[str, Dict[str, dict]] = {}
        # room_id -> room metadata (status, host_id, etc.)
        self.room_states: Dict[str, dict] = {}

    def get_room_participants(self, room_id: str) -> List[dict]:
        if room_id not in self.participant_states:
            return []
        return list(self.participant_states[room_id].values())

    async def connect(
        self,
        session_code: str,
        participant_id: str,
        device_id: str,
        display_name: str,
        avatar_color: str,
        websocket: WebSocket,
        role: str = "participant"
    ):
        await websocket.accept()
        room_id = session_code

        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.participant_states[room_id] = {}

        is_reconnect = False
        if participant_id in self.participant_states[room_id]:
            # Existing participant reconnecting!
            is_reconnect = True
            self.participant_states[room_id][participant_id]["status"] = "connected"
            self.participant_states[room_id][participant_id]["connection_status"] = "connected"
            self.participant_states[room_id][participant_id]["last_seen"] = time.time()
            self.participant_states[room_id][participant_id]["display_name"] = display_name
            if avatar_color:
                self.participant_states[room_id][participant_id]["avatar_color"] = avatar_color
        else:
            # Check by device_id to avoid duplicate participants for same device
            existing_by_dev = None
            for pid, pdata in self.participant_states[room_id].items():
                if pdata.get("device_id") == device_id:
                    existing_by_dev = pid
                    break

            if existing_by_dev:
                is_reconnect = True
                participant_id = existing_by_dev
                self.participant_states[room_id][participant_id]["status"] = "connected"
                self.participant_states[room_id][participant_id]["connection_status"] = "connected"
                self.participant_states[room_id][participant_id]["last_seen"] = time.time()
                self.participant_states[room_id][participant_id]["display_name"] = display_name
            else:
                # Brand new participant
                self.participant_states[room_id][participant_id] = {
                    "participant_id": participant_id,
                    "id": participant_id,
                    "device_id": device_id,
                    "display_name": display_name,
                    "avatar_color": avatar_color or "#6366F1",
                    "role": role,
                    "status": "connected",
                    "connection_status": "connected",
                    "joined_at": time.time(),
                    "last_seen": time.time(),
                    "mic_active": True,
                    "rms_level": 0.0
                }

        self.active_connections[room_id][participant_id] = websocket

        # Register device with audio coordinator
        coordinator = audio_registry.get_or_create(room_id)
        coordinator.register_device(participant_id, device_id, display_name, avatar_color)

        current_p = self.participant_states[room_id][participant_id]

        # 1. Send room_joined confirmation to the joining participant
        await self.send_personal_message({
            "type": "room_joined",
            "room_id": room_id,
            "session_code": room_id,
            "participant_id": participant_id,
            "participant": current_p,
            "participants": list(self.participant_states[room_id].values())
        }, websocket)

        # 2. Broadcast participant_joined / participant_reconnected event to room
        event_type = "participant_reconnected" if is_reconnect else "participant_joined"
        action_msg = f"{display_name} reconnected" if is_reconnect else f"{display_name} joined the meeting"

        await self.broadcast(room_id, {
            "type": event_type,
            "room_id": room_id,
            "participant_id": participant_id,
            "display_name": display_name,
            "participant": current_p,
            "message": action_msg
        }, exclude_participant_id=participant_id if not is_reconnect else None)

        # 3. Broadcast updated participant list and room state
        await self.broadcast_participant_list(room_id)
        logger.info(f"Participant {display_name} ({participant_id}) {action_msg} in room {room_id}")

        # Update DB in background
        asyncio.create_task(self._sync_db_participant_status(room_id, participant_id, "connected"))

    async def disconnect(self, session_code: str, participant_id: str):
        """
        Marks participant as 'reconnecting' instead of destroying their room state,
        allowing seamless resumption without duplicate participant entries.
        """
        room_id = session_code
        if room_id in self.active_connections:
            if participant_id in self.active_connections[room_id]:
                del self.active_connections[room_id][participant_id]

        display_name = "Participant"
        if room_id in self.participant_states and participant_id in self.participant_states[room_id]:
            p = self.participant_states[room_id][participant_id]
            p["status"] = "reconnecting"
            p["connection_status"] = "reconnecting"
            p["last_seen"] = time.time()
            display_name = p.get("display_name", "Participant")

        # Broadcast update so UI shows "Rahul — Reconnecting"
        await self.broadcast(room_id, {
            "type": "participant_left",
            "room_id": room_id,
            "participant_id": participant_id,
            "display_name": display_name,
            "connection_status": "reconnecting",
            "message": f"{display_name} connection lost (reconnecting...)"
        })

        await self.broadcast_participant_list(room_id)
        logger.info(f"Participant {participant_id} disconnected from room {room_id} (status: reconnecting)")
        asyncio.create_task(self._sync_db_participant_status(room_id, participant_id, "reconnecting"))

    async def end_meeting(self, room_id: str, host_id: Optional[str] = None):
        """
        Host ends the meeting for all participants.
        Notifies all connected clients with meeting_ended and cleanly closes connections.
        """
        msg = {
            "type": "meeting_ended",
            "room_id": room_id,
            "message": "Meeting ended by host."
        }
        await self.broadcast(room_id, msg)

        # Close all open sockets for this room
        if room_id in self.active_connections:
            for pid, ws in list(self.active_connections[room_id].items()):
                try:
                    await ws.close(code=1000, reason="Meeting ended by host.")
                except Exception:
                    pass
            self.active_connections[room_id].clear()

        if room_id in self.participant_states:
            for p in self.participant_states[room_id].values():
                p["status"] = "disconnected"
                p["connection_status"] = "disconnected"

        # Mark session ended in database
        asyncio.create_task(self._mark_room_ended_db(room_id))
        logger.info(f"Room {room_id} ended by host")

    async def remove_participant(self, room_id: str, participant_id: str):
        """
        Host removes/kicks a specific participant from the room.
        """
        ws = None
        if room_id in self.active_connections and participant_id in self.active_connections[room_id]:
            ws = self.active_connections[room_id][participant_id]

        if ws:
            try:
                await ws.send_text(json.dumps({
                    "type": "removed_by_host",
                    "room_id": room_id,
                    "message": "You have been removed from the meeting by the host."
                }))
                await ws.close(code=1000, reason="Removed by host")
            except Exception:
                pass
            del self.active_connections[room_id][participant_id]

        display_name = "Participant"
        if room_id in self.participant_states and participant_id in self.participant_states[room_id]:
            display_name = self.participant_states[room_id][participant_id].get("display_name", "Participant")
            del self.participant_states[room_id][participant_id]

        coordinator = audio_registry.get_or_create(room_id)
        coordinator.unregister_device(participant_id)

        await self.broadcast(room_id, {
            "type": "participant_left",
            "room_id": room_id,
            "participant_id": participant_id,
            "display_name": display_name,
            "message": f"{display_name} was removed from the meeting"
        })
        await self.broadcast_participant_list(room_id)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, session_code: str, message: dict, exclude_participant_id: Optional[str] = None):
        room_id = session_code
        if room_id not in self.active_connections:
            return
        
        dead_connections = []
        payload = json.dumps(message)

        for pid, ws in self.active_connections[room_id].items():
            if exclude_participant_id and pid == exclude_participant_id:
                continue
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to participant {pid}: {e}")
                dead_connections.append(pid)

        # Cleanup failed connections
        for pid in dead_connections:
            await self.disconnect(room_id, pid)

    async def broadcast_participant_list(self, session_code: str):
        room_id = session_code
        if room_id not in self.participant_states:
            return
        
        participants_data = list(self.participant_states[room_id].values())
        connected_count = sum(1 for p in participants_data if p.get("status") == "connected")

        msg = {
            "type": "participants_update",
            "room_id": room_id,
            "session_code": room_id,
            "connected_count": connected_count,
            "connected_devices": connected_count,
            "total_count": len(participants_data),
            "participants": participants_data
        }
        await self.broadcast(room_id, msg)

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
        room_id = session_code
        client_timestamp = float(data.get("timestamp", time.time()))
        rms_energy = float(data.get("rms_energy", 0.0))
        audio_b64 = data.get("audio_base64", "")

        # Update live RMS meter for visualizer
        if room_id in self.participant_states and participant_id in self.participant_states[room_id]:
            self.participant_states[room_id][participant_id]["rms_level"] = rms_energy
            self.participant_states[room_id][participant_id]["last_seen"] = time.time()

        if not audio_b64:
            return

        try:
            raw_bytes = base64.b64decode(audio_b64)
            samples = np.frombuffer(raw_bytes, dtype=np.int16)
        except Exception as e:
            logger.error(f"Error decoding audio payload: {e}")
            return

        coordinator = audio_registry.get_or_create(room_id)
        new_segments = await coordinator.ingest_audio_chunk(
            participant_id=participant_id,
            audio_chunk=samples,
            client_timestamp=client_timestamp
        )

        for seg in new_segments:
            caption_msg = {
                "type": "new_caption",
                "segment": seg
            }
            await self.broadcast(room_id, caption_msg)

            if seg.get("is_overlap"):
                overlap_msg = {
                    "type": "overlap_alert",
                    "speakers": seg.get("overlap_with", ""),
                    "timestamp": seg.get("start_timestamp")
                }
                await self.broadcast(room_id, overlap_msg)

            asyncio.create_task(self._persist_segment(room_id, seg))

    async def _persist_segment(self, session_code: str, segment: dict):
        try:
            async with AsyncSessionLocal() as db:
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

    async def _sync_db_participant_status(self, room_id: str, participant_id: str, status: str):
        try:
            async with AsyncSessionLocal() as db:
                stmt = select(SessionModel).where(SessionModel.code == room_id)
                res = await db.execute(stmt)
                session_obj = res.scalar_one_or_none()
                if not session_obj:
                    return

                p_stmt = select(ParticipantModel).where(
                    ParticipantModel.session_id == session_obj.id,
                    (ParticipantModel.id == participant_id) | (ParticipantModel.participant_id == participant_id)
                )
                p_res = await db.execute(p_stmt)
                p_obj = p_res.scalar_one_or_none()
                if p_obj:
                    p_obj.connection_status = status
                    p_obj.is_connected = (status == "connected")
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to sync participant status in DB: {e}")

    async def _mark_room_ended_db(self, room_id: str):
        try:
            async with AsyncSessionLocal() as db:
                stmt = select(SessionModel).where(SessionModel.code == room_id)
                res = await db.execute(stmt)
                session_obj = res.scalar_one_or_none()
                if session_obj:
                    session_obj.is_active = False
                    session_obj.status = "ended"
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to mark room ended in DB: {e}")

manager = ConnectionManager()
