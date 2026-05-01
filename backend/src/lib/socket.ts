import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { getEnv } from '../config/env.js';
import { verifyAccessToken } from '../modules/auth/auth.service.js';

let io: SocketIOServer | null = null;

/**
 * Initialise the Socket.IO server and attach it to the existing HTTP server.
 * Must be called **after** `app.listen()` so that `app.server` is ready.
 */
export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const env = getEnv();
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
    // Only broadcast — no incoming events expected from clients
    serveClient: false,
  });

  // Optional auth: verify the JWT if provided via cookie or auth header
  io.use((socket, next) => {
    try {
      // Try cookie first (access_token), then auth header
      const cookieHeader = socket.handshake.headers.cookie;
      let token: string | null = null;

      if (cookieHeader) {
        const match = cookieHeader
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('access_token='));
        if (match) {
          token = match.split('=')[1] ?? null;
        }
      }

      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice('Bearer '.length).trim() || null;
        }
      }

      if (!token) {
        // Auth is recommended but not strictly required for receiving broadcasts
        // Allow unauthenticated connections to proceed
        return next();
      }

      // Verify the token — if invalid, reject the connection
      verifyAccessToken(token);
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (_socket) => {
    // Broadcast-only — no incoming event handlers
  });

  return io;
}

/**
 * Returns the singleton Socket.IO server instance.
 * Throws if called before `initSocketIO()`.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialised. Call initSocketIO() first.');
  }
  return io;
}
