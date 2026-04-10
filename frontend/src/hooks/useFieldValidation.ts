import { useCallback, useState } from 'react';
import type { ZodType } from 'zod';

interface FieldState<T> {
  value: T;
  error: string | null;
  isValid: boolean;
  isDirty: boolean;
}

export function useFieldValidation<T>(
  initialValue: T,
  schema: ZodType<T>,
): {
  value: T;
  error: string | null;
  isValid: boolean;
  isDirty: boolean;
  onChange: (next: T) => void;
  reset: () => void;
} {
  const [state, setState] = useState<FieldState<T>>({
    value: initialValue,
    error: null,
    isValid: false,
    isDirty: false,
  });

  const onChange = useCallback(
    (next: T) => {
      const parsed = schema.safeParse(next);
      setState({
        value: next,
        error: parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid'),
        isValid: parsed.success,
        isDirty: true,
      });
    },
    [schema],
  );

  const reset = useCallback(() => {
    setState({ value: initialValue, error: null, isValid: false, isDirty: false });
  }, [initialValue]);

  return { ...state, onChange, reset };
}
