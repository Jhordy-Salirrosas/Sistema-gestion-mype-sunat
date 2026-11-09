-- Para revisión y aplicación manual; no aplicada por esta tarea.
CREATE TABLE "invoice_creation_requests" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "request_key" VARCHAR(128) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_creation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_creation_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoice_creation_requests_company_id_request_key_key" ON "invoice_creation_requests"("company_id", "request_key");
