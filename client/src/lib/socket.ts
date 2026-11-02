import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to EventPulse WebSocket server');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server:', reason);
    });
  }

  return socket;
}

export function joinSessionRoom(code: string, participantId?: string, displayName?: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('session:join', { code, participantId, displayName });
  } else {
    s.once('connect', () => {
      s.emit('session:join', { code, participantId, displayName });
    });
  }
}
