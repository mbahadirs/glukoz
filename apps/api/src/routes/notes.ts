import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Note } from '@prisma/client';
import { noteBody, noteUpdate, rangeQuery, type NoteDto } from '@glukoz/shared';
import { requirePatient } from '../auth/guards.js';
import { notFound } from '../lib/errors.js';

const params = z.object({ id: z.string() });
const noteParams = z.object({ id: z.string(), noteId: z.string().uuid() });

export function toNoteDto(n: Note): NoteDto {
  return {
    id: n.id,
    patientId: n.patientId,
    authorId: n.authorId,
    ts: n.ts.toISOString(),
    type: n.type,
    carbsG: n.carbsG,
    insulinU: n.insulinU === null ? null : Number(n.insulinU),
    durationMin: n.durationMin,
    waterMl: n.waterMl,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function noteRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;

  app.get('/patients/:id/notes', { schema: { params, querystring: rangeQuery } }, async (req) => {
    const { patient } = await requirePatient(prisma, req, req.params.id);
    const notes = await prisma.note.findMany({
      where: { patientId: patient.id, ts: { gte: req.query.from, lt: req.query.to } },
      orderBy: { ts: 'desc' },
      take: 2000,
    });
    return notes.map(toNoteDto);
  });

  app.post('/patients/:id/notes', { schema: { params, body: noteBody } }, async (req, reply) => {
    const { user, patient } = await requirePatient(prisma, req, req.params.id, { edit: true });
    const note = await prisma.note.create({
      data: {
        patientId: patient.id,
        authorId: user.id,
        ts: req.body.ts,
        type: req.body.type,
        carbsG: req.body.carbsG ?? null,
        insulinU: req.body.insulinU ?? null,
        durationMin: req.body.durationMin ?? null,
        waterMl: req.body.waterMl ?? null,
        text: req.body.text ?? null,
      },
    });
    ctx.reports.invalidatePatient(patient.id);
    return reply.status(201).send(toNoteDto(note));
  });

  app.patch(
    '/patients/:id/notes/:noteId',
    { schema: { params: noteParams, body: noteUpdate } },
    async (req) => {
      const { patient } = await requirePatient(prisma, req, req.params.id, { edit: true });
      const existing = await prisma.note.findFirst({
        where: { id: req.params.noteId, patientId: patient.id },
      });
      if (!existing) throw notFound('Not bulunamadı.');
      const note = await prisma.note.update({ where: { id: existing.id }, data: req.body });
      ctx.reports.invalidatePatient(patient.id);
      return toNoteDto(note);
    },
  );

  app.delete(
    '/patients/:id/notes/:noteId',
    { schema: { params: noteParams } },
    async (req, reply) => {
      const { patient } = await requirePatient(prisma, req, req.params.id, { edit: true });
      const res = await prisma.note.deleteMany({
        where: { id: req.params.noteId, patientId: patient.id },
      });
      if (res.count === 0) throw notFound('Not bulunamadı.');
      ctx.reports.invalidatePatient(patient.id);
      return reply.status(204).send();
    },
  );
}
