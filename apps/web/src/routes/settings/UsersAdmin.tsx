import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES, type AdminUserDto, type Role } from '@glukoz/shared';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/session';
import { Card, ErrorBox, Loading } from '../../components/ui';

const KEY = ['admin-users'];
type Access = AdminUserDto['access'];

interface Draft {
  id?: string;
  email: string;
  displayName: string;
  role: Role;
  password: string;
  access: Access;
}

const EMPTY: Draft = { email: '', displayName: '', role: 'VIEWER', password: '', access: [] };

function AccessEditor({ value, onChange }: { value: Access; onChange: (a: Access) => void }) {
  const { t } = useTranslation();
  const { patients } = useSession();
  const get = (id: string) => value.find((a) => a.patientId === id);
  const toggle = (id: string, on: boolean) =>
    onChange(
      on ? [...value, { patientId: id, canEdit: false }] : value.filter((a) => a.patientId !== id),
    );
  const setEdit = (id: string, canEdit: boolean) =>
    onChange(value.map((a) => (a.patientId === id ? { ...a, canEdit } : a)));
  return (
    <fieldset className="sm:col-span-2">
      <legend className="label">{t('admin.access')}</legend>
      <ul className="space-y-1">
        {patients.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!get(p.id)}
                onChange={(e) => toggle(p.id, e.target.checked)}
              />
              {p.name}
            </label>
            {get(p.id) && (
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={get(p.id)?.canEdit ?? false}
                  onChange={(e) => setEdit(p.id, e.target.checked)}
                />
                {t('admin.canEdit')}
              </label>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function UserForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [d, setD] = useState(draft);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        displayName: d.displayName,
        role: d.role,
        access: d.access,
        ...(d.password ? { password: d.password } : {}),
      };
      return d.id
        ? api<AdminUserDto>(`/api/admin/users/${encodeURIComponent(d.id)}`, {
            method: 'PATCH',
            body,
          })
        : api<AdminUserDto>('/api/admin/users', {
            method: 'POST',
            body: { ...body, email: d.email, password: d.password },
          });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form
      onSubmit={submit}
      className="mt-3 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
    >
      <label>
        <span className="label">{t('auth.email')}</span>
        <input
          className="input"
          type="email"
          required
          disabled={!!d.id}
          value={d.email}
          onChange={(e) => setD({ ...d, email: e.target.value })}
        />
      </label>
      <label>
        <span className="label">{t('auth.displayName')}</span>
        <input
          className="input"
          required
          value={d.displayName}
          onChange={(e) => setD({ ...d, displayName: e.target.value })}
        />
      </label>
      <label>
        <span className="label">{t('admin.role')}</span>
        <select
          className="input"
          value={d.role}
          onChange={(e) => setD({ ...d, role: e.target.value as Role })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">{d.id ? t('admin.newPassword') : t('auth.password')}</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required={!d.id}
          value={d.password}
          onChange={(e) => setD({ ...d, password: e.target.value })}
        />
      </label>
      {d.role !== 'ADMIN' && (
        <AccessEditor value={d.access} onChange={(access) => setD({ ...d, access })} />
      )}
      {save.error && (
        <div className="sm:col-span-2">
          <ErrorBox error={save.error} />
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {t('common.save')}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

export function UsersAdmin() {
  const { t } = useTranslation();
  const { me } = useSession();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: KEY, queryFn: () => api<AdminUserDto[]>('/api/admin/users') });
  const [editing, setEditing] = useState<Draft | null>(null);
  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <Card
      title={t('admin.users')}
      actions={
        <button type="button" className="btn" onClick={() => setEditing(EMPTY)}>
          + {t('admin.addUser')}
        </button>
      }
    >
      {users.isLoading && <Loading />}
      {users.error && <ErrorBox error={users.error} />}
      {del.error && <ErrorBox error={del.error} />}
      <ul className="divide-y divide-border">
        {users.data?.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="font-semibold">{u.displayName}</span>
            <span className="text-muted">{u.email}</span>
            <span className="chip min-h-6 text-xs">{t(`roles.${u.role}`)}</span>
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="btn min-h-8 py-1"
                onClick={() => setEditing({ ...u, password: '' })}
              >
                {t('common.edit')}
              </button>
              {u.id !== me?.user.id && (
                <button
                  type="button"
                  className="btn-danger min-h-8 py-1"
                  onClick={() =>
                    window.confirm(t('admin.confirmDeleteUser', { name: u.displayName })) &&
                    del.mutate(u.id)
                  }
                >
                  {t('common.delete')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <UserForm key={editing.id ?? 'new'} draft={editing} onDone={() => setEditing(null)} />
      )}
    </Card>
  );
}
