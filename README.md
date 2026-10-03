# Roundtable: Live Captions for Group Conversations
### Multi-Device Collaborative Audio Capture Mesh

Roundtable transforms nearby everyday consumer devices (smartphones, laptops, tablets) into a coordinated microphone array. By combining independent acoustic perspectives, Roundtable delivers low-latency, speaker-attributed live captions, robust overlap separation, and transparent evaluation metrics.

---

## 🚀 Key Innovations & Features

1. **Multi-Device Microphone Mesh (Zero Special Hardware)**:
   - Any participant can join the session by scanning a QR code or entering a 6-character room code (e.g. `RT-48291`).
   - Each device captures audio through its built-in microphone using the HTML5 Web Audio API.

2. **Acoustic Proximity & Speaker Attribution**:
   - Rather than relying on fragile voiceprint registration, Roundtable uses participant-device mapping with real-time RMS signal energy and SNR comparison.
   - When speech occurs near Device A, Device A captures high direct signal energy while nearby devices capture lower ambient bleed. The backend coordinator attributes the speech segment to Participant A without misattributing cross-talk.

3. **Simultaneous Overlapping Speech Separation**:
   - When multiple participants speak at the same time, independent speech energy is detected across multiple devices.
   - Instead of collapsing into garbled, merged sentences, both speech streams are preserved, attributed to their respective speakers, and flagged with a live visual Overlap Alert.

4. **Resilient Reconnection**:
   - Devices maintain persistent IDs in browser storage.
   - If a device drops Wi-Fi or refreshes, it reconnects automatically with exponential backoff.
   - The session, participant profile, and full transcript history are preserved.

5. **Live System Telemetry & Transparent Evaluation**:
   - Real measured end-to-end latency profiling (capture → network → alignment → transcription → broadcast).
   - Interactive Word Error Rate (WER) benchmarking tool using dynamic programming Levenshtein distance on token arrays ($S, D, I, H$, WER %, Word Accuracy, and visual word alignment).
   - Speaker Attribution Accuracy metrics.

6. **Export & Sharing**:
   - Instant search with keyword highlighting and speaker filters.
   - Download conversation transcript as formatted TXT or professional PDF.

---

## 🏗️ Architecture Overview

```text
  Device A (Laptop Mic)     Device B (Phone Mic)     Device C (Tablet Mic)
            │                         │                         │
      Web Audio API             Web Audio API             Web Audio API
   (16kHz mono PCM)          (16kHz mono PCM)          (16kHz mono PCM)
            │                         │                         │
            └────────────┬────────────┴────────────┬────────────┘
                         ▼                         ▼
            Bi-directional WebSockets (/ws/{session}/{pid})
                         │
                         ▼
        FastAPI Audio Coordinator Engine
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Timestamp       Adaptive VAD     Cross-Device RMS
   Alignment      (Noise Floor)    Energy Attribution
        │                │                │
        └────────────────┼────────────────┘
                         ▼
             Overlapping Speech Detection
       (Concurrent Independent Energy Gate)
                         │
                         ▼
           Speech-to-Text Processing
     (faster-whisper / Groq / OpenAI API)
                         │
                         ▼
      Speaker-Attributed Live Captions Broadcast
                         │
                         ▼
        React 19 + Tailwind Glassmorphic Dashboard
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Web Audio API, WebSockets, `qrcode.react`, `jspdf`, `lucide-react`.
- **Backend**: Python 3.11+, FastAPI, Uvicorn, WebSockets, SQLAlchemy Async, SQLite (aiosqlite) / PostgreSQL.
- **AI & Audio**: `faster-whisper` (CTranslate2 INT8 tiny/base models), NumPy, SciPy, Adaptive VAD.

---

## ⚡ Quick Start (Local Run)

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup

```bash
cd backend

# (Optional) Create virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows
# source venv/bin/activate # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend starts at `http://localhost:8000`. Swagger API docs are available at `http://localhost:8000/docs`.

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (host flag enables phone access on local Wi-Fi)
npm run dev -- --host
```

The frontend runs at:
- Local: `http://localhost:5173/`
- Network (Wi-Fi): `http://<your-local-ip>:5173/`

---

## 📱 How to Test Multi-Device Capture

1. **Host Setup**: Open `http://localhost:5173` on your laptop. Click **"Create New Session"**, then click **"Generate Session & QR Code"**.
2. **Add Mobile Microphone**:
   - Ensure your phone is connected to the same Wi-Fi network.
   - Scan the QR code with your phone camera, or open `http://<your-local-ip>:5173/join?session=RT-XXXXX`.
   - Grant microphone permission on the phone and enter your name (e.g., "Rahul").
3. **Live Conversation**:
   - Speak on your laptop: note the laptop node's audio meter pulse and captions attributed to "Host".
   - Speak on your phone: note the phone node's audio meter pulse and captions attributed to "Rahul".
   - Speak at the same time: observe the **[ ⚠ Overlapping speech detected ]** amber banner and both separated speaker captions.
4. **Export Transcript**:
   - Click **"Full Transcript"** to search conversation segments, filter by speaker, and download as TXT or PDF.
5. **Evaluation**:
   - Click **"Evaluation & Metrics"** to inspect the measured latency and run the interactive Word Error Rate (WER) Levenshtein benchmark.

---

## ⚙️ Environment Variables

Create `backend/.env` (reference: `backend/.env.example`):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./roundtable.db` | SQLAlchemy database connection string |
| `WHISPER_MODEL_SIZE` | `tiny.en` | Whisper model size (`tiny.en`, `base.en`, `small.en`) |
| `WHISPER_DEVICE` | `cpu` | Device (`cpu` or `cuda`) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Inference quantization (`int8` or `float16`) |
| `VAD_RMS_THRESHOLD` | `0.015` | Minimum Root Mean Square energy for speech detection |
| `GROQ_API_KEY` | *(optional)* | Ultra-fast cloud Whisper fallback (~150ms latency) |
| `OPENAI_API_KEY` | *(optional)* | OpenAI Whisper API fallback |

---

## 🧪 Evaluation & Benchmarking Endpoints

- `POST /api/evaluation/wer`: Computes exact Word Error Rate (WER) with Substitutions, Deletions, Insertions, Hits, and token alignment sequence.
- `POST /api/evaluation/simulate-overlap/{code}`: Hackathon demo trigger to simulate simultaneous dual-microphone speech.
- `GET /api/sessions/{code}/metrics`: Live system telemetry with measured latency, active devices, and overlap counts.
