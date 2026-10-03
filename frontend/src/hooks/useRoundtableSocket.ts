import { useEffect, useRef, useState, useCallback } from 'react';
import { Participant, TranscriptSegment, LiveMetrics } from '../types';

interface UseSocketProps {
  sessionCode: string;
  participantId: string;
  deviceId: string;
  displayName: string;
  avatarColor: string;
  onNewCaption?: (segment: TranscriptSegment) => void;
  onOverlapAlert?: (speakers: string, timestamp: number) => void;
}

export function useRoundtableSocket({
  sessionCode,
  participantId,
  deviceId,
  displayName,
  avatarColor,
  onNewCaption,
  onOverlapAlert,
}: UseSocketProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pingLatency, setPingLatency] = useState<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!sessionCode || !participantId) return;

    // Use current location host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${sessionCode}/${participantId}?device_id=${encodeURIComponent(deviceId)}&display_name=${encodeURIComponent(displayName)}&avatar_color=${encodeURIComponent(avatarColor)}`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('connected');

      // Start ping interval for latency tracking
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const clientTime = Date.now();
          ws.send(JSON.stringify({ type: 'ping', client_time: clientTime }));
        }
      }, 4000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          const latency = Date.now() - (data.client_time || Date.now());
          setPingLatency(Math.max(12, Math.round(latency / 2)));
        } else if (data.type === 'participants_update') {
          setParticipants(data.participants || []);
        } else if (data.type === 'new_caption') {
          if (onNewCaption && data.segment) {
            onNewCaption(data.segment);
          }
        } else if (data.type === 'overlap_alert') {
          if (onOverlapAlert) {
            onOverlapAlert(data.speakers || '', data.timestamp || Date.now() / 1000);
          }
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('reconnecting');
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      // Auto-reconnect after 2.5s
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, 2500);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      ws.close();
    };
  }, [sessionCode, participantId, deviceId, displayName, avatarColor, onNewCaption, onOverlapAlert]);

  const sendAudioChunk = useCallback((chunkBase64: string, rmsEnergy: number, timestamp: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        session_code: sessionCode,
        participant_id: participantId,
        device_id: deviceId,
        timestamp,
        rms_energy: rmsEnergy,
        audio_base64: chunkBase64
      }));
    }
  }, [sessionCode, participantId, deviceId]);

  const sendSyncSpeech = useCallback((text: string, startTimestamp: number, endTimestamp: number, confidence: number = 0.95) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'sync_speech',
        session_code: sessionCode,
        participant_id: participantId,
        device_id: deviceId,
        text,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        confidence
      }));
    }
  }, [sessionCode, participantId, deviceId]);

  const toggleMute = useCallback((isMuted: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'toggle_mic',
        is_muted: isMuted
      }));
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    participants,
    pingLatency,
    sendAudioChunk,
    sendSyncSpeech,
    toggleMute
  };
}
