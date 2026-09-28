import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { StreamEvent } from '@glukoz/shared';
import { requireConsent, requirePatient, requireUser } from '../auth/guards.js';
import { listAccessiblePatients } from '../services/patients.js';

const PING_MS = 25_000;

/** SSE: `reading`, `alert`, `status` olayları; 25 sn'de bir `ping`. */
export async function streamRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;

  app.get(
    '/stream',
    { schema: { querystring: z.object({ patientId: z.string().optional() }) } },
    async (req, reply) => {
      const user = requireUser(req);
      await requireConsent(prisma, user);
      const allowed = req.query.patientId
        ? new Set([(await requirePatient(prisma, req, req.query.patientId)).patient.id])
        : new Set((await listAccessiblePatients(prisma, user)).map((p) => p.id));
      const isAdmin = user.role === 'ADMIN';

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      const send = (event: string, data: unknown) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      res.write('retry: 5000\n\n');
      send('ping', { at: new Date().toISOString() });

      const unsubscribe = ctx.bus.subscribe((e: StreamEvent) => {
        if (e.type === 'status') {
          if (isAdmin) send('status', e);
          return;
        }
        if (allowed.has(e.patientId)) send(e.type, e);
      });
      const ping = setInterval(() => send('ping', { at: new Date().toISOString() }), PING_MS);
      req.raw.on('close', () => {
        clearInterval(ping);
        unsubscribe();
      });
    },
  );
}
