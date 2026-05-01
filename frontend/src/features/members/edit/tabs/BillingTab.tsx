import { useState } from 'react';
import { Card, Button, Modal } from '../../../../components/ui';
import { Badge } from '../../../../components/ui/Badge';
import { AlertIcon, RefreshIcon } from '../../../../components/ui/Icon';
import type { MemberProfile, SubscriptionInfo } from '../../profile/profileTypes';
import { updateSubscription } from '../editApi';
import { useToast } from '../../../../components/ui/Toast';
import { formatMoney, formatDate } from '../../profile/profileUtils';

interface BillingTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

function statusToVariant(
  status: string,
): 'active' | 'expired' | 'pending' | 'inactive' {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'expired':
      return 'expired';
    case 'pending':
      return 'pending';
    default:
      return 'inactive';
  }
}

function SubscriptionCard({
  sub,
  memberId,
  onUpdated,
}: {
  sub: SubscriptionInfo;
  memberId: string;
  onUpdated: (updated: SubscriptionInfo) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const isExpired =
    sub.status.toLowerCase() === 'expired' ||
    (sub.endDate && new Date(sub.endDate) < new Date());

  const handleAutoRenewToggle = async () => {
    setToggling(true);
    setError(null);
    try {
      const res = await updateSubscription(memberId, sub.id, {
        autoRenew: !sub.autoRenew,
      });
      onUpdated({
        ...sub,
        autoRenew: res.subscription.autoRenew,
      });
      showToast({
        type: 'success',
        title: `Auto-renew ${!sub.autoRenew ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update auto-renew',
      );
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-lg border bg-white p-4 shadow-elevation-1 ${
          isExpired ? 'border-danger/30' : 'border-neutral-200'
        }`}
      >
        {isExpired && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2">
            <p className="text-xs font-medium text-danger-fg">
              Subscription expired
            </p>
            <Button
              variant="danger"
              size="default"
              iconLeft={<RefreshIcon size={13} />}
              onClick={() => setRenewModalOpen(true)}
            >
              Renew Now
            </Button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-neutral-900">
              {sub.planName}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-neutral-500">
              <span>Start: {formatDate(sub.startDate)}</span>
              {sub.endDate && (
                <span
                  className={
                    isExpired ? 'font-medium text-danger-fg' : ''
                  }
                >
                  End: {formatDate(sub.endDate)}
                </span>
              )}
              <span className="font-medium text-neutral-700">
                {formatMoney(sub.price)}
              </span>
            </div>
          </div>
          <Badge
            variant={statusToVariant(sub.status)}
            label={
              sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
            }
          />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-xs text-neutral-500">Auto-renew</span>
          <button
            type="button"
            onClick={() => void handleAutoRenewToggle()}
            disabled={toggling}
            aria-pressed={sub.autoRenew}
            aria-label={`Auto-renew: ${sub.autoRenew ? 'on' : 'off'}`}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
              sub.autoRenew ? 'bg-primary-500' : 'bg-neutral-300'
            } ${toggling ? 'opacity-60' : ''}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
                sub.autoRenew ? 'translate-x-[18px]' : ''
              }`}
            />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-2 flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
          >
            <AlertIcon size={12} />
            {error}
          </div>
        )}
      </div>

      {/* Renew modal */}
      <Modal
        open={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title="Renew Subscription"
        description={`Renew ${sub.planName}`}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center text-neutral-500">
          <p className="text-sm font-medium text-neutral-700">
            Subscription renewal coming in a future update.
          </p>
          <p className="text-xs text-neutral-400">
            Please use the payments module to process subscription renewals.
          </p>
          <Button variant="secondary" onClick={() => setRenewModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function BillingTab({ profile, onSaved }: BillingTabProps) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>(
    profile.subscriptions,
  );

  const handleUpdated = (updated: SubscriptionInfo) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
    onSaved();
  };

  const total = subscriptions.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">
              No subscriptions
            </p>
            <p className="text-xs text-neutral-500">
              This member has no active subscriptions.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                sub={sub}
                memberId={profile.id}
                onUpdated={handleUpdated}
              />
            ))}
          </div>

          {/* Price summary */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700">
                Total subscriptions
              </span>
              <span className="text-lg font-bold text-neutral-900">
                {formatMoney(total)}
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
