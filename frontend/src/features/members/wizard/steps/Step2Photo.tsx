import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Camera } from '../../../../components/ui';
import { useWizard } from '../useWizard';
import { uploadMemberPhoto } from '../../api/membersApi';

export function Step2Photo() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const [cameraOpen, setCameraOpen] = useState<boolean>(!state.photo.blobUrl);
  const pendingBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    notifyStepEvaluation('photo', true);
  }, [notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('photo', () => ({ ok: true, errors: {} }));
  }, [registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('photo', async () => {
      if (!pendingBlobRef.current || !state.memberId) {
        return true;
      }
      if (state.photo.uploaded) return true;
      const res = await uploadMemberPhoto(state.memberId, pendingBlobRef.current);
      update({
        photo: {
          blobUrl: state.photo.blobUrl,
          uploaded: true,
          serverUrl: res.photoUrl,
        },
      });
      return true;
    });
  }, [state.memberId, state.photo.uploaded, state.photo.blobUrl, update, registerAdvanceHandler]);

  const handleSave = useCallback(
    (blob: Blob) => {
      pendingBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      if (state.photo.blobUrl) URL.revokeObjectURL(state.photo.blobUrl);
      update({
        photo: {
          blobUrl: url,
          uploaded: false,
          serverUrl: null,
        },
      });
      setCameraOpen(false);
    },
    [state.photo.blobUrl, update],
  );

  const handleReplace = useCallback(() => {
    if (state.photo.blobUrl) URL.revokeObjectURL(state.photo.blobUrl);
    pendingBlobRef.current = null;
    update({
      photo: {
        blobUrl: null,
        uploaded: false,
        serverUrl: null,
      },
    });
    setCameraOpen(true);
  }, [state.photo.blobUrl, update]);

  const previewUrl = state.photo.blobUrl ?? state.photo.serverUrl ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Photo capture</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Center the face inside the oval. Bright, even lighting works best.
        </p>
      </header>

      {cameraOpen && !previewUrl && (
        <Camera onSave={handleSave} minOutput={200} aspect={1} />
      )}

      {previewUrl && !cameraOpen && (
        <div className="flex flex-col items-center gap-3">
          <img
            src={previewUrl}
            alt="Captured member"
            className="h-[200px] w-[200px] rounded-lg border border-neutral-200 object-cover"
          />
          <button
            type="button"
            onClick={handleReplace}
            className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          >
            Replace photo
          </button>
        </div>
      )}

      {!previewUrl && !cameraOpen && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setCameraOpen(true)}>
            Reopen camera
          </Button>
        </div>
      )}

      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => {
            pendingBlobRef.current = null;
            if (state.photo.blobUrl) URL.revokeObjectURL(state.photo.blobUrl);
            update({
              photo: { blobUrl: null, uploaded: false, serverUrl: null },
            });
            setCameraOpen(false);
          }}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
