import { useTranslation } from 'react-i18next';
import dayjs from '../lib/dayjs';
import { fmtNumber, fmtPercent } from '../lib/format';
import { useSensors } from '../lib/queries';
import { usePatient } from '../hooks/usePatient';
import { Card, Empty, ErrorBox, Loading, PageTitle } from '../components/ui';
import { PatientSelector } from '../components/PatientSelector';

export function SensorsPage() {
  const { t, i18n } = useTranslation();
  const { patient } = usePatient();
  const sensors = useSensors(patient?.id);
  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  const d = (s: string | null) =>
    s ? dayjs(s).tz(patient.timezone).format('DD.MM.YYYY HH:mm') : '–';
  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{t('nav.sensors')}</PageTitle>
      {sensors.isLoading && <Loading />}
      {sensors.error && <ErrorBox error={sensors.error} />}
      <Card>
        {sensors.data?.length === 0 && <Empty>{t('sensor.none')}</Empty>}
        {!!sensors.data?.length && (
          <div className="overflow-x-auto">
            <table className="table num">
              <thead>
                <tr>
                  <th>{t('sensor.serial')}</th>
                  <th>{t('sensor.started')}</th>
                  <th>{t('sensor.expectedEnd')}</th>
                  <th>{t('sensor.ended')}</th>
                  <th>{t('sensor.usedDays')}</th>
                  <th>{t('reports.sufficiency')}</th>
                  <th>{t('sensor.status')}</th>
                </tr>
              </thead>
              <tbody>
                {sensors.data.map((s) => (
                  <tr key={s.id}>
                    <td>{s.serial}</td>
                    <td>{d(s.activatedAt)}</td>
                    <td>{d(s.expectedEnd)}</td>
                    <td>{d(s.endedAt)}</td>
                    <td>{fmtNumber(s.usedDays, 1, i18n.language)}</td>
                    <td>{fmtPercent(s.sufficiencyPercent, i18n.language)}</td>
                    <td>
                      {s.active && <span className="text-ok">● {t('sensor.active')}</span>}
                      {s.endedEarly && (
                        <span className="font-semibold text-very-high">
                          ⚠ {t('sensor.endedEarly')}
                        </span>
                      )}
                      {!s.active && !s.endedEarly && (
                        <span className="text-muted">{t('sensor.completed')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
