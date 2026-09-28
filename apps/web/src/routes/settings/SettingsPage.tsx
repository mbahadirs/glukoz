import { useTranslation } from 'react-i18next';
import { useSession } from '../../hooks/session';
import { usePatient } from '../../hooks/usePatient';
import { PageTitle } from '../../components/ui';
import { PatientSelector } from '../../components/PatientSelector';
import { AccountCard, InstallCard, PreferencesCard } from './PreferencesCard';
import { PatientCard } from './PatientCard';
import { UsersAdmin } from './UsersAdmin';
import { LluAdmin } from './LluAdmin';
import { DeleteDataCard, ImportCard, SystemStatusCard } from './SystemAdmin';

export function SettingsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useSession();
  const { patient } = usePatient();
  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{t('nav.settings')}</PageTitle>
      <PreferencesCard />
      {patient && <PatientCard patient={patient} />}
      <InstallCard />
      <AccountCard />
      {isAdmin && (
        <>
          <h2 className="pt-4 text-lg font-bold">{t('admin.title')}</h2>
          <UsersAdmin />
          <LluAdmin />
          <SystemStatusCard />
          {patient && <ImportCard patient={patient} />}
          {patient && <DeleteDataCard patient={patient} />}
        </>
      )}
    </div>
  );
}
