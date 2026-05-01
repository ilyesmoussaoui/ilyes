import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { AlertIcon } from '../../../components/ui/Icon';

interface UnsavedChangesModalProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesModal({
  open,
  onStay,
  onDiscard,
}: UnsavedChangesModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onStay}
      title={t('common.messages.unsavedChanges')}
      size="sm"
      closeOnOverlay={false}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-fg">
            <AlertIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {t('members.edit.unsavedChanges.title')}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {t('common.messages.unsavedChangesWarning')} {t('common.messages.actionIrreversible')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onStay}>
            {t('members.edit.unsavedChanges.keepEditing')}
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            {t('members.edit.unsavedChanges.discard')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
