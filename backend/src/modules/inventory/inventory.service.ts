import type { Equipment, StockAdjustment, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import type {
  CreateEquipmentInput,
  UpdateEquipmentInput,
  StockAdjustmentInput,
  ListEquipmentQuery,
} from './inventory.schema.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class InventoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

type EquipmentWithDiscipline = Equipment & {
  discipline: { id: string; name: string } | null;
};

type EquipmentWithHistory = Equipment & {
  discipline: { id: string; name: string } | null;
  stockAdjustments: StockAdjustment[];
};

type PaginatedEquipment = {
  equipment: EquipmentWithDiscipline[];
  total: number;
  page: number;
  totalPages: number;
  totalValue: number;
  lowStockCount: number;
};

type MemberEquipmentHistoryItem = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: Date;
  paymentReceiptNo: string | null;
  paymentId: string | null;
};

// ─── List equipment ─────────────────────────────────────────────────────────

export async function listEquipment(
  query: ListEquipmentQuery,
): Promise<PaginatedEquipment> {
  const { page, limit, search, lowStock } = query;

  const where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (lowStock) {
    where.stockQuantity = { lt: LOW_STOCK_THRESHOLD };
  }

  // Build a where clause without the lowStock filter for computing lowStockCount
  const whereBase: Prisma.EquipmentWhereInput = { deletedAt: null };
  if (search) {
    whereBase.name = { contains: search, mode: 'insensitive' };
  }

  const [total, equipment, allForStats] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: {
        discipline: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.equipment.findMany({
      where: whereBase,
      select: { price: true, stockQuantity: true },
    }),
  ]);

  const totalValue = allForStats.reduce(
    (sum, e) => sum + e.price * e.stockQuantity,
    0,
  );
  const lowStockCount = allForStats.filter(
    (e) => e.stockQuantity < LOW_STOCK_THRESHOLD,
  ).length;

  return {
    equipment,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    totalValue,
    lowStockCount,
  };
}

// ─── Get single equipment ───────────────────────────────────────────────────

export async function getEquipment(id: string): Promise<EquipmentWithHistory> {
  const equipment = await prisma.equipment.findFirst({
    where: { id, deletedAt: null },
    include: {
      discipline: {
        select: { id: true, name: true },
      },
      stockAdjustments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!equipment) {
    throw new InventoryError('NOT_FOUND', 'Equipment not found', 404);
  }

  return equipment;
}

// ─── Create equipment ───────────────────────────────────────────────────────

export async function createEquipment(
  input: CreateEquipmentInput,
  userId: string,
): Promise<Equipment> {
  // Validate discipline if provided
  if (input.disciplineId) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: input.disciplineId, deletedAt: null, isActive: true },
    });
    if (!discipline) {
      throw new InventoryError('VALIDATION_ERROR', 'Discipline not found or inactive', 422);
    }
  }

  const equipment = await prisma.$transaction(async (tx) => {
    const created = await tx.equipment.create({
      data: {
        name: input.name,
        price: input.price,
        stockQuantity: input.stockQuantity,
        disciplineId: input.disciplineId ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Log initial stock as StockAdjustment if stockQuantity > 0
    if (input.stockQuantity > 0) {
      await tx.stockAdjustment.create({
        data: {
          equipmentId: created.id,
          quantityChange: input.stockQuantity,
          reason: 'initial_stock',
          notes: `Initial stock set to ${input.stockQuantity}`,
          performedBy: userId,
        },
      });
    }

    return created;
  });

  return equipment;
}

// ─── Update equipment ───────────────────────────────────────────────────────

export async function updateEquipment(
  id: string,
  input: UpdateEquipmentInput,
  userId: string,
): Promise<Equipment> {
  const existing = await prisma.equipment.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new InventoryError('NOT_FOUND', 'Equipment not found', 404);
  }

  // Validate discipline if provided
  if (input.disciplineId) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: input.disciplineId, deletedAt: null, isActive: true },
    });
    if (!discipline) {
      throw new InventoryError('VALIDATION_ERROR', 'Discipline not found or inactive', 422);
    }
  }

  const updateData: Prisma.EquipmentUpdateInput = {
    updatedBy: userId,
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.price !== undefined) {
    updateData.price = input.price;
  }
  if (input.disciplineId !== undefined) {
    if (input.disciplineId === null) {
      updateData.discipline = { disconnect: true };
    } else {
      updateData.discipline = { connect: { id: input.disciplineId } };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Audit trail
    const oldData: Record<string, unknown> = {
      name: existing.name,
      price: existing.price,
      disciplineId: existing.disciplineId,
    };
    const newData: Record<string, unknown> = {};
    if (input.name !== undefined) newData.name = input.name;
    if (input.price !== undefined) newData.price = input.price;
    if (input.disciplineId !== undefined) newData.disciplineId = input.disciplineId;

    const auditEntries = diffToAuditEntries(
      'equipment',
      id,
      oldData,
      newData,
      userId,
    );
    await insertAuditEntries(tx, auditEntries);

    return tx.equipment.update({
      where: { id },
      data: updateData,
    });
  });

  return updated;
}

// ─── Deactivate equipment (soft delete) ─────────────────────────────────────

export async function deactivateEquipment(
  id: string,
  userId: string,
): Promise<void> {
  const existing = await prisma.equipment.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new InventoryError('NOT_FOUND', 'Equipment not found', 404);
  }

  await prisma.equipment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: userId,
    },
  });
}

// ─── Adjust stock ───────────────────────────────────────────────────────────

export async function adjustStock(
  equipmentId: string,
  input: StockAdjustmentInput,
  userId: string,
): Promise<{ equipment: Equipment; adjustment: StockAdjustment }> {
  const result = await prisma.$transaction(async (tx) => {
    // Lock the row by reading within transaction
    const equipment = await tx.equipment.findFirst({
      where: { id: equipmentId, deletedAt: null },
    });

    if (!equipment) {
      throw new InventoryError('NOT_FOUND', 'Equipment not found', 404);
    }

    const newQuantity = equipment.stockQuantity + input.quantityChange;

    if (newQuantity < 0) {
      throw new InventoryError(
        'INSUFFICIENT_STOCK',
        `Insufficient stock. Current: ${equipment.stockQuantity}, requested change: ${input.quantityChange}`,
        422,
      );
    }

    const updatedEquipment = await tx.equipment.update({
      where: { id: equipmentId },
      data: {
        stockQuantity: newQuantity,
        updatedBy: userId,
      },
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        equipmentId,
        quantityChange: input.quantityChange,
        reason: input.reason,
        notes: input.notes ?? null,
        performedBy: userId,
      },
    });

    return { equipment: updatedEquipment, adjustment };
  });

  return result;
}

// ─── Adjust stock (internal — for POS and billing) ──────────────────────────

/**
 * Deduct stock within an existing Prisma transaction.
 * Used by POS checkout and billing service.
 */
export async function deductStockInTransaction(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  quantity: number,
  userId: string,
  notes?: string,
): Promise<void> {
  const equipment = await tx.equipment.findFirst({
    where: { id: equipmentId, deletedAt: null },
  });

  if (!equipment) {
    throw new InventoryError('NOT_FOUND', `Equipment ${equipmentId} not found`, 404);
  }

  const newQuantity = equipment.stockQuantity - quantity;

  if (newQuantity < 0) {
    throw new InventoryError(
      'INSUFFICIENT_STOCK',
      `Insufficient stock for "${equipment.name}". Available: ${equipment.stockQuantity}, requested: ${quantity}`,
      422,
    );
  }

  await tx.equipment.update({
    where: { id: equipmentId },
    data: {
      stockQuantity: newQuantity,
      updatedBy: userId,
    },
  });

  await tx.stockAdjustment.create({
    data: {
      equipmentId,
      quantityChange: -quantity,
      reason: 'pos_sale',
      notes: notes ?? null,
      performedBy: userId,
    },
  });
}

// ─── Get stock history ──────────────────────────────────────────────────────

export async function getStockHistory(
  equipmentId: string,
): Promise<StockAdjustment[]> {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, deletedAt: null },
  });

  if (!equipment) {
    throw new InventoryError('NOT_FOUND', 'Equipment not found', 404);
  }

  return prisma.stockAdjustment.findMany({
    where: { equipmentId },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Get member equipment history ───────────────────────────────────────────

export async function getMemberEquipmentHistory(
  memberId: string,
): Promise<MemberEquipmentHistoryItem[]> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });

  if (!member) {
    throw new InventoryError('NOT_FOUND', 'Member not found', 404);
  }

  const purchases = await prisma.memberEquipment.findMany({
    where: {
      memberId,
      deletedAt: null,
    },
    include: {
      equipment: {
        select: { id: true, name: true, price: true },
      },
      payment: {
        select: { receiptNumber: true },
      },
    },
    orderBy: { purchaseDate: 'desc' },
  });

  return purchases.map((p) => ({
    id: p.id,
    equipmentId: p.equipment.id,
    equipmentName: p.equipment.name,
    quantity: p.quantity,
    unitPrice: p.equipment.price,
    totalPrice: p.equipment.price * p.quantity,
    purchaseDate: p.purchaseDate,
    paymentReceiptNo: p.payment?.receiptNumber ?? null,
    paymentId: p.paymentId,
  }));
}

// ─── List POS products ──────────────────────────────────────────────────────

type PosProduct = {
  id: string;
  name: string;
  price: number;
  category: 'equipment';
  barcode: null;
  inStock: boolean;
  stockQuantity: number | null;
  disciplineId: string | null;
  disciplineName: string | null;
};

export async function listPosProducts(): Promise<PosProduct[]> {
  const equipment = await prisma.equipment.findMany({
    where: { deletedAt: null },
    include: {
      discipline: {
        select: { name: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return equipment.map((e) => ({
    id: e.id,
    name: e.name,
    price: e.price,
    category: 'equipment' as const,
    barcode: null,
    inStock: e.stockQuantity > 0,
    stockQuantity: e.stockQuantity,
    disciplineId: e.disciplineId,
    disciplineName: e.discipline?.name ?? null,
  }));
}

// ─── Lookup product by barcode (name match for now) ─────────────────────────

export async function lookupByBarcode(code: string): Promise<PosProduct | null> {
  const equipment = await prisma.equipment.findFirst({
    where: {
      deletedAt: null,
      name: { equals: code, mode: 'insensitive' },
    },
    include: {
      discipline: {
        select: { name: true },
      },
    },
  });

  if (!equipment) {
    return null;
  }

  return {
    id: equipment.id,
    name: equipment.name,
    price: equipment.price,
    category: 'equipment' as const,
    barcode: null,
    inStock: equipment.stockQuantity > 0,
    stockQuantity: equipment.stockQuantity,
    disciplineId: equipment.disciplineId,
    disciplineName: equipment.discipline?.name ?? null,
  };
}
