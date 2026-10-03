import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    APP_NAME: str = "Roundtable"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./roundtable.db")
    
    # Audio Processing Config
    SAMPLE_RATE: int = 16000  # 16kHz mono audio standard for Whisper
    CHANNELS: int = 1
    BYTES_PER_SAMPLE: int = 2  # 16-bit PCM
    CHUNK_DURATION_MS: int = 500  # 500ms audio chunks from client
    
    # Coordination & VAD
    VAD_RMS_THRESHOLD: float = float(os.getenv("VAD_RMS_THRESHOLD", "0.015"))  # Minimum RMS energy for speech
    SPEECH_BUFFER_WINDOW_SEC: float = 2.0  # Sliding audio window for transcription
    OVERLAP_ENERGY_RATIO_THRESHOLD: float = 0.55  # If secondary device energy > 55% of primary, flag potential overlap
    
    # Speech-to-Text
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "tiny.en")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    
    # Cloud API fallbacks (Optional)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
