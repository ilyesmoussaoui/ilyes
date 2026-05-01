import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';
import { useWizard } from './useWizard';

export function StepNavigation() {
  const { t } = useTranslation();
  const {
    currentStepIndex,
    totalSteps,
    goNext,
    goPrevious,
    canAdvance,
    isAdvancing,
    advanceError,
  } = useWizard();
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
      {advanceError && (
        <p role="alert" className="text-sm text-danger">
          {advanceError}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          {!isFirst && (
            <Button variant="secondary" onClick={goPrevious} disabled={isAdvancing}>
              {t('members.wizard.navigation.previous')}
            </Button>
          )}
        </div>
        <div>
          <Button
            variant="primary"
            onClick={() => {
              void goNext();
            }}
            disabled={!canAdvance || isAdvancing}
            loading={isAdvancing}
          >
            {isLast ? t('members.wizard.step8.confirm') : t('members.wizard.navigation.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
