import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AlertEventDto,
  AlertRuleDto,
  CurrentResponse,
  DayResponse,
  GlycemicEvent,
  LogbookEntryDto,
  NoteDto,
  PatientSummary,
  ReadingsResponse,
  ReportComparison,
  ReportResponse,
  SensorHistoryDto,
} from '@glukoz/shared';
import { api } from './api';

export const qk = {
  me: ['me'] as const,
  setup: ['setup-status'] as const,
  patients: ['patients'] as const,
  current: (id: string) => ['current', id] as const,
  readings: (id: string, from: number, to: number, res: string) =>
    ['readings', id, from, to, res] as const,
  day: (id: string, date: string) => ['day', id, date] as const,
  report: (id: string, from: number, to: number) => ['report', id, from, to] as const,
  compare: (id: string, from: number, to: number) => ['compare', id, from, to] as const,
  notes: (id: string, from: number, to: number) => ['notes', id, from, to] as const,
  logbook: (id: string, from: number, to: number) => ['logbook', id, from, to] as const,
  sensors: (id: string) => ['sensors', id] as const,
  rules: (id: string) => ['rules', id] as const,
  alerts: (id: string) => ['alerts', id] as const,
  activeAlerts: ['alerts-active'] as const,
};

const P = (id: string) => `/api/patients/${encodeURIComponent(id)}`;

export function usePatients() {
  return useQuery({ queryKey: qk.patients, queryFn: () => api<PatientSummary[]>('/api/patients') });
}

export function useCurrent(id: string | undefined, pollMs: number | false) {
  return useQuery({
    queryKey: qk.current(id ?? ''),
    queryFn: () => api<CurrentResponse>(`${P(id!)}/current`),
    enabled: !!id,
    refetchInterval: pollMs,
  });
}

export function useReadings(
  id: string | undefined,
  from: number,
  to: number,
  resolution: 'raw' | '5m' = '5m',
) {
  return useQuery({
    queryKey: qk.readings(id ?? '', from, to, resolution),
    queryFn: () => api<ReadingsResponse>(`${P(id!)}/readings`, { query: { from, to, resolution } }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useDay(id: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: qk.day(id ?? '', date ?? ''),
    queryFn: () => api<DayResponse>(`${P(id!)}/day`, { query: { date } }),
    enabled: !!id && !!date,
  });
}

export function useReport(id: string | undefined, from: number, to: number) {
  return useQuery({
    queryKey: qk.report(id ?? '', from, to),
    queryFn: () => api<ReportResponse>(`${P(id!)}/report`, { query: { from, to } }),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCompare(id: string | undefined, from: number, to: number) {
  return useQuery({
    queryKey: qk.compare(id ?? '', from, to),
    queryFn: () => api<ReportComparison>(`${P(id!)}/report/compare`, { query: { from, to } }),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useEvents(id: string | undefined, from: number, to: number) {
  return useQuery({
    queryKey: ['events', id, from, to],
    queryFn: () => api<GlycemicEvent[]>(`${P(id!)}/events`, { query: { from, to } }),
    enabled: !!id,
  });
}

export function useNotes(id: string | undefined, from: number, to: number) {
  return useQuery({
    queryKey: qk.notes(id ?? '', from, to),
    queryFn: () => api<NoteDto[]>(`${P(id!)}/notes`, { query: { from, to } }),
    enabled: !!id,
  });
}

export function useLogbook(id: string | undefined, from: number, to: number) {
  return useQuery({
    queryKey: qk.logbook(id ?? '', from, to),
    queryFn: () => api<LogbookEntryDto[]>(`${P(id!)}/logbook`, { query: { from, to } }),
    enabled: !!id,
  });
}

export function useSensors(id: string | undefined) {
  return useQuery({
    queryKey: qk.sensors(id ?? ''),
    queryFn: () => api<SensorHistoryDto[]>(`${P(id!)}/sensors`),
    enabled: !!id,
  });
}

export function useAlertRules(id: string | undefined) {
  return useQuery({
    queryKey: qk.rules(id ?? ''),
    queryFn: () => api<AlertRuleDto[]>(`${P(id!)}/alert-rules`),
    enabled: !!id,
  });
}

export function usePatientAlerts(id: string | undefined) {
  return useQuery({
    queryKey: qk.alerts(id ?? ''),
    queryFn: () => api<AlertEventDto[]>(`${P(id!)}/alerts`, { query: { limit: 100 } }),
    enabled: !!id,
  });
}

export function useActiveAlerts(enabled: boolean) {
  return useQuery({
    queryKey: qk.activeAlerts,
    queryFn: () => api<AlertEventDto[]>('/api/alerts/active'),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<AlertEventDto>(`/api/alerts/${encodeURIComponent(id)}/ack`, { method: 'POST', body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.activeAlerts });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export interface NoteInput {
  ts: string;
  type: NoteDto['type'];
  carbsG?: number | null;
  insulinU?: number | null;
  durationMin?: number | null;
  waterMl?: number | null;
  text?: string | null;
}

export function useSaveNote(patientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: NoteInput }) =>
      id
        ? api<NoteDto>(`${P(patientId!)}/notes/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: input,
          })
        : api<NoteDto>(`${P(patientId!)}/notes`, { method: 'POST', body: input }),
    onSuccess: () => invalidatePatientData(qc),
  });
}

export function useDeleteNote(patientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`${P(patientId!)}/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => invalidatePatientData(qc),
  });
}

export function invalidatePatientData(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['notes', 'day', 'readings', 'report', 'current'])
    void qc.invalidateQueries({ queryKey: [key] });
}

export { P as patientPath };
