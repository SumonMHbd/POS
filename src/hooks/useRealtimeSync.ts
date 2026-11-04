import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserRole, WorkspaceTab } from '../types/pos';

export interface ActiveCollaborator {
  clientId: string;
  name: string;
  email: string;
  role: string;
  room: string;
  activeTab: string;
  joinedAt: string;
}

export interface IncomingRealtimeDelta {
  eventId: string;
  type: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  data: any;
}

export function useRealtimeSync(params: {
  room: string;
  authToken?: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  activeTab: WorkspaceTab;
  isOnline: boolean;
  onRemoteDelta: (delta: IncomingRealtimeDelta) => void;
}) {
  const [collaborators, setCollaborators] = useState<ActiveCollaborator[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const onRemoteDeltaRef = useRef(params.onRemoteDelta);
  onRemoteDeltaRef.current = params.onRemoteDelta;

  const latestIdentityRef = useRef({
    room: params.room || 'local-workspace',
    authToken: params.authToken || '',
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    activeTab: params.activeTab,
  });

  latestIdentityRef.current = {
    room: params.room || 'local-workspace',
    authToken: params.authToken || '',
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    activeTab: params.activeTab,
  };

  useEffect(() => {
    if (!params.isOnline || !params.authToken) {
      setWsConnected(false);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        setWsConnected(false);
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }
        retryCount = 0;
        setWsConnected(true);
        const id = latestIdentityRef.current;
        socket.send(
          JSON.stringify({
            type: 'room:join',
            token: id.authToken,
            room: id.room,
            name: id.actorName,
            email: id.actorEmail,
            role: id.actorRole,
            activeTab: id.activeTab,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'presence:list' && Array.isArray(msg.members)) {
            setCollaborators(msg.members);
            return;
          }
          if (msg.eventId) {
            if (seenEventIdsRef.current.has(msg.eventId)) return;
            seenEventIdsRef.current.add(msg.eventId);
            onRemoteDeltaRef.current(msg as IncomingRealtimeDelta);
          }
        } catch (err) {
          console.warn('WS message parse warning:', err);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          const delay = Math.min(8000, 1000 * Math.pow(1.6, retryCount++));
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [params.room, params.isOnline, params.authToken]);

  useEffect(() => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'presence:tab',
          activeTab: params.activeTab,
          role: params.actorRole,
          name: params.actorName,
        })
      );
    }
  }, [params.activeTab, params.actorRole, params.actorName]);

  const broadcastMutation = useCallback((mutationType: string, data: unknown) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      seenEventIdsRef.current.add(eventId);
      socket.send(
        JSON.stringify({
          type: 'pos:mutation',
          eventId,
          mutationType,
          data,
        })
      );
    }
  }, []);

  return {
    collaborators,
    wsConnected,
    broadcastMutation,
  };
}
