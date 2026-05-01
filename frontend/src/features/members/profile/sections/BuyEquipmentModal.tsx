import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input } from '../../../../components/ui';
import { useToast } from '../../../../components/ui';
import {
  CreditCardIcon,
  SpinnerIcon,
  AlertIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PackageIcon,
} from '../../../../components/ui/Icon';
import { getPosProducts, posCheckout } from '../../../pos/posApi';
import type { PosProduct } from '../../../pos/posApi';
import { formatDZD, parseDZDInput } from '../../../payments/utils';

type PaymentOption = 'full' | 'partial' | 'later';

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

interface BuyEquipmentModalProps {
  open: boolean;
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function BuyEquipmentModal({
  open,
  memberId,
  memberName,
  onClose,
  onSuccess,
}: BuyEquipmentModalProps) {
  const toast = useToast();

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('full');
  const [partialInput, setPartialInput] = useState('');
  const [partialError, setPartialError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCart([]);
    setPaymentOption('full');
    setPartialInput('');
    setPartialError(null);
    setSubmitError(null);
    setSearch('');

    let cancelled = false;
    setLoadingProducts(true);
    setProductsError(null);
    getPosProducts()
      .then((res) => {
        if (cancelled) return;
        setProducts(res.products.filter((p) => p.category === 'equipment'));
      })
      .catch((err) => {
        if (cancelled) return;
        setProductsError(
          err instanceof Error ? err.message : 'Failed to load equipment',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const addToCart = (product: PosProduct) => {
    if (!product.inStock) return;
    const maxStock = product.stockQuantity ?? 0;
    if (maxStock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= maxStock) return prev;
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          maxStock,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? {
                ...l,
                quantity: Math.max(0, Math.min(l.maxStock, l.quantity + delta)),
              }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const paidAmount = useMemo(() => {
    if (paymentOption === 'full') return cartTotal;
    if (paymentOption === 'later') return 0;
    return parseDZDInput(partialInput);
  }, [paymentOption, partialInput, cartTotal]);

  const remaining = cartTotal - paidAmount;

  const validatePartial = (value: string): boolean => {
    const amount = parseDZDInput(value);
    if (amount <= 0) {
      setPartialError('Amount must be greater than 0');
      return false;
    }
    if (amount >= cartTotal) {
      setPartialError('Partial amount must be less than total');
      return false;
    }
    setPartialError(null);
    return true;
  };

  const handlePartialChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setPartialInput(cleaned);
    if (cleaned) validatePartial(cleaned);
    else setPartialError(null);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentOption === 'partial' && !validatePartial(partialInput)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await posCheckout({
        memberId,
        items: cart.map((l) => ({
          productId: l.productId,
          description: l.name,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          type: 'equipment',
        })),
        paymentType: paymentOption,
        paidAmount,
      });
      toast.show({
        type: 'success',
        title: 'Equipment purchase recorded',
        description: `Receipt ${result.receiptNumber} · ${formatDZD(result.totalAmount)}`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not record purchase.';
      setSubmitError(message);
      toast.show({
        type: 'error',
        title: 'Purchase failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    cart.length > 0 &&
    !(paymentOption === 'partial' &&
      (parseDZDInput(partialInput) <= 0 || parseDZDInput(partialInput) >= cartTotal));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buy Equipment"
      description={`Record equipment purchase for ${memberName}`}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Product catalog */}
        <div className="flex min-h-[400px] flex-col gap-3">
          <Input
            label="Search equipment"
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loadingProducts && (
            <div className="flex items-center justify-center gap-2 py-8 text-neutral-500">
              <SpinnerIcon size={16} />
              <span className="text-sm">Loading equipment…</span>
            </div>
          )}

          {productsError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="shrink-0 mt-0.5" />
              <span>{productsError}</span>
            </div>
          )}

          {!loadingProducts && !productsError && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-neutral-500">
              <PackageIcon size={28} className="text-neutral-300" />
              <p className="text-sm">
                {search ? 'No equipment matches your search' : 'No equipment available'}
              </p>
            </div>
          )}

          {!loadingProducts && !productsError && filteredProducts.length > 0 && (
            <ul className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const stock = p.stockQuantity ?? 0;
                const inCart = cart.find((l) => l.productId === p.id);
                const atLimit = inCart ? inCart.quantity >= stock : false;
                const disabled = !p.inStock || stock === 0 || atLimit;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => addToCart(p)}
                      className={`group flex w-full items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-left transition-all hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:bg-white`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 group-hover:bg-primary-100 group-hover:text-primary-700">
                        <PackageIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatDZD(p.price)} · Stock: {stock}
                          {atLimit && ' · Max reached'}
                        </p>
                      </div>
                      <PlusIcon
                        size={14}
                        className="text-neutral-400 group-hover:text-primary-600"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: Cart + Payment */}
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-700">Cart</h3>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-neutral-500">
              <PackageIcon size={28} className="text-neutral-300" />
              <p className="text-xs">Select equipment from the list</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((l) => (
                <li
                  key={l.productId}
                  className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {l.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDZD(l.unitPrice)} × {l.quantity} ={' '}
                      {formatDZD(l.unitPrice * l.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(l.productId, -1)}
                      className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      aria-label={`Decrease quantity of ${l.name}`}
                    >
                      <MinusIcon size={13} />
                    </button>
                    <span className="w-5 text-center text-xs font-medium">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={l.quantity >= l.maxStock}
                      onClick={() => updateQty(l.productId, 1)}
                      className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Increase quantity of ${l.name}`}
                    >
                      <PlusIcon size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(l.productId)}
                      className="ml-1 rounded-md p-1 text-neutral-400 hover:bg-danger-bg hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                      aria-label={`Remove ${l.name}`}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Totals */}
          {cart.length > 0 && (
            <div className="space-y-1 border-t border-neutral-200 pt-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Total</span>
                <span className="font-semibold text-neutral-900">
                  {formatDZD(cartTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Payment option */}
          {cart.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-neutral-700">
                Payment
              </legend>
              <div className="flex flex-col gap-1.5">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={paymentOption === opt.value}
                    onClick={() => {
                      setPaymentOption(opt.value);
                      setPartialError(null);
                    }}
                    className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      paymentOption === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        paymentOption === opt.value
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-neutral-300'
                      }`}
                    >
                      {paymentOption === opt.value && (
                        <CheckIcon size={10} className="text-white" />
                      )}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Partial amount input */}
          {cart.length > 0 && paymentOption === 'partial' && (
            <Input
              label="Amount to pay (DZD)"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1500"
              value={partialInput}
              onChange={(e) => handlePartialChange(e.target.value)}
              error={partialError}
              helperText={
                partialInput && !partialError
                  ? `Remaining: ${formatDZD(cartTotal - parseDZDInput(partialInput))}`
                  : undefined
              }
            />
          )}

          {cart.length > 0 && remaining > 0 && paymentOption !== 'partial' && (
            <div className="rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              Remaining after this payment: {formatDZD(remaining)}
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
            <Button
              variant="primary"
              iconLeft={
                submitting ? <SpinnerIcon size={16} /> : <CreditCardIcon size={16} />
              }
              onClick={() => void handleCheckout()}
              disabled={!canSubmit}
              loading={submitting}
            >
              Record Purchase
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const PAYMENT_OPTIONS: { value: PaymentOption; label: string }[] = [
  { value: 'full', label: 'Pay in full' },
  { value: 'partial', label: 'Partial payment' },
  { value: 'later', label: 'Pay later' },
];
