-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CAREGIVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('current', 'graph', 'logbook', 'import');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'paused', 'error');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('meal', 'insulin_rapid', 'insulin_basal', 'exercise', 'medication', 'illness', 'sleep', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "unit" TEXT NOT NULL DEFAULT 'mgdl',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llu_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emailEnc" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "region" TEXT,
    "lluUserId" TEXT,
    "tokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llu_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "lluPatientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "targetLow" INTEGER NOT NULL DEFAULT 70,
    "targetHigh" INTEGER NOT NULL DEFAULT 180,
    "lluTargetLow" INTEGER,
    "lluTargetHigh" INTEGER,
    "sensorLifeDays" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_access" (
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "patient_access_pkey" PRIMARY KEY ("userId","patientId")
);

-- CreateTable
CREATE TABLE "readings" (
    "id" BIGSERIAL NOT NULL,
    "patientId" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "deviceLocalTs" TEXT,
    "mgdl" INTEGER NOT NULL,
    "trend" INTEGER,
    "source" "ReadingSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logbook_entries" (
    "id" BIGSERIAL NOT NULL,
    "patientId" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "mgdl" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "alarmType" INTEGER,

    CONSTRAINT "logbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "productType" INTEGER,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expectedEnd" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "type" "NoteType" NOT NULL,
    "carbsG" INTEGER,
    "insulinU" DECIMAL(5,2),
    "durationMin" INTEGER,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdMgdl" INTEGER,
    "sustainMin" INTEGER NOT NULL DEFAULT 0,
    "cooldownMin" INTEGER NOT NULL DEFAULT 30,
    "quietStart" TEXT,
    "quietEnd" TEXT,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mgdl" INTEGER,
    "message" TEXT NOT NULL,
    "ackBy" TEXT,
    "ackAt" TIMESTAMP(3),

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" BIGSERIAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "newReadings" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_accountId_lluPatientId_key" ON "patients"("accountId", "lluPatientId");

-- CreateIndex
CREATE INDEX "readings_patientId_ts_idx" ON "readings"("patientId", "ts" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "readings_patientId_ts_key" ON "readings"("patientId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "logbook_entries_patientId_ts_kind_key" ON "logbook_entries"("patientId", "ts", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_patientId_serial_key" ON "sensors"("patientId", "serial");

-- CreateIndex
CREATE INDEX "notes_patientId_ts_idx" ON "notes"("patientId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_patientId_kind_key" ON "alert_rules"("patientId", "kind");

-- CreateIndex
CREATE INDEX "alert_events_patientId_firedAt_idx" ON "alert_events"("patientId", "firedAt");

-- CreateIndex
CREATE INDEX "alert_events_ruleId_firedAt_idx" ON "alert_events"("ruleId", "firedAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "collector_runs_accountId_startedAt_idx" ON "collector_runs"("accountId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "llu_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_access" ADD CONSTRAINT "patient_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_access" ADD CONSTRAINT "patient_access_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
