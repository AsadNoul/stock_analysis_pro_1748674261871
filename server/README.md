# Bill Dash server

Fastify REST + Socket.IO backend implementing `docs/ARCHITECTURE.md` §2–§4, §7.

## Requirements

- Node.js 18+
- MongoDB reachable at `MONGODB_URI` (Atlas or local)
- Redis reachable at `REDIS_URL`

## Run

```bash
cd server
cp .env.example .env   # then fill in MONGODB_URI / REDIS_URL if not local defaults
npm install
npm start              # REST + Socket.IO on $PORT (default 4000)
```

The geofence worker is a **separate process** (§4) — run it alongside the
server, scaled independently:

```bash
npm run worker:geofence
```

Without the worker running, telemetry is still buffered and broadcast as
`dash:state` every 500ms, but arrivals/finish will never fire — the worker is
what evaluates geofence crossings and writes `arrivedAt`/`rank`.

## Layout

```
src/
  config.js              env-driven config
  db/mongo.js             mongoose connection
  db/redis.js             ioredis client + dash cache + GEOADD/GEODIST helpers
  models/User.js          §2 User schema
  models/Dash.js          §2 Session (Dash) schema
  lib/geo.js              haversineM — verbatim from §4
  lib/codes.js            lobby code generator
  services/dashService.js join/ready/vehicle/launch/leaderboard — shared by REST + sockets
  services/ghostService.js ghost mode toggle + cooldown
  routes/users.js         §7 user CRUD
  routes/dashes.js        §7 dash CRUD
  sockets/index.js        connection wiring + the 500ms dash:state tick loop
  sockets/telemetry.js    dash:telemetry ingestion -> buffer + Redis stream
  sockets/telemetryBuffer.js  in-memory per-dash delta buffer
  sockets/lobby.js        lobby:* request/ack handlers
  workers/geofenceWorker.js   §4 — standalone process, stream consumer + offline-grace job
  workers/disconnectQueue.js  BullMQ queue for the "offline >2min" edge case
  index.js                entrypoint: Fastify + Socket.IO + Redis adapter
```

## Not implemented here

MongoDB Atlas Device Sync (offline client-side queueing), GPS spoofing
detection, push notifications, and payment/settlement are all explicitly out
of scope per §9 of the spec.
