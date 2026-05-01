import { useState } from 'react';
import { Card, Table, Button } from '../../../../components/ui';
import type { MemberProfile, EquipmentPurchase } from '../profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { formatMoney, formatDate, getDisplayName } from '../profileUtils';
import { ShoppingCartIcon, PackageIcon, CheckIcon } from '../../../../components/ui/Icon';
import { BuyEquipmentModal } from './BuyEquipmentModal';

interface EquipmentSectionProps {
  profile: MemberProfile;
  onRefresh?: () => void;
}

// Discipline-specific required equipment map
const REQUIRED_EQUIPMENT: Record<string, string[]> = {
  Taekwondo: ['Dobok (uniform)', 'Belt', 'Chest protector', 'Headgear', 'Shin guards', 'Gloves'],
  Karate: ['Karategi (uniform)', 'Belt', 'Mouth guard', 'Gloves'],
  Boxing: ['Boxing gloves', 'Hand wraps', 'Mouth guard', 'Headgear', 'Boxing shorts'],
  Judo: ['Judogi (uniform)', 'Belt'],
  Fitness: ['Training shoes', 'Training clothes'],
  Wrestling: ['Wrestling singlet', 'Wrestling shoes', 'Headgear'],
};

function getRequiredEquipment(disciplines: MemberProfile['disciplines']): string[] {
  const required = new Set<string>();
  for (const d of disciplines) {
    const items = REQUIRED_EQUIPMENT[d.disciplineName];
    if (items) {
      for (const item of items) required.add(item);
    }
  }
  return Array.from(required);
}

export function EquipmentSection({ profile, onRefresh }: EquipmentSectionProps) {
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const memberDisplayName = getDisplayName(profile);

  const requiredEquipment = getRequiredEquipment(profile.disciplines);
  const ownedNames = new Set(
    profile.equipmentPurchases.map((e) => e.equipmentName.toLowerCase()),
  );

  const columns: TableColumn<EquipmentPurchase>[] = [
    {
      key: 'equipmentName',
      header: 'Equipment',
      accessor: (row) => (
        <span className="font-medium text-neutral-900">{row.equipmentName}</span>
      ),
      sortable: true,
    },
    {
      key: 'quantity',
      header: 'Qty',
      accessor: (row) => row.quantity,
      align: 'center',
    },
    {
      key: 'unitPrice',
      header: 'Unit price',
      accessor: (row) => formatMoney(row.unitPrice),
      align: 'right',
      sortable: true,
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (row) => (
        <span className="font-medium">{formatMoney(row.unitPrice * row.quantity)}</span>
      ),
      align: 'right',
    },
    {
      key: 'purchaseDate',
      header: 'Purchase date',
      accessor: (row) => formatDate(row.purchaseDate),
      sortable: true,
    },
    {
      key: 'paymentReceiptNo',
      header: 'Receipt #',
      accessor: (row) => (
        <span className="font-mono text-xs text-neutral-600">{row.paymentReceiptNo ?? '—'}</span>
      ),
    },
  ];

  return (
    <section aria-labelledby="equipment-heading" className="flex flex-col gap-4">
      <h2 id="equipment-heading" className="sr-only">Equipment</h2>

      {/* Required vs owned comparison */}
      {requiredEquipment.length > 0 && (
        <Card
          title="Required equipment"
          action={
            <Button
              variant="secondary"
              size="default"
              iconLeft={<ShoppingCartIcon size={14} />}
              onClick={() => setBuyModalOpen(true)}
            >
              Buy Equipment
            </Button>
          }
        >
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {requiredEquipment.map((item) => {
              const isOwned = ownedNames.has(item.toLowerCase());
              return (
                <li
                  key={item}
                  className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                    isOwned
                      ? 'border-success/20 bg-success-bg text-success-fg'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <span className="shrink-0">
                    {isOwned ? (
                      <CheckIcon size={14} className="text-success-fg" />
                    ) : (
                      <PackageIcon size={14} className="text-neutral-400" />
                    )}
                  </span>
                  <span className={isOwned ? 'line-through opacity-60' : ''}>{item}</span>
                  {isOwned && (
                    <span className="ml-auto text-xs font-medium">Owned</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Purchase history */}
      <Card title="Purchase history">
        <Table
          columns={columns}
          data={profile.equipmentPurchases}
          getRowId={(row) => row.id}
          emptyTitle="No equipment purchases"
          emptyMessage="This member has not purchased any equipment."
        />
      </Card>

      {/* Buy modal */}
      <BuyEquipmentModal
        open={buyModalOpen}
        memberId={profile.id}
        memberName={memberDisplayName}
        onClose={() => setBuyModalOpen(false)}
        onSuccess={() => onRefresh?.()}
      />
    </section>
  );
}
