import {
  DashServiceError,
  createDash,
  getDashByCode,
  getLeaderboard,
  joinDash,
  launchDash,
  setReady,
} from '../services/dashService.js';

function handleServiceError(err, reply) {
  if (err instanceof DashServiceError) return reply.code(err.status).send({ error: err.message });
  throw err;
}

export default async function dashRoutes(app) {
  // POST /dashes — create session (host), returns code
  app.post('/dashes', async (req, reply) => {
    const { hostUserId, destination } = req.body ?? {};
    if (!hostUserId || !destination?.name || destination.lat == null || destination.lng == null) {
      return reply.code(400).send({ error: 'hostUserId and destination{name,lat,lng} are required' });
    }
    try {
      return await createDash(hostUserId, destination);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // GET /dashes/:code — lobby lookup by shareable code
  app.get('/dashes/:code', async (req, reply) => {
    try {
      return await getDashByCode(req.params.code);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // POST /dashes/:id/join — join lobby
  app.post('/dashes/:id/join', async (req, reply) => {
    const { userId, vehicleId } = req.body ?? {};
    if (!userId) return reply.code(400).send({ error: 'userId is required' });
    try {
      const dash = await joinDash(req.params.id, userId, vehicleId);
      app.io.to(dash._id).emit('lobby:state', dash);
      return dash;
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // PATCH /dashes/:id/ready — toggle ready state
  app.patch('/dashes/:id/ready', async (req, reply) => {
    const { userId, ready } = req.body ?? {};
    if (!userId || ready === undefined) {
      return reply.code(400).send({ error: 'userId and ready are required' });
    }
    try {
      const dash = await setReady(req.params.id, userId, ready);
      app.io.to(dash._id).emit('lobby:state', dash);
      return dash;
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // POST /dashes/:id/launch — host-only, starts the dash
  app.post('/dashes/:id/launch', async (req, reply) => {
    const { hostUserId } = req.body ?? {};
    if (!hostUserId) return reply.code(400).send({ error: 'hostUserId is required' });
    try {
      const dash = await launchDash(req.params.id, hostUserId);
      app.io.to(dash._id).emit('lobby:state', dash);
      app.io.to(dash._id).emit('dash:launched', { dashId: dash._id });
      return dash;
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // GET /dashes/:id/leaderboard — live + historical standings
  app.get('/dashes/:id/leaderboard', async (req, reply) => {
    try {
      return await getLeaderboard(req.params.id);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}
