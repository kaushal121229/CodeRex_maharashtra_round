import { useEffect, useRef, useState, useCallback } from 'react';
import { Participant, TranscriptSegment } from '../types';
import { getWsBaseUrl } from '../utils/config';

interface UseSocketProps {
  sessionCode: string;
  participantId: string;
  deviceId: string;
  displayName: string;
  avatarColor: string;
  onNewCaption?: (segment: TranscriptSegment) => void;
  onOverlapAlert?: (speakers: string, timestamp: number) => void;
  onParticipantEvent?: (message: string, type: 'join' | 'leave' | 'reconnect') => void;
  onMeetingEnded?: (message: string) => void;
}

export function useRoundtableSocket({
  sessionCode,
  participantId,
  deviceId,
  displayName,
  avatarColor,
  onNewCaption,
  onOverlapAlert,
  onParticipantEvent,
  onMeetingEnded,
}: UseSocketProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('reconnecting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pingLatency, setPingLatency] = useState<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const isIntentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!sessionCode || !participantId) return;

    isIntentionalCloseRef.current = false;
    const wsUrl = getWsBaseUrl(sessionCode, participantId);
    const queryChar = wsUrl.includes('?') ? '&' : '?';
    const fullWsUrl = `${wsUrl}${queryChar}device_id=${encodeURIComponent(deviceId)}&display_name=${encodeURIComponent(displayName)}&avatar_color=${encodeURIComponent(avatarColor)}`;

    console.log('[WS] Connecting', fullWsUrl);
    setConnectionStatus('reconnecting');
    const ws = new WebSocket(fullWsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      console.log('[WS] Connected');
      setConnectionStatus('connected');

      // Send join_room handshake event
      ws.send(JSON.stringify({
        type: 'join_room',
        room_id: sessionCode,
        participant_id: participantId,
        display_name: displayName,
        device_id: deviceId,
        avatar_color: avatarColor,
      }));

      // Start periodic heartbeat
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const clientTime = Date.now();
          ws.send(JSON.stringify({ type: 'heartbeat', client_time: clientTime }));
        }
      }, 4000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgType = data.type;

        if (msgType === 'heartbeat_ack' || msgType === 'pong') {
          const latency = Date.now() - (data.client_time || Date.now());
          setPingLatency(Math.max(12, Math.round(latency / 2)));
          setConnectionStatus('connected');
        } else if (msgType === 'room_joined') {
          if (data.participants) {
            setParticipants(data.participants);
          }
          setConnectionStatus('connected');
        } else if (msgType === 'participant_joined') {
          if (data.participant) {
            setParticipants((prev) => {
              const filtered = prev.filter(p => p.participant_id !== data.participant.participant_id);
              return [...filtered, data.participant];
            });
          }
          if (data.message && onParticipantEvent) {
            onParticipantEvent(data.message, 'join');
          }
        } else if (msgType === 'participant_left') {
          if (data.participant_id) {
            setParticipants((prev) => prev.filter(p => p.participant_id !== data.participant_id));
          }
          if (data.message && onParticipantEvent) {
            onParticipantEvent(data.message, 'leave');
          }
        } else if (msgType === 'participant_reconnected') {
          if (data.participant) {
            setParticipants((prev) => {
              const filtered = prev.filter(p => p.participant_id !== data.participant.participant_id);
              return [...filtered, data.participant];
            });
          }
          if (data.message && onParticipantEvent) {
            onParticipantEvent(data.message, 'reconnect');
          }
        } else if (msgType === 'participants_update') {
          setParticipants(data.participants || []);
        } else if (msgType === 'meeting_ended') {
          isIntentionalCloseRef.current = true;
          if (onMeetingEnded) {
            onMeetingEnded(data.message || 'Meeting ended by host.');
          }
        } else if (msgType === 'removed_by_host') {
          isIntentionalCloseRef.current = true;
          if (onMeetingEnded) {
            onMeetingEnded(data.message || 'You have been removed from the meeting by the host.');
          }
        } else if (msgType === 'new_caption') {
          if (onNewCaption && data.segment) {
            onNewCaption(data.segment);
          }
        } else if (msgType === 'overlap_alert') {
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
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      console.log('[WS] Disconnected');

      if (isIntentionalCloseRef.current) {
        setConnectionStatus('disconnected');
        return;
      }

      console.log('[WS] Reconnecting...');
      setConnectionStatus('reconnecting');
      // Automatic reconnection attempt with backoff
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current && !isIntentionalCloseRef.current) {
          connect();
        }
      }, 2500);
    };

    ws.onerror = (err) => {
      console.warn('[WS] WebSocket error:', err);
      ws.close();
    };
  }, [sessionCode, participantId, deviceId, displayName, avatarColor, onNewCaption, onOverlapAlert, onParticipantEvent, onMeetingEnded]);

  const sendAudioChunk = useCallback((chunkBase64: string, rmsEnergy: number, timestamp: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        session_code: sessionCode,
        room_id: sessionCode,
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
        room_id: sessionCode,
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

  const endMeeting = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'end_meeting',
        room_id: sessionCode,
        host_id: participantId,
      }));
    }
  }, [sessionCode, participantId]);

  const removeParticipant = useCallback((targetPid: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remove_participant',
        room_id: sessionCode,
        participant_id: targetPid,
      }));
    }
  }, [sessionCode]);

  const leaveRoom = useCallback(() => {
    isIntentionalCloseRef.current = true;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'leave_room',
        room_id: sessionCode,
        participant_id: participantId,
      }));
      socketRef.current.close(1000, 'User left meeting');
    }
  }, [sessionCode, participantId]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
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
    toggleMute,
    endMeeting,
    removeParticipant,
    leaveRoom
  };
}
