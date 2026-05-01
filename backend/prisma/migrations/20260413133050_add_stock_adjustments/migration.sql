-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "performed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_adjustments_equipment_id_idx" ON "stock_adjustments"("equipment_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_performed_by_idx" ON "stock_adjustments"("performed_by");

-- CreateIndex
CREATE INDEX "stock_adjustments_created_at_idx" ON "stock_adjustments"("created_at");

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
