/*
  Warnings:

  - A unique constraint covering the columns `[company_id,tipo_comprobante,serie,correlativo]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - Made the column `company_id` on table `invoices` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_fiscal" ON "invoices"("company_id", "tipo_comprobante", "serie", "correlativo");
