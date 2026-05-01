import { useState } from 'react';
import { Skeleton } from '../../../components/ui';
import { InboxIcon } from '../../../components/ui/Icon';
import type { PresentRecord } from '../attendanceApi';
import { MemberTile } from './MemberTile';
import { CheckActionModal } from './CheckActionModal';

interface PresenceGridProps {
  records: PresentRecord[];
  loading: boolean;
  error: boolean;
  onCheckout: (recordId: string) => void;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-3 shadow-elevation-1"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" width="40px" height="40px" />
            <div className="flex-1">
              <Skeleton variant="text" width="70%" />
              <div className="mt-1">
                <Skeleton variant="text" width="40%" />
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between">
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="20%" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyGrid() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/60 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <InboxIcon size={28} />
      </div>
      <p className="text-sm font-semibold text-neutral-700">Aucun membre présent</p>
      <p className="text-xs text-neutral-500">
        Les membres apparaîtront ici une fois enregistrés.
      </p>
    </div>
  );
}

export function PresenceGrid({ records, loading, error, onCheckout }: PresenceGridProps) {
  const [selectedRecord, setSelectedRecord] = useState<PresentRecord | null>(null);

  if (loading) return <GridSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger-bg px-4 py-8 text-center text-sm text-danger-fg">
        Échec du chargement des membres présents. Les données seront actualisées automatiquement.
      </div>
    );
  }

  if (records.length === 0) return <EmptyGrid />;

  return (
    <>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="group"
        aria-label="Membres actuellement présents"
      >
        {records.map((record) => (
          <MemberTile
            key={record.id}
            record={record}
            onSelect={setSelectedRecord}
          />
        ))}
      </div>

      {/* Tile click → Arrivée / Départ confirmation modal */}
      <CheckActionModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onCheckout={onCheckout}
      />
    </>
  );
}
