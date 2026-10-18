-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "sunat_response_notes" JSONB;

-- AlterTable
ALTER TABLE "transaction_history" ADD COLUMN     "http_status_code" INTEGER;
