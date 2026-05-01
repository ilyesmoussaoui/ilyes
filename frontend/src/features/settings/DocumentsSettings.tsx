import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { Icon } from '../../components/ui';
import { CheckIcon } from '../../components/ui/Icon';
import {
  fetchDocumentRequirements,
  updateDocumentRequirements,
  type DocumentRequirement,
} from './settingsApi';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';

const MEMBER_TYPES = ['athlete', 'staff', 'external'] as const;

export function DocumentsSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocumentRequirements();
      setRequirements(data.requirements);
      setDirty(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load document settings';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRequired = (id: string) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isRequired: !r.isRequired } : r)),
    );
    setDirty(true);
  };

  const toggleMemberType = (id: string, memberType: string) => {
    setRequirements((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const types = r.memberTypes.includes(memberType)
          ? r.memberTypes.filter((t) => t !== memberType)
          : [...r.memberTypes, memberType];
        return { ...r, memberTypes: types };
      }),
    );
    setDirty(true);
  };

  const updateValidity = (id: string, months: string) => {
    const value = months === '' ? null : parseInt(months, 10);
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, validityMonths: value } : r)),
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateDocumentRequirements(requirements);
      setRequirements(data.requirements);
      setDirty(false);
      toast.show({
        type: 'success',
        title: 'Documents settings saved',
        description: 'Changes will apply to new member registrations.',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save';
      toast.show({ type: 'error', title: 'Save failed', description: message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" lines={1} width="200px" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">Failed to load document settings</p>
          <p className="text-xs text-neutral-500">{error}</p>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (requirements.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Icon name="file-text" size={28} className="text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-800">No document types configured</p>
          <p className="text-xs text-neutral-500">
            Document types are managed from the backend database.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Document Requirements</h2>
          <p className="text-sm text-neutral-600">
            Configure which documents are required during member registration.
          </p>
        </div>
        {dirty && (
          <span className="text-xs font-medium text-warning-fg">Unsaved changes</span>
        )}
      </div>

      {/* Document List */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Document Type
              </th>
              <th className="border-b border-neutral-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Required
              </th>
              {MEMBER_TYPES.map((type) => (
                <th
                  key={type}
                  className="border-b border-neutral-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </th>
              ))}
              <th className="border-b border-neutral-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Validity (months)
              </th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((req, index) => (
              <tr
                key={req.id}
                className={cn(
                  'border-b border-neutral-100',
                  index % 2 === 1 && 'bg-neutral-50/40',
                )}
              >
                <td className="px-4 py-3 font-medium text-neutral-800">{req.documentType}</td>
                <td className="px-3 py-3 text-center">
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={req.isRequired}
                      onChange={() => toggleRequired(req.id)}
                      className="sr-only"
                      aria-label={`${req.documentType} required`}
                    />
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                        req.isRequired
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-neutral-300 bg-white hover:border-neutral-400',
                      )}
                    >
                      {req.isRequired && <CheckIcon size={12} />}
                    </span>
                  </label>
                </td>
                {MEMBER_TYPES.map((type) => {
                  const checked = req.memberTypes.includes(type);
                  return (
                    <td key={type} className="px-3 py-3 text-center">
                      <label className="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMemberType(req.id, type)}
                          className="sr-only"
                          aria-label={`${req.documentType} applicable to ${type}`}
                        />
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                            checked
                              ? 'border-primary-500 bg-primary-500 text-white'
                              : 'border-neutral-300 bg-white hover:border-neutral-400',
                          )}
                        >
                          {checked && <CheckIcon size={12} />}
                        </span>
                      </label>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center">
                  <input
                    type="number"
                    min="0"
                    value={req.validityMonths ?? ''}
                    onChange={(e) => updateValidity(req.id, e.target.value)}
                    placeholder="--"
                    aria-label={`${req.documentType} validity period in months`}
                    className="h-8 w-20 rounded-md border border-neutral-300 bg-white px-2 text-center text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
