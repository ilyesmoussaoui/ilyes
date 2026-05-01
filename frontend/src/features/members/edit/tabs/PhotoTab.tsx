import { useState } from 'react';
import { Button, Card } from '../../../../components/ui';
import { Camera } from '../../../../components/ui/Camera';
import { CameraIcon, SpinnerIcon, AlertIcon } from '../../../../components/ui/Icon';
import { replaceMemberPhoto } from '../editApi';
import type { MemberProfile } from '../../profile/profileTypes';
import { useToast } from '../../../../components/ui/Toast';

interface PhotoTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

function getInitials(profile: MemberProfile): string {
  const first = profile.firstNameLatin ?? profile.firstNameArabic ?? '';
  const last = profile.lastNameLatin ?? profile.lastNameArabic ?? '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
}

type PhotoTabState = 'view' | 'camera' | 'confirm';

export function PhotoTab({ profile, onSaved }: PhotoTabProps) {
  const [tabState, setTabState] = useState<PhotoTabState>('view');
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const currentPhotoUrl = profile.photoPath
    ? `/api/v1/files/photos/${profile.photoPath}`
    : null;

  const handleCapture = (blob: Blob) => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    const url = URL.createObjectURL(blob);
    setPendingBlob(blob);
    setPendingPreviewUrl(url);
    setTabState('confirm');
  };

  const handleConfirm = async () => {
    if (!pendingBlob) return;
    setUploading(true);
    setError(null);
    try {
      await replaceMemberPhoto(profile.id, pendingBlob);
      showToast({ type: 'success', title: 'Photo updated' });
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingBlob(null);
      setPendingPreviewUrl(null);
      setTabState('view');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCancelConfirm = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingBlob(null);
    setPendingPreviewUrl(null);
    setTabState('view');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-neutral-900">
              Member Photo
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Photo is used for identification and printed on member cards.
            </p>
          </div>

          {/* Current / preview photo */}
          {tabState === 'view' && (
            <div className="flex flex-col items-center gap-4">
              {currentPhotoUrl ? (
                <img
                  src={currentPhotoUrl}
                  alt="Current member photo"
                  className="h-48 w-48 rounded-full border-4 border-white object-cover shadow-elevation-2"
                />
              ) : (
                <div
                  aria-label="No photo — showing initials"
                  className="flex h-48 w-48 items-center justify-center rounded-full border-4 border-white bg-neutral-200 text-4xl font-bold text-neutral-500 shadow-elevation-2"
                >
                  {getInitials(profile)}
                </div>
              )}
              <Button
                variant="secondary"
                iconLeft={<CameraIcon size={15} />}
                onClick={() => setTabState('camera')}
              >
                Replace Photo
              </Button>
            </div>
          )}

          {/* Camera capture flow */}
          {tabState === 'camera' && (
            <div className="w-full max-w-sm">
              <Camera
                onSave={handleCapture}
                onCancel={() => setTabState('view')}
                aspect={1}
                minOutput={200}
              />
            </div>
          )}

          {/* Confirm new photo */}
          {tabState === 'confirm' && pendingPreviewUrl && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <img
                  src={pendingPreviewUrl}
                  alt="New photo preview"
                  className="h-48 w-48 rounded-full border-4 border-primary-200 object-cover shadow-elevation-2"
                />
                <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-primary-500 px-2 py-0.5 text-xs font-semibold text-white">
                  New
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg"
                >
                  <AlertIcon size={14} />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleCancelConfirm}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleConfirm()}
                  loading={uploading}
                  iconLeft={uploading ? <SpinnerIcon size={14} /> : undefined}
                >
                  Confirm &amp; Upload
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
