# Bill Dash

Real-time gamified social driving app — last to arrive pays the bill.

Full spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). This repo is a
working-prototype scaffold of that spec (see §10 of the doc for exactly
what's implemented vs. deferred) — a client app here at the repo root, and a
backend under [`server/`](server/README.md).

## Run it locally

**1. Backend** (needs MongoDB + Redis reachable — see `server/README.md`):

```bash
cd server
cp .env.example .env
npm install
npm start                 # REST + Socket.IO
# in a second terminal:
npm run worker:geofence   # geofence evaluation — arrivals/finish won't fire without this
```

**2. Client**:

```bash
cp .env.example .env.local   # point EXPO_PUBLIC_API_URL / _SOCKET_URL at the backend above
npm install
npx expo start
```

A Mapbox token (`EXPO_PUBLIC_MAPBOX_TOKEN` + the download token in
`app.json`'s `@rnmapbox/maps` plugin config) is required to render the live
map; without one, the Dash race screen still runs the full realtime flow
(telemetry, arrivals, leaderboard) and shows a placeholder in place of the map.

## Repo layout

```
App.tsx, screens/            client navigation + screens
src/types                    shared TS contracts (mirrors docs/ARCHITECTURE.md §2-3)
src/lib                      REST client, Socket.IO client, geo helpers, vehicle list
src/hooks                    GPS polling (§6), dash state hook
src/components, src/map      geofence ring, Three.js vehicle marker, Midnight Neon V3 style
shared/                      map style JSON shared by client + server
server/                      Fastify + Socket.IO + Mongo + Redis backend (see server/README.md)
docs/ARCHITECTURE.md         the full spec
```
