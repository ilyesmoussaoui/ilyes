import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Modal, Skeleton } from '../../components/ui';
import { useToast } from '../../components/ui';
import { Camera } from '../../components/ui/Camera';
import {
  ChevronRightIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  ShoppingCartIcon,
  XIcon,
  CheckIcon,
  UserIcon,
  InboxIcon,
  SpinnerIcon,
  CameraIcon,
  AlertIcon,
} from '../../components/ui/Icon';
import { formatDZD, parseDZDInput } from '../payments/utils';
import {
  faceSearch,
  getMemberBalance,
  getPosProducts,
  lookupBarcode,
  posCheckout,
  searchMembers,
} from './posApi';
import type { FaceMatch, MemberSearchResult, PosProduct } from './posApi';
import { ApiError } from '../../lib/api';
import { printReceipt } from '../../lib/print';
import { queuePosCheckout } from '../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../lib/offline-fallback';
import { ReceiptPrintable } from '../payments/components/ReceiptPrintable';
import { cn } from '../../lib/cn';

interface LastSaleSnapshot {
  receiptNumber: string;
  createdAt: string;
  memberName: string;
  items: { description: string; amount: number; quantity: number; unitPrice: number }[];
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  statusLabel: string;
}

/* ──────────────────── Cart Types ──────────────────── */

interface CartItem {
  id: string; // unique key in cart
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number | null; // null = unlimited (non-inventory items)
}

type CheckoutStep = 'cart' | 'payment';
type PaymentOption = 'full' | 'partial' | 'later';

/* ──────────────────── Component ──────────────────── */

export function PosPage() {
  const { t } = useTranslation();
  const toast = useToast();

  // Product catalog
  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery({
    queryKey: ['pos', 'products'],
    queryFn: getPosProducts,
  });
  const products = productsData?.products ?? [];

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('full');
  const [partialInput, setPartialInput] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Barcode input
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeLooking, setBarcodeLooking] = useState(false);

  // Member search
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const memberDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Member balance (centimes)
  const [memberBalance, setMemberBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Face-search modal
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceMatches, setFaceMatches] = useState<FaceMatch[] | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);

  const resetFaceSearch = useCallback(() => {
    setFaceMatches(null);
    setFaceError(null);
    setFaceUploading(false);
  }, []);

  const closeFaceModal = useCallback(() => {
    setFaceModalOpen(false);
    resetFaceSearch();
  }, [resetFaceSearch]);

  const handleFaceCapture = useCallback(async (blob: Blob) => {
    setFaceUploading(true);
    setFaceError(null);
    setFaceMatches(null);
    try {
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Image too large (max 5 MB).');
      }
      const data = await faceSearch(blob);
      setFaceMatches(data.matches);
    } catch (err: unknown) {
      if (err instanceof ApiError) setFaceError(err.message);
      else if (err instanceof Error) setFaceError(err.message);
      else setFaceError('Upload failed. Please try again.');
    } finally {
      setFaceUploading(false);
    }
  }, []);

  useEffect(() => {
    if (!faceModalOpen) return;
    resetFaceSearch();
  }, [faceModalOpen, resetFaceSearch]);

  // Last sale snapshot — rendered invisibly so printReceipt() has real content
  // to print on a thermal slip.
  const [lastSale, setLastSale] = useState<LastSaleSnapshot | null>(null);

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  /* ──────────────── Barcode Handling ──────────────── */

  const handleBarcodeSubmit = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setBarcodeLooking(true);
      try {
        const { product } = await lookupBarcode(code.trim());
        addProductToCart(product);
        setBarcodeValue('');
      } catch {
        toast.show({
          type: 'error',
          title: 'Product not found',
          description: `No product matches barcode "${code}".`,
        });
      } finally {
        setBarcodeLooking(false);
        barcodeRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleBarcodeSubmit(barcodeValue);
    }
  };

  /* ──────────────── Cart Actions ──────────────── */

  const addProductToCart = useCallback((product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        // Prevent exceeding available stock
        if (
          product.stockQuantity !== null &&
          existing.quantity >= product.stockQuantity
        ) {
          return prev; // do not exceed stock
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${product.id}`,
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          maxStock: product.stockQuantity,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== cartId) return item;
          const newQty = Math.max(0, item.quantity + delta);
          // Respect stock limits
          if (item.maxStock !== null && newQty > item.maxStock) return item;
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCheckoutStep('cart');
    setPaymentOption('full');
    setPartialInput('');
    setSelectedMember(null);
  }, []);

  /* ──────────────── Member Search ──────────────── */

  const handleMemberSearch = useCallback(
    (query: string) => {
      setMemberQuery(query);
      if (memberDebounceRef.current) clearTimeout(memberDebounceRef.current);
      if (query.trim().length < 2) {
        setMemberResults([]);
        return;
      }
      memberDebounceRef.current = setTimeout(async () => {
        setMemberSearching(true);
        try {
          const res = await searchMembers(query.trim());
          setMemberResults(res.members);
        } catch {
          setMemberResults([]);
        } finally {
          setMemberSearching(false);
        }
      }, 300);
    },
    [],
  );

  const selectMember = useCallback((member: MemberSearchResult) => {
    setSelectedMember(member);
    setMemberQuery('');
    setMemberResults([]);
    setFaceModalOpen(false);
  }, []);

  // Fetch outstanding balance whenever a member is selected
  useEffect(() => {
    if (!selectedMember) {
      setMemberBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    getMemberBalance(selectedMember.id)
      .then((res) => {
        if (!cancelled) setMemberBalance(res.balance);
      })
      .catch(() => {
        if (!cancelled) setMemberBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMember]);

  /* ──────────────── Checkout ──────────────── */

  const computePaid = (): number => {
    if (paymentOption === 'full') return cartTotal;
    if (paymentOption === 'later') return 0;
    return parseDZDInput(partialInput);
  };

  const handleCheckout = async () => {
    const paid = computePaid();
    if (paymentOption === 'partial') {
      if (paid <= 0 || paid >= cartTotal) {
        toast.show({
          type: 'warning',
          title: 'Invalid amount',
          description: 'Partial amount must be between 0 and the total.',
        });
        return;
      }
    }

    setCheckoutLoading(true);
    const payload = {
      memberId: selectedMember?.id ?? null,
      items: cart.map((item) => ({
        productId: item.productId,
        description: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      paymentType: (paymentOption === 'later' ? 'partial' : paymentOption) as
        | 'full'
        | 'partial',
      paidAmount: paid,
    };
    const memberLabel = selectedMember
      ? `${selectedMember.firstNameLatin} ${selectedMember.lastNameLatin}`
      : 'Walk-in';

    const buildSnapshot = (
      receiptNumber: string,
      totalAmount: number,
      paidAmount: number,
      remaining: number,
    ): LastSaleSnapshot => ({
      receiptNumber,
      createdAt: new Date().toISOString(),
      memberName: memberLabel,
      items: cart.map((item) => ({
        description: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.unitPrice * item.quantity,
      })),
      totalAmount,
      paidAmount,
      remaining,
      statusLabel:
        paymentOption === 'full'
          ? 'Paid'
          : paymentOption === 'partial'
            ? 'Partial'
            : 'Later',
    });

    const triggerPrint = () => {
      // Let React commit the .receipt-printable DOM before the print dialog reads it.
      requestAnimationFrame(() => printReceipt());
    };

    const queueOffline = async () => {
      await queuePosCheckout({ ...payload, memberLabel });
      toast.show({
        type: 'success',
        title: 'Saved offline',
        description: 'Sale queued — will sync when online. Receipt printed locally.',
      });
      setLastSale(buildSnapshot('PENDING-SYNC', cartTotal, paid, Math.max(0, cartTotal - paid)));
      triggerPrint();
      clearCart();
    };

    try {
      if (isOffline()) {
        await queueOffline();
        return;
      }
      const result = await posCheckout(payload);
      toast.show({
        type: 'success',
        title: 'Sale completed',
        description: `Receipt #${result.receiptNumber} created.`,
      });
      setLastSale(
        buildSnapshot(result.receiptNumber, result.totalAmount, result.paidAmount, result.remaining),
      );
      triggerPrint();
      clearCart();
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        try {
          await queueOffline();
          return;
        } catch {
          toast.show({
            type: 'error',
            title: 'Could not save offline',
            description: 'Local storage is unavailable. Try again.',
          });
        }
      } else {
        toast.show({
          type: 'error',
          title: 'Checkout failed',
          description: 'Could not complete sale. Please try again.',
        });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const paidAmount = computePaid();
  const remaining = cartTotal - paidAmount;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumb + Inventory link */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <nav aria-label={t('app.breadcrumb')}>
          <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
            <li>
              <Link
                to="/dashboard"
                className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {t('app.home')}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRightIcon size={12} />
            </li>
            <li className="font-semibold text-neutral-700">{t('pos.title')}</li>
          </ol>
        </nav>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <InboxIcon size={14} />
          {t('inventory.title')}
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ═══════ LEFT: Product Selection ═══════ */}
        <section className="w-full min-w-0 flex-1" aria-label="Product selection">
          {/* Barcode Scanner Input */}
          <Card padding="sm" className="mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  ref={barcodeRef}
                  label="Barcode / SKU"
                  placeholder={t('pos.searchProducts')}
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  iconLeft={
                    barcodeLooking ? (
                      <SpinnerIcon size={16} />
                    ) : (
                      <SearchIcon size={16} />
                    )
                  }
                />
              </div>
              <Button
                variant="primary"
                onClick={() => void handleBarcodeSubmit(barcodeValue)}
                disabled={!barcodeValue.trim() || barcodeLooking}
                className="mt-6"
              >
                {t('common.actions.add')}
              </Button>
            </div>
          </Card>

          {/* Quick-add Products */}
          <Card title={t('inventory.title')}>
            {productsLoading && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} variant="card" />
                ))}
              </div>
            )}

            {productsError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg"
              >
                {t('common.messages.somethingWrong')}
              </div>
            )}

            {!productsLoading && !productsError && products.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <InboxIcon size={28} />
                </div>
                <p className="text-sm font-semibold text-neutral-800">{t('common.empty.noItemsFound')}</p>
                <p className="text-xs text-neutral-500">{t('inventory.empty.addFirst')}</p>
              </div>
            )}

            {!productsLoading && !productsError && products.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToCart(product)}
                    disabled={!product.inStock}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      product.inStock
                        ? 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50 active:bg-primary-100'
                        : 'cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-50'
                    }`}
                    aria-label={`Add ${product.name} - ${formatDZD(product.price)}`}
                  >
                    <CategoryIcon category={product.category} />
                    <span className="mt-1 text-xs font-semibold text-neutral-800 line-clamp-2">
                      {product.name}
                    </span>
                    <span className="text-xs font-medium text-primary-600">
                      {formatDZD(product.price)}
                    </span>
                    {product.stockQuantity !== null && product.inStock && (
                      <span className={`text-[10px] font-medium ${
                        product.stockQuantity < 10
                          ? 'text-warning-fg'
                          : 'text-neutral-400'
                      }`}>
                        Stock: {product.stockQuantity}
                      </span>
                    )}
                    {!product.inStock && (
                      <span className="text-[10px] font-medium uppercase text-danger">
                        {t('inventory.badge.outOfStock')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ═══════ RIGHT: Cart + Checkout ═══════ */}
        <aside
          className="w-full shrink-0 lg:sticky lg:top-4 lg:w-96"
          aria-label="Shopping cart and checkout"
        >
          <Card>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                <ShoppingCartIcon size={18} />
                {t('pos.cart.title')}
                {cart.length > 0 && (
                  <span className="rounded-full bg-primary-500 px-2 py-0.5 text-xs font-bold text-white">
                    {cart.length}
                  </span>
                )}
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-medium text-neutral-500 transition-colors hover:text-danger"
                >
                  {t('pos.cart.clear')}
                </button>
              )}
            </div>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <ShoppingCartIcon size={32} className="text-neutral-300" />
                <p className="text-sm text-neutral-500">{t('pos.cart.empty')}</p>
                <p className="text-xs text-neutral-400">
                  {t('pos.cart.addProducts')}
                </p>
              </div>
            ) : (
              <div className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDZD(item.unitPrice)} each
                      </p>
                    </div>
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-neutral-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    {/* Line Total */}
                    <span className="w-20 text-right text-sm font-semibold text-neutral-900">
                      {formatDZD(item.unitPrice * item.quantity)}
                    </span>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {cart.length > 0 && (
              <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">Total</span>
                  <span className="text-lg font-bold text-neutral-900">
                    {formatDZD(cartTotal)}
                  </span>
                </div>

                {/* Member Identification */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Link to Member (optional)
                  </p>
                  {selectedMember ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
                        {selectedMember.photoUrl ? (
                          <img
                            src={selectedMember.photoUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-200 text-primary-700">
                            <UserIcon size={16} />
                          </div>
                        )}
                        <span className="flex-1 truncate text-sm font-medium text-primary-800">
                          {selectedMember.firstNameLatin} {selectedMember.lastNameLatin}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedMember(null)}
                          className="flex h-6 w-6 items-center justify-center rounded text-primary-500 transition-colors hover:bg-primary-100"
                          aria-label="Remove selected member"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                      {/* Balance badge */}
                      <div
                        className={cn(
                          'flex items-center justify-between rounded-md border px-3 py-1.5 text-xs',
                          balanceLoading
                            ? 'border-neutral-200 bg-neutral-50 text-neutral-500'
                            : memberBalance && memberBalance > 0
                              ? 'border-danger/20 bg-danger-bg text-danger-fg'
                              : 'border-success/20 bg-success-bg text-success-fg',
                        )}
                      >
                        <span className="font-semibold uppercase tracking-wide">
                          Outstanding balance
                        </span>
                        <span className="font-bold">
                          {balanceLoading
                            ? '…'
                            : memberBalance != null
                              ? formatDZD(memberBalance)
                              : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Search members..."
                          value={memberQuery}
                          onChange={(e) => handleMemberSearch(e.target.value)}
                          iconLeft={
                            memberSearching ? (
                              <SpinnerIcon size={16} />
                            ) : (
                              <SearchIcon size={16} />
                            )
                          }
                        />
                        {memberResults.length > 0 && (
                          <ul
                            role="listbox"
                            className="absolute top-full z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-elevation-2"
                          >
                            {memberResults.map((m) => (
                              <li
                                key={m.id}
                                role="option"
                                aria-selected={false}
                                onClick={() => selectMember(m)}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-primary-50"
                              >
                                {m.photoUrl ? (
                                  <img
                                    src={m.photoUrl}
                                    alt=""
                                    className="h-6 w-6 rounded-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
                                    <UserIcon size={12} />
                                  </div>
                                )}
                                <span className="text-neutral-800">
                                  {m.firstNameLatin} {m.lastNameLatin}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFaceModalOpen(true)}
                        className="mt-[22px] flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        aria-label="Identify member by face"
                        title="Identify by face"
                      >
                        <CameraIcon size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Checkout Step */}
                {checkoutStep === 'cart' ? (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => setCheckoutStep('payment')}
                    iconLeft={<PlusIcon size={16} />}
                  >
                    Proceed to Payment
                  </Button>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    {/* Payment Options */}
                    <fieldset>
                      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Payment
                      </legend>
                      <div className="flex gap-2">
                        {PAYMENT_OPTIONS.map((opt) => {
                          const label =
                            opt.value === 'later' && selectedMember
                              ? 'Add to balance'
                              : opt.label;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={paymentOption === opt.value}
                              onClick={() => setPaymentOption(opt.value)}
                              className={`flex-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                                paymentOption === opt.value
                                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    {paymentOption === 'partial' && (
                      <Input
                        label="Amount (DZD)"
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 1500"
                        value={partialInput}
                        onChange={(e) => setPartialInput(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    )}

                    {/* Summary */}
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-neutral-600">
                        <span>Paid</span>
                        <span className="font-semibold">{formatDZD(paidAmount)}</span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex justify-between text-danger">
                          <span>Remaining</span>
                          <span className="font-semibold">{formatDZD(remaining)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setCheckoutStep('cart')}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => void handleCheckout()}
                        loading={checkoutLoading}
                        iconLeft={<CheckIcon size={16} />}
                        className="flex-1"
                        disabled={
                          checkoutLoading ||
                          (paymentOption === 'partial' &&
                            (parseDZDInput(partialInput) <= 0 ||
                              parseDZDInput(partialInput) >= cartTotal))
                        }
                      >
                        Complete Sale
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* Face-search modal — identify members by camera capture */}
      <Modal
        open={faceModalOpen}
        onClose={closeFaceModal}
        title="Identify Member"
        description="Point the camera at the member's face to look them up."
        size="md"
        closeOnOverlay
      >
        <div className="flex flex-col gap-4">
          {faceMatches === null && !faceUploading && !faceError && (
            <Camera
              onSave={(blob) => { void handleFaceCapture(blob); }}
              onCancel={closeFaceModal}
              aspect={1}
              minOutput={300}
            />
          )}

          {faceUploading && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-6 text-sm text-neutral-500"
            >
              <SpinnerIcon size={16} />
              <span>Analysing face…</span>
            </div>
          )}

          {faceError && !faceUploading && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-fg"
            >
              <AlertIcon size={16} />
              <span>{faceError}</span>
            </div>
          )}

          {faceMatches !== null && !faceUploading && (
            <>
              {faceMatches.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">
                  No matching member found.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
                  {faceMatches.map((m) => {
                    const fullName = `${m.member.firstNameLatin} ${m.member.lastNameLatin}`;
                    const pct = Math.round(m.confidence * 100);
                    const tone =
                      m.confidence >= 0.85
                        ? 'bg-success-bg text-success-fg border-success/20'
                        : m.confidence >= 0.5
                          ? 'bg-warning-bg text-warning-fg border-warning/30'
                          : 'bg-danger-bg text-danger-fg border-danger/20';
                    return (
                      <li key={m.memberId}>
                        <button
                          type="button"
                          onClick={() =>
                            selectMember({
                              id: m.memberId,
                              firstNameLatin: m.member.firstNameLatin,
                              lastNameLatin: m.member.lastNameLatin,
                              photoUrl: m.member.photoPath ?? null,
                            })
                          }
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                        >
                          {m.member.photoPath ? (
                            <img
                              src={m.member.photoPath}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                              <UserIcon size={16} />
                            </span>
                          )}
                          <span className="flex-1 truncate text-sm font-medium text-neutral-900">
                            {fullName}
                          </span>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                              tone,
                            )}
                          >
                            {pct}%
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex justify-end">
                <Button variant="secondary" onClick={resetFaceSearch}>
                  Search Again
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Off-screen printable slip for the last sale — populated on checkout
          so printReceipt() has real content to send to the 80mm printer. */}
      {lastSale ? (
        <ReceiptPrintable
          hiddenOnScreen
          receiptNumber={lastSale.receiptNumber}
          createdAt={lastSale.createdAt}
          memberName={lastSale.memberName}
          items={lastSale.items}
          totalAmount={lastSale.totalAmount}
          paidAmount={lastSale.paidAmount}
          remaining={lastSale.remaining}
          statusLabel={lastSale.statusLabel}
        />
      ) : null}
    </div>
  );
}

/* ──────────────── Helpers ──────────────── */

const PAYMENT_OPTIONS: { value: PaymentOption; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'partial', label: 'Partial' },
  { value: 'later', label: 'Later' },
];

function CategoryIcon({ category }: { category: string }) {
  const baseClass = 'flex h-10 w-10 items-center justify-center rounded-lg text-white';
  switch (category) {
    case 'registration':
      return (
        <div className={`${baseClass} bg-blue-500`}>
          <UserIcon size={20} />
        </div>
      );
    case 'license':
      return (
        <div className={`${baseClass} bg-amber-500`}>
          <CheckIcon size={20} />
        </div>
      );
    case 'equipment':
      return (
        <div className={`${baseClass} bg-emerald-500`}>
          <PlusIcon size={20} />
        </div>
      );
    default:
      return (
        <div className={`${baseClass} bg-neutral-400`}>
          <ShoppingCartIcon size={20} />
        </div>
      );
  }
}
