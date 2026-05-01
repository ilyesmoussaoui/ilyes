import type { WizardState } from '../wizard/wizardTypes';

export const WIZARD_STORAGE_KEY = 'memberWizard';

export function loadWizardState(): Partial<WizardState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardState>;
    if (parsed && typeof parsed === 'object') {
      if (parsed.photo) {
        parsed.photo = {
          blobUrl: null,
          uploaded: parsed.photo.uploaded ?? false,
          serverUrl: parsed.photo.serverUrl ?? null,
        };
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave: WizardState = {
      ...state,
      photo: {
        blobUrl: null,
        uploaded: state.photo.uploaded,
        serverUrl: state.photo.serverUrl,
      },
    };
    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* quota or serialization issue — ignore */
  }
}

export function clearWizardState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
