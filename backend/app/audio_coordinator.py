import time
import logging
import asyncio
from typing import Dict, List, Optional, Tuple
import numpy as np
from app.vad import AdaptiveVAD
from app.stt_engine import stt_engine
from app.config import settings

logger = logging.getLogger("roundtable.coordinator")

class DeviceAudioBuffer:
    def __init__(self, participant_id: str, device_id: str, display_name: str, avatar_color: str):
        self.participant_id = participant_id
        self.device_id = device_id
        self.display_name = display_name
        self.avatar_color = avatar_color
        self.vad = AdaptiveVAD(base_threshold=settings.VAD_RMS_THRESHOLD)
        
        # Audio accumulator
        self.audio_frames: List[np.ndarray] = []
        self.frame_timestamps: List[float] = []
        self.is_speaking = False
        self.speech_start_time = 0.0
        self.last_audio_time = time.time()
        self.recent_rms_values: List[float] = []
        self.accumulated_samples_count = 0

    def add_chunk(self, audio_chunk: np.ndarray, client_timestamp: float) -> Tuple[bool, float, float]:
        """
        Adds audio chunk (int16 or float32 16kHz mono), processes VAD.
        Returns: (is_speech, rms, snr)
        """
        is_speech, rms, snr = self.vad.process_frame(audio_chunk)
        
        self.audio_frames.append(audio_chunk)
        self.frame_timestamps.append(client_timestamp)
        self.accumulated_samples_count += len(audio_chunk)
        self.last_audio_time = time.time()
        
        # Keep sliding list of recent RMS values for cross-device comparison
        self.recent_rms_values.append(rms)
        if len(self.recent_rms_values) > 20:
            self.recent_rms_values.pop(0)

        if is_speech and not self.is_speaking:
            self.is_speaking = True
            self.speech_start_time = client_timestamp
        elif not is_speech and self.is_speaking:
            self.is_speaking = False

        return is_speech, rms, snr

    def get_avg_recent_rms(self) -> float:
        if not self.recent_rms_values:
            return 0.0
        return float(np.mean(self.recent_rms_values))

    def flush_audio(self) -> Tuple[np.ndarray, float, float]:
        """Flushes and returns accumulated audio array and timestamp range."""
        if not self.audio_frames:
            return np.array([], dtype=np.float32), 0.0, 0.0

        concatenated = np.concatenate(self.audio_frames)
        t_start = self.frame_timestamps[0] if self.frame_timestamps else time.time()
        t_end = self.frame_timestamps[-1] if self.frame_timestamps else time.time()

        self.audio_frames.clear()
        self.frame_timestamps.clear()
        self.accumulated_samples_count = 0
        return concatenated, t_start, t_end


class SessionAudioCoordinator:
    """
    Coordinates multi-device audio capture for a single roundtable session.
    Aligns timestamps, compares acoustic energy for speaker attribution,
    detects overlapping speech, and invokes STT.
    """
    def __init__(self, session_code: str):
        self.session_code = session_code
        self.devices: Dict[str, DeviceAudioBuffer] = {}  # participant_id -> DeviceAudioBuffer
        self.lock = asyncio.Lock()
        
        # Real-time metrics
        self.total_processed_chunks = 0
        self.latency_records: List[float] = []
        self.overlap_count = 0
        self.active_overlap_speakers: List[str] = []

    def register_device(self, participant_id: str, device_id: str, display_name: str, avatar_color: str):
        if participant_id not in self.devices:
            self.devices[participant_id] = DeviceAudioBuffer(
                participant_id=participant_id,
                device_id=device_id,
                display_name=display_name,
                avatar_color=avatar_color
            )
            logger.info(f"Registered audio device for {display_name} ({device_id}) in session {self.session_code}")

    def update_participant_meta(self, participant_id: str, display_name: str, avatar_color: str):
        if participant_id in self.devices:
            self.devices[participant_id].display_name = display_name
            self.devices[participant_id].avatar_color = avatar_color

    def unregister_device(self, participant_id: str):
        if participant_id in self.devices:
            del self.devices[participant_id]

    async def ingest_audio_chunk(
        self,
        participant_id: str,
        audio_chunk: np.ndarray,
        client_timestamp: float
    ) -> List[dict]:
        """
        Receives an audio chunk from a device, runs multi-device coordination,
        and returns any newly generated transcript segment(s).
        """
        async with self.lock:
            buf = self.devices.get(participant_id)
            if not buf:
                return []

            self.total_processed_chunks += 1
            is_speech, rms, snr = buf.add_chunk(audio_chunk, client_timestamp)

            # Check if this buffer has collected enough audio for a speech segment
            # e.g., 1.5 seconds of 16kHz audio (24,000 samples) or speech paused
            min_segment_samples = int(settings.SAMPLE_RATE * 1.5)
            should_process = False

            if buf.accumulated_samples_count >= min_segment_samples:
                should_process = True
            elif not buf.is_speaking and buf.accumulated_samples_count >= int(settings.SAMPLE_RATE * 0.8):
                should_process = True

            if not should_process:
                return []

            # Multi-device coordination window analysis:
            # Check all other connected devices during this same time frame
            active_speakers_in_window = []
            primary_participant_id = participant_id
            primary_energy = buf.get_avg_recent_rms()

            for pid, other_buf in self.devices.items():
                if other_buf.accumulated_samples_count >= int(settings.SAMPLE_RATE * 0.5):
                    other_energy = other_buf.get_avg_recent_rms()
                    if other_energy > settings.VAD_RMS_THRESHOLD:
                        active_speakers_in_window.append({
                            "participant_id": pid,
                            "display_name": other_buf.display_name,
                            "energy": other_energy,
                            "buffer": other_buf
                        })

            # Check for overlapping speech:
            # If two or more devices independently have high speech energy above threshold,
            # and neither is clearly just acoustic room bleed
            is_overlap = False
            overlapping_names = []
            
            if len(active_speakers_in_window) >= 2:
                # Sort by energy descending
                sorted_speakers = sorted(active_speakers_in_window, key=lambda s: s["energy"], reverse=True)
                top1 = sorted_speakers[0]
                top2 = sorted_speakers[1]
                
                # If top2 has high independent energy (more than ratio threshold of top1)
                if top2["energy"] >= top1["energy"] * settings.OVERLAP_ENERGY_RATIO_THRESHOLD:
                    is_overlap = True
                    self.overlap_count += 1
                    overlapping_names = [s["display_name"] for s in sorted_speakers[:2]]
                    self.active_overlap_speakers = overlapping_names

            # Process transcription for the ready buffer
            audio_samples, t_start, t_end = buf.flush_audio()
            if len(audio_samples) == 0:
                return []

            # Run STT
            transcribed_text, confidence, stt_latency = await stt_engine.transcribe_audio_async(
                audio_samples,
                settings.SAMPLE_RATE
            )

            if not transcribed_text or len(transcribed_text.strip()) == 0:
                return []

            # Compute measured end-to-end latency:
            # (current time - chunk timestamp) in milliseconds
            end_to_end_latency_ms = max(stt_latency, (time.time() - t_start) * 1000.0)
            self.latency_records.append(end_to_end_latency_ms)
            if len(self.latency_records) > 50:
                self.latency_records.pop(0)

            # Build transcript segment payload
            segment = {
                "participant_id": buf.participant_id,
                "speaker_name": buf.display_name,
                "avatar_color": buf.avatar_color,
                "device_id": buf.device_id,
                "text": transcribed_text,
                "start_timestamp": round(t_start, 3),
                "end_timestamp": round(t_end, 3),
                "confidence": round(confidence, 3),
                "is_overlap": is_overlap,
                "overlap_with": ", ".join(overlapping_names) if is_overlap else None,
                "latency_ms": round(end_to_end_latency_ms, 1)
            }

            return [segment]

    def get_avg_latency(self) -> float:
        if not self.latency_records:
            return 0.0
        return float(np.mean(self.latency_records))


class AudioCoordinatorRegistry:
    def __init__(self):
        self.coordinators: Dict[str, SessionAudioCoordinator] = {}

    def get_or_create(self, session_code: str) -> SessionAudioCoordinator:
        if session_code not in self.coordinators:
            self.coordinators[session_code] = SessionAudioCoordinator(session_code)
        return self.coordinators[session_code]

    def remove(self, session_code: str):
        if session_code in self.coordinators:
            del self.coordinators[session_code]

audio_registry = AudioCoordinatorRegistry()
