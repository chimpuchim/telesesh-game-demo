import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { gamesRouter } from './api/gamesRouter.js';
import { registerSocketHandlers, type GameServer } from './socket/registerSocketHandlers.js';

const PORT = Number(process.env.PORT ?? 3001);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), IS_PRODUCTION ? '../../..' : '..');

const app = express();
app.disable('x-powered-by');
app.use('/api', gamesRouter);
app.get('/healthz', (_req, res) => res.json({ ok: true }));

if (IS_PRODUCTION) {
  const clientDir = path.join(ROOT, 'dist/client');
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = createServer(app);
const io: GameServer = new Server(httpServer, {
  // Vite dev server runs on another origin in development.
  cors: IS_PRODUCTION ? undefined : { origin: true },
});
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
});
