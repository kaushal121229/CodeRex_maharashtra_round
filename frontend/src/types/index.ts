export interface Participant {
  participant_id: string;
  device_id: string;
  display_name: string;
  avatar_color?: string;
  role?: 'host' | 'participant';
  status?: 'connected' | 'reconnecting' | 'disconnected';
  connection_status?: 'connected' | 'reconnecting' | 'disconnected';
  mic_active?: boolean;
  rms_level?: number;
  last_seen?: number;
  joined_at?: string;
}

export interface TranscriptSegment {
  id?: string;
  participant_id?: string;
  speaker_name: string;
  avatar_color?: string;
  device_id?: string;
  text: string;
  start_timestamp: number;
  end_timestamp: number;
  confidence: number;
  is_overlap: boolean;
  overlap_with?: string | null;
  latency_ms?: number;
  created_at?: string;
}

export interface SessionData {
  id: string;
  code: string;
  title: string;
  host_device_id?: string;
  is_active: boolean;
  created_at: string;
  participant_count: number;
  participants: Participant[];
}

export interface LiveMetrics {
  session_code: string;
  connected_devices: number;
  active_participants: number;
  avg_latency_ms: number;
  last_transcription_latency_ms: number;
  total_processed_chunks: number;
  total_segments_count: number;
  overlap_count: number;
  active_overlap_speakers: string[];
  connection_status: string;
}

export interface AlignmentDetail {
  type: 'hit' | 'substitution' | 'deletion' | 'insertion';
  ref: string;
  hyp: string;
}

export interface WERResult {
  reference_text: string;
  hypothesis_text: string;
  substitutions: number;
  deletions: number;
  insertions: number;
  hits: number;
  reference_words_count: number;
  wer: number;
  accuracy: number;
  alignment_details: AlignmentDetail[];
}
