import type { FastifyRequest } from 'fastify';
import type { Patient, PrismaClient, Role, User } from '@prisma/client';
import { CONSENT_VERSION } from '@glukoz/shared';
import { AppError, forbidden, unauthorized } from '../lib/errors.js';

export function requireUser(req: FastifyRequest): User {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): User {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export async function latestConsentVersion(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const c = await prisma.consent.findFirst({ where: { userId }, orderBy: { acceptedAt: 'desc' } });
  return c?.version ?? null;
}

/** KVKK: güncel aydınlatma/açık rıza onayı olmadan sağlık verisine erişilemez. */
export async function requireConsent(prisma: PrismaClient, user: User): Promise<void> {
  if ((await latestConsentVersion(prisma, user.id)) !== CONSENT_VERSION) {
    throw new AppError(
      403,
      'CONSENT_REQUIRED',
      'Devam etmek için aydınlatma metnini onaylamanız gerekiyor.',
    );
  }
}

export interface PatientAccessResult {
  user: User;
  patient: Patient;
  canEdit: boolean;
}

/**
 * Her hasta uç noktasında çağrılır. ADMIN tüm hastalara (düzenleme dahil) erişir;
 * diğerleri `PatientAccess` ile. VIEWER hiçbir zaman düzenleyemez.
 * Erişim yoksa hastanın var olup olmadığı sızdırılmadan 403 döner.
 */
export async function requirePatient(
  prisma: PrismaClient,
  req: FastifyRequest,
  patientId: string,
  opts: { edit?: boolean } = {},
): Promise<PatientAccessResult> {
  const user = requireUser(req);
  await requireConsent(prisma, user);
  const patient = /^[0-9a-f-]{36}$/i.test(patientId)
    ? await prisma.patient.findUnique({ where: { id: patientId } })
    : null;
  let canEdit = false;
  if (patient && user.role === 'ADMIN') canEdit = true;
  else if (patient) {
    const access = await prisma.patientAccess.findUnique({
      where: { userId_patientId: { userId: user.id, patientId } },
    });
    if (!access) throw forbidden('Bu hastanın verilerine erişiminiz yok.');
    canEdit = access.canEdit && user.role !== 'VIEWER';
  }
  if (!patient) throw forbidden('Bu hastanın verilerine erişiminiz yok.');
  if (opts.edit && !canEdit) throw forbidden('Bu hasta için düzenleme yetkiniz yok.');
  return { user, patient, canEdit };
}
