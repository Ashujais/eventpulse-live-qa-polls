import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;
const roomParticipantCounts = new Map<string, Set<string>>();

export function initSocketServer(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    let currentRoom: string | null = null;
    let currentParticipantId: string | null = null;

    socket.on('session:join', (data: { code: string; participantId?: string; displayName?: string }) => {
      if (!data || !data.code) return;
      const room = `session:${data.code.toUpperCase()}`;

      // Leave prior room if any
      if (currentRoom) {
        socket.leave(currentRoom);
        if (currentParticipantId) {
          const roomSet = roomParticipantCounts.get(currentRoom);
          if (roomSet) {
            roomSet.delete(socket.id);
            io?.to(currentRoom).emit('session:participant_count', { count: roomSet.size });
          }
        }
      }

      currentRoom = room;
      currentParticipantId = data.participantId || socket.id;
      socket.join(room);

      // Track live participants
      if (!roomParticipantCounts.has(room)) {
        roomParticipantCounts.set(room, new Set());
      }
      const roomSet = roomParticipantCounts.get(room)!;
      roomSet.add(socket.id);

      // Broadcast new count to room
      io?.to(room).emit('session:participant_count', { count: roomSet.size });
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        const roomSet = roomParticipantCounts.get(currentRoom);
        if (roomSet) {
          roomSet.delete(socket.id);
          io?.to(currentRoom).emit('session:participant_count', { count: roomSet.size });
          if (roomSet.size === 0) {
            roomParticipantCounts.delete(currentRoom);
          }
        }
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
