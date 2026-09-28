import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { adminUserCreate, adminUserUpdate, type AdminUserDto } from '@glukoz/shared';
import { requireRole } from '../auth/guards.js';
import { hashPassword } from '../auth/password.js';
import { destroyAllSessions } from '../auth/session.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

const idParam = z.object({ id: z.string().uuid() });

type UserWithAccess = Prisma.UserGetPayload<{ include: { access: true } }>;

function toDto(u: UserWithAccess): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    access: u.access.map((a) => ({ patientId: a.patientId, canEdit: a.canEdit })),
  };
}

async function assertNotLastAdmin(prisma: PrismaClient, userId: string): Promise<void> {
  const admins = await prisma.user.count({ where: { role: 'ADMIN', id: { not: userId } } });
  if (admins === 0) throw badRequest('Son yönetici hesabı silinemez veya rolü değiştirilemez.');
}

export async function adminUserRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma } = fastify;

  app.get('/admin/users', async (req) => {
    requireRole(req, 'ADMIN');
    const users = await prisma.user.findMany({
      include: { access: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toDto);
  });

  app.post('/admin/users', { schema: { body: adminUserCreate } }, async (req, reply) => {
    const admin = requireRole(req, 'ADMIN');
    if (await prisma.user.findUnique({ where: { email: req.body.email } }))
      throw conflict('Bu e-posta ile bir kullanıcı zaten var.');
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        displayName: req.body.displayName,
        role: req.body.role,
        passwordHash: await hashPassword(req.body.password),
        access: {
          create: req.body.access.map((a) => ({ patientId: a.patientId, canEdit: a.canEdit })),
        },
      },
      include: { access: true },
    });
    await audit(prisma, { userId: admin.id, action: 'user_create', targetId: user.id, ip: req.ip });
    return reply.status(201).send(toDto(user));
  });

  app.patch(
    '/admin/users/:id',
    { schema: { params: idParam, body: adminUserUpdate } },
    async (req) => {
      const admin = requireRole(req, 'ADMIN');
      const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!existing) throw notFound();
      const { access, password, ...rest } = req.body;
      if (rest.role && rest.role !== 'ADMIN' && existing.role === 'ADMIN')
        await assertNotLastAdmin(prisma, existing.id);
      const user = await prisma.$transaction(async (tx) => {
        if (access) {
          await tx.patientAccess.deleteMany({ where: { userId: existing.id } });
          await tx.patientAccess.createMany({
            data: access.map((a) => ({ ...a, userId: existing.id })),
          });
        }
        return tx.user.update({
          where: { id: existing.id },
          data: { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
          include: { access: true },
        });
      });
      // Şifre değişiminde tüm oturumlar silinir.
      if (password) await destroyAllSessions(prisma, existing.id);
      await audit(prisma, {
        userId: admin.id,
        action: 'user_update',
        targetId: existing.id,
        meta: { fields: Object.keys(req.body) },
        ip: req.ip,
      });
      return toDto(user);
    },
  );

  app.delete('/admin/users/:id', { schema: { params: idParam } }, async (req, reply) => {
    const admin = requireRole(req, 'ADMIN');
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();
    if (existing.role === 'ADMIN') await assertNotLastAdmin(prisma, existing.id);
    await prisma.user.delete({ where: { id: existing.id } });
    await audit(prisma, {
      userId: admin.id,
      action: 'user_delete',
      targetId: existing.id,
      ip: req.ip,
    });
    return reply.status(204).send();
  });
}
