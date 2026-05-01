import { createContext } from 'react';
import type {
  StepKey,
  ValidationResult,
  WizardState,
} from './wizardTypes';

export type WizardValidator = () => ValidationResult;

export interface WizardContextValue {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  setState: (producer: (prev: WizardState) => WizardState) => void;
  visibleSteps: StepKey[];
  totalSteps: number;
  currentStepIndex: number;
  currentStepKey: StepKey;
  completedSteps: number[];
  goToStep: (step: number) => void;
  goNext: () => Promise<void> | void;
  goPrevious: () => void;
  registerValidator: (stepKey: StepKey, validator: WizardValidator) => () => void;
  registerAdvanceHandler: (
    stepKey: StepKey,
    handler: () => Promise<boolean>,
  ) => () => void;
  canAdvance: boolean;
  notifyStepEvaluation: (stepKey: StepKey, ok: boolean) => void;
  isAdvancing: boolean;
  advanceError: string | null;
  setAdvanceError: (err: string | null) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);
