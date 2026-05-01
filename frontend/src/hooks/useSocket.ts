import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const DEFAULT_BASE_URL = 'http://localhost:4000';

function getSocketUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_BASE_URL;
}

interface UseSocketReturn {
  connected: boolean;
  on: <T = unknown>(event: string, handler: (data: T) => void) => void;
  off: <T = unknown>(event: string, handler: (data: T) => void) => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(getSocketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler as (...args: unknown[]) => void);
  }, []);

  const off = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    socketRef.current?.off(event, handler as (...args: unknown[]) => void);
  }, []);

  return { connected, on, off };
}
