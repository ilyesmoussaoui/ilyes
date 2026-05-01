import { useContext } from 'react';
import { WizardContext, type WizardContextValue } from './WizardContext';

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizard must be used inside <WizardProvider>');
  }
  return ctx;
}
