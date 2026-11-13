CREATE TYPE "ReceptionStatus" AS ENUM ('PENDIENTE', 'PARCIAL', 'RECIBIDA');
ALTER TABLE "national_purchases" ADD COLUMN "reception_status" "ReceptionStatus" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "national_purchase_items" ADD COLUMN "received_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0;
-- Las compras existentes ya movieron stock: se consideran recibidas.
UPDATE "national_purchases" SET "reception_status" = 'RECIBIDA';
UPDATE "national_purchase_items" SET "received_quantity" = "quantity";
