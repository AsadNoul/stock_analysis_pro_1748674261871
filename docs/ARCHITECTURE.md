# Bill Dash — Technical Architecture & Build Spec
Real-time gamified social driving app. Last to arrive pays the bill. This doc is the actual buildable spec: stack decisions, data models, API/socket contracts, and code — not prose description of them.

---
## 1. Stack
| Layer | Choice | Why |
|---|---|---|
| Client | React Native (Expo bare workflow) | Single codebase iOS/Android; bare workflow needed for native map + background GPS modules |
| Map rendering | Mapbox GL JS (via `@rnmapbox/maps`) | Custom style JSON support for Midnight Neon V3; Google Maps doesn't allow deep enough layer styling |
| 3D vehicles | Three.js (`three` + `expo-three`) rendered in a GLView overlay above the map | Voxel low-poly models, cheap to animate at LOD0/1 |
| Realtime transport | Socket.IO over WebSocket, Redis adapter | Horizontal scaling across nodes; battle-tested reconnection handling |
| Backend | Node.js (Fastify, not Express — lower overhead for high-frequency socket-adjacent REST) | |
| Hot state / pub-sub | Redis (sessions, presence, geofence cache, socket.io adapter) | |
| Durable store | MongoDB Atlas | Document model fits user/session shape; Atlas Device Sync for offline queueing |
| Geofencing | Custom service, Redis geospatial (GEOADD/GEODIST) | Sub-ms proximity checks at 500ms tick without hitting Mongo per tick |
| Push/offline sync | MongoDB Atlas Device Sync | Queues location/arrival events when connectivity drops, syncs on reconnect |

---
## 2. Data Model

### User
```json
{
  "_id": "usr_9f2a...",
  "displayName": "Asad",
  "avatarUrl": "https://cdn.billdash.app/avatars/usr_9f2a.jpg",
  "selectedVehicleId": "veh_camo_tank",
  "live": {
    "lat": 28.0587,
    "lng": -82.5028,
    "speedMph": 26,
    "headingDeg": 134,
    "updatedAt": "2026-08-29T14:03:21.500Z"
  },
  "stats": {
    "dashesPlayed": 41,
    "arrivedFirst": 12,
    "arrivedLast": 6,
    "billsPaid": 6
  },
  "createdAt": "2025-11-02T00:00:00Z"
}
```

### Session (Dash)
```json
{
  "_id": "dash_7c1e...",
  "code": "K7QX2",
  "hostUserId": "usr_9f2a...",
  "status": "active",
  "destination": {
    "name": "Arby's",
    "brandLogo": "arbys_hat",
    "lat": 28.0552,
    "lng": -82.4991,
    "geofenceRadiusM": 30
  },
  "participants": [
    {
      "userId": "usr_9f2a...",
      "vehicleId": "veh_camo_tank",
      "joinedAt": "2026-08-29T13:58:00Z",
      "arrivedAt": null,
      "rank": null,
      "ghost": { "active": false, "usedAt": null, "cooldownUntil": null },
      "connection": { "status": "online", "lastSeenAt": "2026-08-29T14:03:21Z" }
    },
    {
      "userId": "usr_4b11...",
      "vehicleId": "veh_fire_engine",
      "joinedAt": "2026-08-29T13:58:40Z",
      "arrivedAt": "2026-08-29T14:11:02Z",
      "rank": 1,
      "ghost": { "active": false, "usedAt": null, "cooldownUntil": null },
      "connection": { "status": "online", "lastSeenAt": "2026-08-29T14:11:02Z" }
    }
  ],
  "startedAt": "2026-08-29T14:00:00Z",
  "endedAt": null
}
```
Indexes: `code` (unique, TTL-adjacent for cleanup of stale lobbies), `participants.userId`, `status`.

---
## 3. Realtime Contract
Tick rate: **500ms**, binary-encoded (MessagePack, not JSON — see §6).

**Client → Server**, `dash:telemetry`
```
{ dashId, lat, lng, speedMph, headingDeg }
```

**Server → Room**, `dash:state` (broadcast every tick, delta-compressed — only changed participants included)
```
{
  dashId,
  tick: 184,
  participants: [
    { userId, lat, lng, speedMph, headingDeg, rank, ghosted }
  ]
}
```

**Server → Room**, `dash:arrival` (fired once per participant on geofence entry)
```
{ userId, rank, arrivedAt, isLast: false }
```

**Server → Room**, `dash:finished` (fired when only one active participant remains and they cross the geofence)
```
{ dashId, loserId, finalRanks: [...], leaderboard: [...] }
```

Lobby events: `lobby:join`, `lobby:ready`, `lobby:vehicleSelect`, `lobby:launch` — standard request/ack pattern, not tick-rate.

---
## 4. Geofencing Service
Runs as its own worker process, subscribed to the `dash:telemetry` Redis stream (fan-out from Socket.IO ingestion nodes so geofence eval never blocks the hot broadcast path).

```javascript
// geofence-worker.js
const EARTH_R_M = 6371000;
function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.sqrt(a));
}
async function evaluateTick(dashId, participantId, lat, lng) {
  const dash = await getDashCached(dashId); // Redis-cached session doc
  const dist = haversineM(lat, lng, dash.destination.lat, dash.destination.lng);
  if (dist <= dash.destination.geofenceRadiusM) {
    await markArrived(dashId, participantId); // idempotent, sets arrivedAt + rank
    const stillActive = dash.participants.filter(
      p => !p.arrivedAt && p.connection.status !== 'disconnected_final'
    );
    if (stillActive.length === 1 && stillActive[0].userId === participantId) {
      await finalizeDash(dashId, participantId); // this user is the loser, pays the bill
    } else if (stillActive.length === 0) {
      await finalizeDash(dashId, null); // last arrival just happened via this call
    }
  }
}
```

Edge cases handled explicitly:
- **Offline >2min**: a Bull/Redis-backed delayed job is scheduled on every `disconnect`; cancelled on `reconnect`. If it fires, the participant is auto-ranked last **only if** at least one other participant is still connected — otherwise the whole dash is flagged `stale` and paused rather than resolved, so a group Wi-Fi drop doesn't wrongly crown a loser.
- **Ghost abuse**: Ghost mode hides `lat/lng` from broadcast (server still tracks it internally for geofencing). If a user's telemetry shows they crossed within 100m of the geofence *while ghosted* and then immediately arrived within one tick of un-ghosting, a `ghostAbuseFlag` is set on that participant and surfaced to the host post-game rather than silently blocking — avoids false positives from normal driving.

---
## 5. Map Layer — Midnight Neon V3
Mapbox GL style, key layers only:
```json
{
  "version": 8,
  "name": "Midnight Neon V3",
  "layers": [
    { "id": "ground", "type": "background", "paint": { "background-color": "#0B0E14" } },
    {
      "id": "roads-glow",
      "type": "line",
      "source": "composite", "source-layer": "road",
      "paint": {
        "line-color": "#00D4FF",
        "line-opacity": 0.35,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 18, 4]
      }
    },
    {
      "id": "route-main-user",
      "type": "line",
      "source": "route-self",
      "paint": {
        "line-color": "#00E5FF",
        "line-width": 5,
        "line-opacity": 1
      }
    },
    {
      "id": "route-others",
      "type": "line",
      "source": "route-others",
      "paint": {
        "line-color": "#00E5FF",
        "line-opacity": 0.5,
        "line-dasharray": [2, 2]
      }
    }
  ]
}
```
Destination marker + pulsing geofence ring is a client-side animated layer (radius interpolated via `requestAnimationFrame`, not a Mapbox paint property, since Mapbox doesn't animate radius natively).

---
## 6. Performance
**Battery** — variable-rate GPS polling:
```javascript
function pollIntervalMs(speedMph, appState) {
  if (appState !== 'foreground') return 10000;
  if (speedMph < 3) return 4000;   // parked/stopped
  if (speedMph < 25) return 1500;
  return 500;                       // highway speed, need tight tracking
}
```

**Data usage** — MessagePack over raw JSON for telemetry packets cuts payload roughly 40–60% versus JSON for this shape (numeric-heavy, few string keys), and skips JSON.parse overhead client-side. REST/CRUD endpoints stay JSON for debuggability; only the 500ms hot path is binary.

---
## 7. CRUD Surface (REST)
```
POST   /users                          create profile
GET    /users/:id                      profile + stats
PATCH  /users/:id                      update profile/vehicle
POST   /dashes                         create session (host), returns code
GET    /dashes/:code                   lobby lookup by shareable code
POST   /dashes/:id/join                join lobby
PATCH  /dashes/:id/ready               toggle ready state
POST   /dashes/:id/launch              host-only, starts the dash
GET    /dashes/:id/leaderboard         live + historical standings
```
Socket.IO handles everything above `launch` — telemetry, arrivals, finish.

---
## 8. 3D Asset Pipeline (Voxel Vehicles)
- Budget: **≤1,200 tris per vehicle** at LOD0, **≤400** at LOD1 (used beyond ~150m camera distance or when 4+ vehicles are on screen), **≤120** at LOD2 (icon/avatar-stack use).
- Single **1024×1024 texture atlas per vehicle class** (tank, fire engine, sedan share a palette-mapped atlas where possible to cut draw calls) — flat-shaded voxel faces mean no normal maps needed, just an unlit/base-color atlas.
- Idle animation: baked, ≤2 second loop, sampled at 15fps and interpolated — no runtime IK needed for this fidelity level.
- Export: glTF 2.0 (`.glb`), Draco-compressed, loaded via `expo-three`'s GLTFLoader.

---
## 9. What's Not Solved Here
Left as follow-up decisions once you're building for real: auth/anti-cheat for GPS spoofing (detectable via speed-delta sanity checks between ticks, not yet specced), push notification service for arrival alerts when app is backgrounded, and payment/settlement integration if "pays the bill" becomes literal (Stripe Connect between friends, or just a taunt screen — worth deciding before you build the loser UI).

---
## 10. What this repo currently implements

This is a working-prototype scaffold following the spec above, not a
production build. Concretely:

- **Client** (repo root, Expo): `screens/*` implement Home → Create/Join →
  Lobby → live Dash race → Results, wired through `src/lib/socket.ts`
  (Socket.IO + MessagePack), `src/lib/api.ts` (REST client), `src/hooks/*`
  (variable-rate GPS polling, dash state), and `src/map` / `src/components`
  (Midnight Neon V3 style, animated geofence ring, Three.js vehicle
  markers). The 3D vehicles are procedural box-voxel stand-ins — swap
  `buildVoxelMesh` in `src/components/VehicleMarker.tsx` for a `GLTFLoader`
  call once real `.glb` assets exist (§8).
- **Server** (`server/`): Fastify REST surface (§7) + Socket.IO (§3) with
  MessagePack framing and a Redis adapter, a Mongo-backed `Dash`/`User`
  model matching §2, and a separate `geofenceWorker.js` process consuming a
  Redis stream exactly per the §4 pseudocode, including the offline-grace
  (BullMQ) and ghost-abuse-flag edge cases.
- **Not wired up**: MongoDB Atlas Device Sync (the worker/server assume a
  live connection; offline client queueing is not implemented), real GPS
  spoofing detection, push notifications, and any payment/settlement
  integration — all explicitly deferred by §9 above.
- **Extensions beyond the literal contract**, called out in code comments
  where they appear: a `lobby:state` broadcast event (so participants other
  than the actor learn about a join/ready/vehicle change) and a
  `dash:ghostToggle` socket event (the ghost mode control implied by the
  `ghost{}` struct in §2, but never given its own event in §3).

See `server/README.md` and the root `README.md` for how to run both halves
locally.
