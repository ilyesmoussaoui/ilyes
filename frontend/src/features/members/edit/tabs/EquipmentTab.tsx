import { Table } from '../../../../components/ui/Table';
import { Card } from '../../../../components/ui/Card';
import type { MemberProfile, EquipmentPurchase } from '../../profile/profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { formatMoney, formatDate } from '../../profile/profileUtils';

interface EquipmentTabProps {
  profile: MemberProfile;
}

export function EquipmentTab({ profile }: EquipmentTabProps) {
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
        <span className="font-medium">
          {formatMoney(row.unitPrice * row.quantity)}
        </span>
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
        <span className="font-mono text-xs text-neutral-600">
          {row.paymentReceiptNo ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="equipment-tab-heading">
      <h2 id="equipment-tab-heading" className="sr-only">
        Equipment
      </h2>

      {/* Read-only notice */}
      <div className="mb-4 rounded-md border border-info/20 bg-info-bg px-4 py-2.5">
        <p className="text-xs font-medium text-info-fg">
          Equipment purchases are financial records and cannot be edited or
          deleted.
        </p>
      </div>

      {profile.equipmentPurchases.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">
              No equipment purchases
            </p>
            <p className="text-xs text-neutral-500">
              This member has not purchased any equipment.
            </p>
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={profile.equipmentPurchases}
          getRowId={(row) => row.id}
          emptyTitle="No equipment purchases"
          emptyMessage="This member has not purchased any equipment."
        />
      )}
    </section>
  );
}
