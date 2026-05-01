import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui';
import { ChevronRightIcon } from '../../components/ui/Icon';
import { WizardProvider } from './wizard/WizardProvider';
import { ProgressBar } from './wizard/ProgressBar';
import { StepNavigation } from './wizard/StepNavigation';
import { Step1Classification } from './wizard/steps/Step1Classification';
import { Step2Photo } from './wizard/steps/Step2Photo';
import { Step3Identity } from './wizard/steps/Step3Identity';
import { Step4Contact } from './wizard/steps/Step4Contact';
import { Step5Disciplines } from './wizard/steps/Step5Disciplines';
import { Step6Documents } from './wizard/steps/Step6Documents';
import { Step7Billing } from './wizard/steps/Step7Billing';
import { Step8Summary } from './wizard/steps/Step8Summary';
import { useWizard } from './wizard/useWizard';
import type { StepKey } from './wizard/wizardTypes';
import { clearWizardState } from './helpers/storage';

function StepRenderer() {
  const { currentStepKey } = useWizard();
  switch (currentStepKey) {
    case 'classification':
      return <Step1Classification />;
    case 'photo':
      return <Step2Photo />;
    case 'identity':
      return <Step3Identity />;
    case 'contact':
      return <Step4Contact />;
    case 'disciplines':
      return <Step5Disciplines />;
    case 'documents':
      return <Step6Documents />;
    case 'billing':
      return <Step7Billing />;
    case 'review':
      return <Step8Summary />;
    default:
      return null;
  }
}

function WizardChrome({ onDiscard }: { onDiscard: () => void }) {
  const { visibleSteps, currentStepIndex, completedSteps, goToStep } = useWizard();

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Add member</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Step {currentStepIndex + 1} of {visibleSteps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onDiscard}
          className="text-sm font-medium text-neutral-500 underline-offset-2 hover:text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          Discard draft
        </button>
      </div>
      <ProgressBar
        steps={visibleSteps as StepKey[]}
        currentIndex={currentStepIndex}
        completedSteps={completedSteps}
        onJump={goToStep}
      />
      <div className="mt-8">
        <StepRenderer />
      </div>
      <div className="mt-8">
        <StepNavigation />
      </div>
    </Card>
  );
}

export function AddMemberPage() {
  const navigate = useNavigate();

  const handleDiscard = () => {
    const ok = window.confirm(
      'Discard this draft? All unsaved changes will be lost.',
    );
    if (!ok) return;
    clearWizardState();
    navigate('/members');
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Home
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li>
            <Link
              to="/members"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Members
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">Add</li>
        </ol>
      </nav>
      <WizardProvider>
        <WizardChrome onDiscard={handleDiscard} />
      </WizardProvider>
    </div>
  );
}

export default AddMemberPage;
