import time
import io
import wave
import logging
import asyncio
import numpy as np
from app.config import settings

logger = logging.getLogger("roundtable.stt")

class STTEngine:
    def __init__(self):
        self.model = None
        self.is_loading = False
        self.is_ready = False
        self.engine_type = "faster-whisper"

    def initialize(self):
        """Initializes the local Whisper model in a background-friendly manner."""
        if self.is_ready or self.is_loading:
            return

        self.is_loading = True
        try:
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{settings.WHISPER_MODEL_SIZE}' on {settings.WHISPER_DEVICE}...")
            # Load with cpu and int8 for maximum compatibility and low memory
            self.model = WhisperModel(
                settings.WHISPER_MODEL_SIZE,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE,
                download_root="./whisper_models"
            )
            self.is_ready = True
            self.is_loading = False
            logger.info("faster-whisper model successfully loaded and ready.")
        except Exception as e:
            self.is_loading = False
            logger.error(f"Failed to load faster-whisper: {e}. Will fallback to API or mock processor if needed.")

    async def transcribe_audio_async(self, audio_data: np.ndarray, sample_rate: int = 16000) -> tuple[str, float, float]:
        """
        Asynchronously transcribes audio_data (16kHz float32 or int16 array).
        Returns: (transcribed_text, confidence, latency_ms)
        """
        start_time = time.perf_counter()
        
        # Audio preprocessing: normalize float32 between -1.0 and 1.0
        if audio_data.dtype == np.int16:
            samples = audio_data.astype(np.float32) / 32768.0
        else:
            samples = audio_data.astype(np.float32)

        # Minimum duration check (at least 0.4 seconds of audio)
        if len(samples) < int(sample_rate * 0.4):
            return "", 0.0, 0.0

        # Optional cloud Groq Whisper if API key is provided
        if settings.GROQ_API_KEY:
            try:
                text, conf = await self._transcribe_groq(samples, sample_rate)
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                return text.strip(), conf, latency_ms
            except Exception as e:
                logger.warning(f"Groq Whisper failed: {e}. Falling back to local model.")

        # Optional cloud OpenAI Whisper if API key is provided
        if settings.OPENAI_API_KEY:
            try:
                text, conf = await self._transcribe_openai(samples, sample_rate)
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                return text.strip(), conf, latency_ms
            except Exception as e:
                logger.warning(f"OpenAI Whisper failed: {e}. Falling back to local model.")

        # Local faster-whisper transcription
        if not self.is_ready:
            # Try to load if not yet initialized
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.initialize)

        if self.is_ready and self.model:
            loop = asyncio.get_event_loop()
            text, conf = await loop.run_in_executor(None, self._transcribe_local, samples)
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return text.strip(), conf, latency_ms

        # Fallback if model could not be loaded
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return "", 0.0, latency_ms

    def _transcribe_local(self, samples: np.ndarray) -> tuple[str, float]:
        """Runs faster-whisper synchronously in executor thread."""
        try:
            # faster-whisper accepts float32 numpy array directly
            segments, info = self.model.transcribe(
                samples,
                beam_size=1,  # Greedy for minimal latency in live streaming
                language="en",
                condition_on_previous_text=False,
                vad_filter=False  # We run our own multi-device VAD upstream
            )
            
            transcript_parts = []
            confidences = []
            for seg in segments:
                if seg.text.strip():
                    transcript_parts.append(seg.text.strip())
                    # avg_logprob mapped to pseudo-confidence [0, 1]
                    conf = float(np.exp(seg.avg_logprob)) if seg.avg_logprob else 0.95
                    confidences.append(min(max(conf, 0.1), 1.0))
            
            final_text = " ".join(transcript_parts)
            avg_conf = float(np.mean(confidences)) if confidences else 0.95
            return final_text, avg_conf
        except Exception as e:
            logger.error(f"Local transcription error: {e}")
            return "", 0.0

    async def _transcribe_groq(self, samples: np.ndarray, sample_rate: int) -> tuple[str, float]:
        """Transcribe using Groq Cloud API for ultra-low latency (~150ms)."""
        import httpx
        # Convert samples to WAV in-memory
        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            int_samples = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
            wf.writeframes(int_samples.tobytes())
        wav_io.seek(0)

        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
            files = {"file": ("audio.wav", wav_io.getvalue(), "audio/wav")}
            data = {"model": "whisper-large-v3-turbo", "language": "en"}
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data
            )
            resp.raise_for_status()
            res_data = resp.json()
            return res_data.get("text", ""), 0.98

    async def _transcribe_openai(self, samples: np.ndarray, sample_rate: int) -> tuple[str, float]:
        """Transcribe using OpenAI Whisper API."""
        import httpx
        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            int_samples = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
            wf.writeframes(int_samples.tobytes())
        wav_io.seek(0)

        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            files = {"file": ("audio.wav", wav_io.getvalue(), "audio/wav")}
            data = {"model": "whisper-1", "language": "en"}
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data
            )
            resp.raise_for_status()
            res_data = resp.json()
            return res_data.get("text", ""), 0.97


# Global singleton
stt_engine = STTEngine()
