import { useEffect, useState } from 'react';
import { CameraIcon } from '../../../components/ui/Icon';

interface CameraPickerProps {
  deviceId: string | null;
  onChange: (deviceId: string | null) => void;
}

export function CameraPicker({ deviceId, onChange }: CameraPickerProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const refresh = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0 && cams.every((c) => c.label === '')) {
          setPermissionDenied(true);
        }
      } catch {
        /* ignore */
      }
    };

    void refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, []);

  if (devices.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 rounded-xl bg-neutral-800 px-3 py-2 text-xs text-neutral-300">
      <CameraIcon size={14} aria-hidden="true" />
      <span className="sr-only">Choisir la caméra</span>
      <select
        value={deviceId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-transparent text-xs text-neutral-200 focus:outline-none"
        aria-label="Choisir la caméra"
      >
        <option value="">Caméra par défaut</option>
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `Caméra ${i + 1}`}
          </option>
        ))}
      </select>
      {permissionDenied && (
        <span className="text-[10px] text-neutral-500">(autorisez la caméra pour voir les noms)</span>
      )}
    </label>
  );
}
