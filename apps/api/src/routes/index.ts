import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { adminUserRoutes } from './admin-users.js';
import { lluAccountRoutes } from './llu-accounts.js';
import { patientRoutes } from './patients.js';
import { noteRoutes } from './notes.js';
import { dataRoutes } from './data.js';
import { alertRoutes } from './alerts.js';
import { pushRoutes } from './push.js';
import { streamRoutes } from './stream.js';
import { systemRoutes } from './system.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(systemRoutes);
  await app.register(authRoutes);
  await app.register(adminUserRoutes);
  await app.register(lluAccountRoutes);
  await app.register(patientRoutes);
  await app.register(noteRoutes);
  await app.register(dataRoutes);
  await app.register(alertRoutes);
  await app.register(pushRoutes);
  await app.register(streamRoutes);
}
