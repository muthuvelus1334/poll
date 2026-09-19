import { useState, useEffect, useRef, useCallback } from 'react';
import { api, WS_BASE } from '../services/api';

export function usePollLiveResults(pollId) {
  const [liveData, setLiveData] = useState(null);
  const [viewers, setViewers] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initial fetch via REST API
  const fetchInitialData = useCallback(async () => {
    try {
      const data = await api.getLiveResults(pollId);
      if (isMountedRef.current) {
        setLiveData(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
      }
    }
  }, [pollId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialData();

    let retryCount = 0;
    const maxRetryDelay = 5000;

    function connectWs() {
      if (!isMountedRef.current || !pollId) return;

      const wsProtocol = WS_BASE.startsWith('https') ? 'wss' : 'ws';
      const cleanHost = WS_BASE.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      const wsUrl = `${wsProtocol}://${cleanHost}/api/polls/${pollId}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMountedRef.current) {
            setConnectionStatus('connected');
            setError(null);
            retryCount = 0;
          }
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'init' || message.type === 'vote_update') {
              setLiveData(message.payload);
            } else if (message.type === 'viewer_count') {
              setViewers(message.payload.viewers || 1);
            } else if (message.type === 'poll_closed') {
              setLiveData((prev) => prev ? { ...prev, isActive: false } : prev);
            } else if (message.type === 'poll_reopened') {
              setLiveData((prev) => prev ? { ...prev, isActive: true } : prev);
            }
          } catch (e) {
            console.error('Failed to parse WS payload:', e);
          }
        };

        ws.onclose = () => {
          if (isMountedRef.current) {
            setConnectionStatus('reconnecting');
            const delay = Math.min(1000 * Math.pow(1.5, retryCount), maxRetryDelay);
            retryCount++;
            reconnectTimeoutRef.current = setTimeout(connectWs, delay);
          }
        };

        ws.onerror = () => {
          if (isMountedRef.current) {
            setConnectionStatus('error');
          }
        };
      } catch (err) {
        if (isMountedRef.current) {
          setConnectionStatus('error');
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        }
      }
    }

    connectWs();

    // Fallback polling every 5s in case WebSockets are blocked by proxies
    const pollingInterval = setInterval(fetchInitialData, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(pollingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pollId, fetchInitialData]);

  return {
    liveData,
    viewers,
    connectionStatus,
    error,
    refresh: fetchInitialData,
  };
}
