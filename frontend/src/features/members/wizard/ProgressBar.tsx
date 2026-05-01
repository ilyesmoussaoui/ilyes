import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';
import { CheckIcon } from '../../../components/ui/Icon';
import { STEP_LABEL_KEYS, type StepKey } from './wizardTypes';

interface ProgressBarProps {
  steps: StepKey[];
  currentIndex: number;
  completedSteps: number[];
  onJump: (step: number) => void;
}

export function ProgressBar({ steps, currentIndex, completedSteps, onJump }: ProgressBarProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('members.wizard.progressAria')} className="w-full">
      <ol className="flex items-start justify-between gap-1 sm:gap-2">
        {steps.map((stepKey, index) => {
          const stepNumber = index + 1;
          const isCurrent = index === currentIndex;
          const isCompleted = completedSteps.includes(stepNumber) && !isCurrent;
          const isFuture = index > currentIndex && !isCompleted;
          const clickable = isCompleted;

          return (
            <li key={stepKey} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'h-[2px] flex-1',
                    index === 0 ? 'opacity-0' : isCompleted || isCurrent ? 'bg-primary-500' : 'bg-neutral-200',
                  )}
                />
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${t('members.wizard.stepOf', { current: stepNumber, total: steps.length })}: ${t(STEP_LABEL_KEYS[stepKey])}`}
                  onClick={() => {
                    if (clickable) onJump(stepNumber);
                  }}
                  className={cn(
                    'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                    isCurrent && 'border-primary-600 bg-primary-600 text-white shadow-elevation-1',
                    isCompleted && 'border-success bg-success text-white cursor-pointer hover:shadow-elevation-2',
                    isFuture && 'border-neutral-300 bg-white text-neutral-400 cursor-not-allowed',
                  )}
                >
                  {isCompleted ? <CheckIcon size={16} /> : <span>{stepNumber}</span>}
                </button>
                <div
                  className={cn(
                    'h-[2px] flex-1',
                    index === steps.length - 1
                      ? 'opacity-0'
                      : isCompleted
                        ? 'bg-primary-500'
                        : 'bg-neutral-200',
                  )}
                />
              </div>
              <span
                className={cn(
                  'mt-2 hidden text-center text-xs sm:block',
                  isCurrent && 'font-semibold text-primary-700',
                  isCompleted && 'text-neutral-700',
                  isFuture && 'text-neutral-400',
                )}
              >
                {t(STEP_LABEL_KEYS[stepKey])}
              </span>
              <span className="mt-2 text-center text-[10px] text-neutral-500 sm:hidden">
                {stepNumber}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
