import { useQuery } from '@tanstack/react-query';
import { fetchSettings, type ClubSettings } from '../../settings/settingsApi';
import { formatDZD, formatDateTime } from '../utils';

const CLUB_SETTINGS_QUERY_KEY = ['settings', 'club'] as const;

export interface ReceiptPrintableItem {
  description: string;
  amount: number; // centimes
  quantity?: number;
  unitPrice?: number;
}

export interface ReceiptPrintableProps {
  receiptNumber: string;
  createdAt: string;
  memberName: string;
  items: ReceiptPrintableItem[];
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  notes?: string | null;
  /** Top-right pill: "Paid" / "Partial" / "Later" / "Refund". Omit to hide. */
  statusLabel?: string;
  /**
   * Used when receipt is *not* inside a Modal — controls whether the element
   * is visible on screen. Always participates in print via .receipt-printable.
   */
  hiddenOnScreen?: boolean;
}

export function ReceiptPrintable({
  receiptNumber,
  createdAt,
  memberName,
  items,
  totalAmount,
  paidAmount,
  remaining,
  notes,
  statusLabel,
  hiddenOnScreen = false,
}: ReceiptPrintableProps) {
  const { data } = useQuery({
    queryKey: CLUB_SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const club: ClubSettings | undefined = data?.settings;
  const clubName = club?.club_name?.trim() || 'Club Receipt';
  const clubAddress = [club?.club_address, club?.club_city].filter(Boolean).join(', ');
  const contactLine = [club?.club_phone, club?.club_email].filter(Boolean).join(' · ');

  const className = hiddenOnScreen
    ? 'receipt-printable sr-only-print'
    : 'receipt-printable space-y-4';

  return (
    <div className={className}>
      {/* Club Header */}
      <div className="flex flex-col items-center gap-1 text-center">
        {club?.club_logo ? (
          <img
            src={club.club_logo}
            alt={`${clubName} logo`}
            className="mb-1 h-16 w-16 object-contain"
          />
        ) : null}
        <p className="text-lg font-bold uppercase tracking-wide text-neutral-900">
          {clubName}
        </p>
        {clubAddress ? (
          <p className="text-xs text-neutral-600">{clubAddress}</p>
        ) : null}
        {contactLine ? (
          <p className="text-xs text-neutral-600">{contactLine}</p>
        ) : null}
      </div>

      {club?.receipt_header?.trim() ? (
        <p className="whitespace-pre-line text-center text-xs text-neutral-700">
          {club.receipt_header}
        </p>
      ) : null}

      <hr className="border-neutral-200" />

      {/* Receipt meta */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Date</span>
          <span>{formatDateTime(createdAt)}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Receipt #</span>
          <span className="font-mono font-semibold">{receiptNumber}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Member</span>
          <span className="font-semibold text-neutral-900">{memberName}</span>
        </div>
        {statusLabel ? (
          <div className="flex justify-between text-neutral-600">
            <span>Status</span>
            <span className="font-semibold uppercase">{statusLabel}</span>
          </div>
        ) : null}
      </div>

      <hr className="border-neutral-200" />

      {/* Items Table */}
      <table className="w-full text-sm" aria-label="Receipt items">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="pb-2 font-medium">Description</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-neutral-100">
              <td className="py-2 text-neutral-700">
                {item.description}
                {item.quantity && item.quantity > 1 && item.unitPrice ? (
                  <span className="block text-xs text-neutral-500">
                    {item.quantity} × {formatDZD(item.unitPrice)}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-right text-neutral-700">
                {formatDZD(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal</span>
          <span>{formatDZD(totalAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-neutral-900">
          <span>Paid</span>
          <span>{formatDZD(paidAmount)}</span>
        </div>
        {remaining > 0 ? (
          <div className="flex justify-between font-semibold text-danger">
            <span>Remaining Balance</span>
            <span>{formatDZD(remaining)}</span>
          </div>
        ) : null}
      </div>

      {notes ? (
        <>
          <hr className="border-neutral-200" />
          <div>
            <p className="text-xs font-medium text-neutral-500">Notes</p>
            <p className="text-sm text-neutral-700">{notes}</p>
          </div>
        </>
      ) : null}

      {club?.receipt_footer?.trim() ? (
        <>
          <hr className="border-neutral-200" />
          <p className="whitespace-pre-line text-center text-xs text-neutral-700">
            {club.receipt_footer}
          </p>
        </>
      ) : null}

      <hr className="border-neutral-200" />
      <p className="text-center text-[10px] uppercase tracking-widest text-neutral-400">
        Thank you
      </p>
    </div>
  );
}
