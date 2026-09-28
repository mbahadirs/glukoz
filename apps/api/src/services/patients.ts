import type { Patient, PrismaClient, User } from '@prisma/client';
import {
  CONSENT_VERSION,
  type GlucoseUnit,
  type MeResponse,
  type PatientSummary,
} from '@glukoz/shared';
import { latestConsentVersion } from '../auth/guards.js';

export function patientName(p: Pick<Patient, 'displayName' | 'firstName' | 'lastName'>): string {
  return p.displayName?.trim() || `${p.firstName} ${p.lastName}`.trim();
}

export async function toPatientSummary(
  prisma: PrismaClient,
  p: Patient,
  canEdit: boolean,
): Promise<PatientSummary> {
  const last = await prisma.reading.findFirst({
    where: { patientId: p.id },
    orderBy: { ts: 'desc' },
  });
  return {
    id: p.id,
    name: patientName(p),
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: p.displayName,
    timezone: p.timezone,
    targetLow: p.targetLow,
    targetHigh: p.targetHigh,
    lluTargetLow: p.lluTargetLow,
    lluTargetHigh: p.lluTargetHigh,
    sensorLifeDays: p.sensorLifeDays,
    canEdit,
    last: last ? { ts: last.ts.toISOString(), mgdl: last.mgdl, trend: last.trend } : null,
  };
}

export async function listAccessiblePatients(
  prisma: PrismaClient,
  user: User,
): Promise<PatientSummary[]> {
  if (user.role === 'ADMIN') {
    const all = await prisma.patient.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return Promise.all(all.map((p) => toPatientSummary(prisma, p, true)));
  }
  const access = await prisma.patientAccess.findMany({
    where: { userId: user.id },
    include: { patient: true },
  });
  return Promise.all(
    access
      .sort((a, b) => patientName(a.patient).localeCompare(patientName(b.patient), 'tr'))
      .map((a) => toPatientSummary(prisma, a.patient, a.canEdit && user.role !== 'VIEWER')),
  );
}

export async function buildMe(
  prisma: PrismaClient,
  user: User,
  csrfToken: string,
): Promise<MeResponse> {
  const consentVersion = await latestConsentVersion(prisma, user.id);
  const patients =
    consentVersion === CONSENT_VERSION ? await listAccessiblePatients(prisma, user) : [];
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale,
      unit: (user.unit === 'mmol' ? 'mmol' : 'mgdl') as GlucoseUnit,
      theme: user.theme === 'light' || user.theme === 'dark' ? user.theme : 'system',
      consentVersion,
    },
    requiredConsentVersion: CONSENT_VERSION,
    patients,
    csrfToken,
  };
}
