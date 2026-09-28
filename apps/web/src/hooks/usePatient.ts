import { useNavigate, useSearch } from '@tanstack/react-router';
import type { PatientSummary } from '@glukoz/shared';
import { useSession } from './session';

/** Seçili hasta URL `patient` arama parametresinde tutulur; yoksa ilk hasta. */
export function usePatient(): {
  patient: PatientSummary | undefined;
  patients: PatientSummary[];
  setPatient: (id: string) => void;
} {
  const { patients } = useSession();
  const search = useSearch({ strict: false }) as { patient?: string };
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === search.patient) ?? patients[0];
  const setPatient = (id: string) =>
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, patient: id }),
    });
  return { patient, patients, setPatient };
}
