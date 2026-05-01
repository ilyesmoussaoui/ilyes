import { useEffect } from 'react';
import { useWizard } from '../useWizard';
import type { StepKey } from '../wizardTypes';

interface StepPlaceholderProps {
  stepKey: StepKey;
  title: string;
}

export function StepPlaceholder({ stepKey, title }: StepPlaceholderProps) {
  const { registerValidator, notifyStepEvaluation } = useWizard();

  useEffect(() => {
    notifyStepEvaluation(stepKey, true);
  }, [stepKey, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator(stepKey, () => ({ ok: true, errors: {} }));
  }, [stepKey, registerValidator]);

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <div className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </div>
      <h2 className="text-lg font-semibold text-neutral-700">Coming in Part 4</h2>
      <p className="max-w-sm text-sm text-neutral-500">
        This step will be implemented in the next part of the build. You can continue
        through the wizard without filling anything in here.
      </p>
    </div>
  );
}
