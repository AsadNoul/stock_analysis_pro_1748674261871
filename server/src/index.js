import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
// eslint-disable-next-line import/no-unresolved
import msgpackParser from 'socket.io-msgpack-parser';

import { config } from './config.js';
import { connectMongo } from './db/mongo.js';
import { newRedisConnection } from './db/redis.js';
import userRoutes from './routes/users.js';
import dashRoutes from './routes/dashes.js';
import { registerSocketHandlers, startTickLoop } from './sockets/index.js';

async function main() {
  await connectMongo();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(userRoutes);
  await app.register(dashRoutes);

  app.get('/health', async () => ({ ok: true }));

  // Socket.IO sits on the same HTTP server as the Fastify REST surface (§7:
  // "Socket.IO handles everything above `launch`"). Whole-connection
  // MessagePack framing (§6) covers lobby + telemetry events alike; REST
  // stays JSON because it's a separate HTTP transport entirely.
  const io = new Server(app.server, {
    parser: msgpackParser,
    cors: { origin: config.corsOrigin },
  });

  const pubClient = newRedisConnection();
  const subClient = newRedisConnection();
  io.adapter(createAdapter(pubClient, subClient));

  app.decorate('io', io);
  registerSocketHandlers(io);
  const stopTickLoop = startTickLoop(io);

  app.addHook('onClose', async () => {
    stopTickLoop();
    await pubClient.quit();
    await subClient.quit();
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[bill-dash-server] listening on :${config.port}`);
}

main().catch((err) => {
  console.error('[bill-dash-server] fatal', err);
  process.exit(1);
});
