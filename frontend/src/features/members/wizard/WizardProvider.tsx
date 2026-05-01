import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_WIZARD_STATE,
  getVisibleSteps,
  type StepKey,
  type WizardState,
} from './wizardTypes';
import { WizardContext, type WizardContextValue, type WizardValidator } from './WizardContext';
import { loadWizardState, saveWizardState } from '../helpers/storage';

interface WizardProviderProps {
  children: ReactNode;
}

export function WizardProvider({ children }: WizardProviderProps) {
  const [state, setStateInternal] = useState<WizardState>(() => {
    const persisted = loadWizardState();
    return { ...EMPTY_WIZARD_STATE, ...(persisted ?? {}) } as WizardState;
  });

  const validators = useRef<Map<StepKey, WizardValidator>>(new Map());
  const advanceHandlers = useRef<Map<StepKey, () => Promise<boolean>>>(new Map());
  const saveTimer = useRef<number | null>(null);
  const [canAdvance, setCanAdvance] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const visibleSteps = useMemo(() => getVisibleSteps(state.type), [state.type]);
  const totalSteps = visibleSteps.length;
  const currentStepIndex = Math.min(Math.max(state.step - 1, 0), totalSteps - 1);
  const currentStepKey = visibleSteps[currentStepIndex] ?? 'classification';
  const [completedSteps, setCompletedSteps] = useState<number[]>(() => {
    const arr: number[] = [];
    for (let i = 1; i < state.step; i += 1) arr.push(i);
    return arr;
  });

  useEffect(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      saveWizardState(state);
    }, 300);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  const setState = useCallback((producer: (prev: WizardState) => WizardState) => {
    setStateInternal((prev) => producer(prev));
  }, []);

  const update = useCallback((patch: Partial<WizardState>) => {
    setStateInternal((prev) => ({ ...prev, ...patch }));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      const next = Math.min(Math.max(step, 1), totalSteps);
      setStateInternal((prev) => ({ ...prev, step: next }));
      setAdvanceError(null);
    },
    [totalSteps],
  );

  const registerValidator = useCallback((stepKey: StepKey, validator: WizardValidator) => {
    validators.current.set(stepKey, validator);
    return () => {
      validators.current.delete(stepKey);
    };
  }, []);

  const registerAdvanceHandler = useCallback(
    (stepKey: StepKey, handler: () => Promise<boolean>) => {
      advanceHandlers.current.set(stepKey, handler);
      return () => {
        advanceHandlers.current.delete(stepKey);
      };
    },
    [],
  );

  const notifyStepEvaluation = useCallback((_stepKey: StepKey, ok: boolean) => {
    setCanAdvance(ok);
  }, []);

  const goNext = useCallback(async () => {
    const validator = validators.current.get(currentStepKey);
    const validation = validator ? validator() : { ok: true, errors: {} };
    if (!validation.ok) {
      setCanAdvance(false);
      if (validation.firstInvalidFieldId) {
        const el = document.getElementById(validation.firstInvalidFieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el instanceof HTMLElement && typeof el.focus === 'function') {
            el.focus({ preventScroll: true });
          }
        }
      }
      return;
    }

    const advance = advanceHandlers.current.get(currentStepKey);
    if (advance) {
      setIsAdvancing(true);
      setAdvanceError(null);
      try {
        const ok = await advance();
        if (!ok) {
          setIsAdvancing(false);
          return;
        }
      } catch (err) {
        setIsAdvancing(false);
        setAdvanceError(err instanceof Error ? err.message : 'Unexpected error');
        return;
      }
      setIsAdvancing(false);
    }

    setCompletedSteps((prev) =>
      prev.includes(currentStepIndex + 1) ? prev : [...prev, currentStepIndex + 1],
    );
    setStateInternal((prev) => ({
      ...prev,
      step: Math.min(currentStepIndex + 2, totalSteps),
    }));
  }, [currentStepKey, currentStepIndex, totalSteps]);

  const goPrevious = useCallback(() => {
    setStateInternal((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
    setAdvanceError(null);
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      update,
      setState,
      visibleSteps,
      totalSteps,
      currentStepIndex,
      currentStepKey,
      completedSteps,
      goToStep,
      goNext,
      goPrevious,
      registerValidator,
      registerAdvanceHandler,
      canAdvance,
      notifyStepEvaluation,
      isAdvancing,
      advanceError,
      setAdvanceError,
    }),
    [
      state,
      update,
      setState,
      visibleSteps,
      totalSteps,
      currentStepIndex,
      currentStepKey,
      completedSteps,
      goToStep,
      goNext,
      goPrevious,
      registerValidator,
      registerAdvanceHandler,
      canAdvance,
      notifyStepEvaluation,
      isAdvancing,
      advanceError,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
