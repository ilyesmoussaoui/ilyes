import { useState, useCallback, useRef } from 'react';

// Deep equality check — handles plain objects and arrays containing primitives, dates as strings, etc.
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}

export interface UseEditFormOptions<T> {
  initialData: T;
  onSave: (data: T) => Promise<void>;
  validate?: (data: T) => Record<string, string>;
}

export interface UseEditFormReturn<T> {
  formData: T;
  setField: <K extends keyof T>(field: K, value: T[K]) => void;
  setFormData: (data: T) => void;
  errors: Record<string, string>;
  isDirty: boolean;
  isValid: boolean;
  isSaving: boolean;
  saveError: string | null;
  save: () => Promise<boolean>;
  cancel: () => void;
  reset: (newInitialData: T) => void;
}

export function useEditForm<T>({
  initialData,
  onSave,
  validate,
}: UseEditFormOptions<T>): UseEditFormReturn<T> {
  const baselineRef = useRef<T>(initialData);
  const [formData, setFormDataState] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Update baseline when initialData prop changes (on first mount / after profile refresh)
  const lastInitialRef = useRef<T>(initialData);
  if (!deepEqual(lastInitialRef.current, initialData)) {
    lastInitialRef.current = initialData;
    baselineRef.current = initialData;
  }

  const isDirty = !deepEqual(formData, baselineRef.current);

  const runValidation = useCallback(
    (data: T): Record<string, string> => {
      if (!validate) return {};
      return validate(data);
    },
    [validate],
  );

  const currentErrors = runValidation(formData);
  const isValid = Object.keys(currentErrors).length === 0;

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormDataState((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
    setSaveError(null);
  }, []);

  const setFormData = useCallback((data: T) => {
    setFormDataState(data);
    setSaveError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const errs = runValidation(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return false;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      baselineRef.current = formData;
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setSaveError(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSave, runValidation]);

  const cancel = useCallback(() => {
    setFormDataState(baselineRef.current);
    setErrors({});
    setSaveError(null);
  }, []);

  const reset = useCallback((newInitialData: T) => {
    baselineRef.current = newInitialData;
    lastInitialRef.current = newInitialData;
    setFormDataState(newInitialData);
    setErrors({});
    setSaveError(null);
  }, []);

  return {
    formData,
    setField,
    setFormData,
    errors: Object.keys(errors).length > 0 ? errors : currentErrors,
    isDirty,
    isValid,
    isSaving,
    saveError,
    save,
    cancel,
    reset,
  };
}
