import { User } from '../models/User.js';

export default async function userRoutes(app) {
  // POST /users — create profile
  app.post('/users', async (req, reply) => {
    const { displayName, selectedVehicleId } = req.body ?? {};
    if (!displayName) return reply.code(400).send({ error: 'displayName is required' });

    const user = await User.create({ displayName, selectedVehicleId });
    return user.toObject();
  });

  // GET /users/:id — profile + stats
  app.get('/users/:id', async (req, reply) => {
    const user = await User.findById(req.params.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return user.toObject();
  });

  // PATCH /users/:id — update profile/vehicle
  app.patch('/users/:id', async (req, reply) => {
    const patch = {};
    for (const key of ['displayName', 'selectedVehicleId', 'avatarUrl']) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return user.toObject();
  });
}
