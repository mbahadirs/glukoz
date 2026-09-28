import type { Prisma, PrismaClient } from '@prisma/client';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'setup'
  | 'view_report'
  | 'export_csv'
  | 'import_csv'
  | 'delete_patient_data'
  | 'llu_account_create'
  | 'llu_account_delete'
  | 'llu_account_resume'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'patient_update'
  | 'consent';

export async function audit(
  prisma: PrismaClient,
  entry: {
    userId?: string | null;
    action: AuditAction;
    targetId?: string | null;
    meta?: Prisma.InputJsonValue;
    ip?: string | null;
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      targetId: entry.targetId ?? null,
      meta: entry.meta,
      ip: entry.ip ?? null,
    },
  });
}
