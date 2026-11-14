-- Estados de los trabajos asíncronos del menú SIRE (importación y reporte).
CREATE TYPE "SireJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- Importación de una propuesta SIRE: el archivo vive en el almacenamiento de
-- objetos y aquí solo queda su nombre, su ruta y el estado del procesamiento.
CREATE TABLE "sire_importaciones" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "libro" "SireBookType" NOT NULL,
  "nombre_archivo" TEXT NOT NULL,
  "estado" "SireJobStatus" NOT NULL DEFAULT 'PENDING',
  "message_id" TEXT,
  "ruta_archivo" TEXT,
  "hash_archivo" TEXT,
  "backend_almacen" TEXT,
  "total_registros" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "sire_importaciones_pkey" PRIMARY KEY ("id")
);

-- Resultado de la conciliación de un periodo.
CREATE TABLE "sire_conciliaciones" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "conciliados" INTEGER NOT NULL DEFAULT 0,
  "diferencias" INTEGER NOT NULL DEFAULT 0,
  "detalle" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sire_conciliaciones_pkey" PRIMARY KEY ("id")
);

-- Envío del libro conciliado a SUNAT: es un trabajo asíncrono con ticket.
CREATE TABLE "sire_reportes" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "libro" "SireBookType" NOT NULL,
  "estado" "SireJobStatus" NOT NULL DEFAULT 'PENDING',
  "message_id" TEXT,
  "ticket" TEXT,
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "sire_reportes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sire_importaciones_message_id_key"
ON "sire_importaciones"("message_id");

CREATE INDEX "sire_importaciones_company_id_periodo_idx"
ON "sire_importaciones"("company_id", "periodo");

CREATE INDEX "sire_importaciones_company_id_created_at_idx"
ON "sire_importaciones"("company_id", "created_at");

CREATE INDEX "sire_conciliaciones_company_id_periodo_idx"
ON "sire_conciliaciones"("company_id", "periodo");

CREATE INDEX "sire_conciliaciones_company_id_created_at_idx"
ON "sire_conciliaciones"("company_id", "created_at");

CREATE UNIQUE INDEX "sire_reportes_message_id_key"
ON "sire_reportes"("message_id");

CREATE INDEX "sire_reportes_company_id_periodo_idx"
ON "sire_reportes"("company_id", "periodo");

CREATE INDEX "sire_reportes_company_id_created_at_idx"
ON "sire_reportes"("company_id", "created_at");

ALTER TABLE "sire_importaciones"
ADD CONSTRAINT "sire_importaciones_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sire_conciliaciones"
ADD CONSTRAINT "sire_conciliaciones_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sire_reportes"
ADD CONSTRAINT "sire_reportes_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
