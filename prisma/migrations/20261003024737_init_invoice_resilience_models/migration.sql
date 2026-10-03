-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDIENTE', 'PROCESANDO', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'ERROR_RED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ruc_emisor" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "tipo_comprobante" TEXT NOT NULL,
    "monto_total" DECIMAL(10,2) NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "estado" "InvoiceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "payload_ubl" JSONB NOT NULL,
    "cdr_sunat" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionHistory" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "intento" INTEGER NOT NULL DEFAULT 1,
    "estado_anterior" "InvoiceStatus",
    "estado_nuevo" "InvoiceStatus" NOT NULL,
    "codigo_error" TEXT,
    "mensaje_error" TEXT,
    "tiempo_respuesta_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
