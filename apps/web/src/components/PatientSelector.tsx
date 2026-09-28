import { useTranslation } from 'react-i18next';
import { usePatient } from '../hooks/usePatient';

export function PatientSelector() {
  const { t } = useTranslation();
  const { patient, patients, setPatient } = usePatient();
  if (patients.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t('patient.select')}</span>
      <select
        className="input w-auto"
        value={patient?.id}
        onChange={(e) => setPatient(e.target.value)}
      >
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
