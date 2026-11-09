CREATE TABLE "padron_ruc_cache" (
    "id" TEXT NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" TEXT NOT NULL,
    "estado_contribuyente" TEXT NOT NULL,
    "condicion_domicilio" TEXT NOT NULL,
    "ubigeo" VARCHAR(6),
    "direccion_fiscal" TEXT,
    "es_agente_retencion" BOOLEAN,
    "source" TEXT NOT NULL,
    "consulted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "padron_ruc_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "padron_ruc_cache_ruc_key"
  ON "padron_ruc_cache"("ruc");

CREATE INDEX "padron_ruc_cache_estado_contribuyente_condicion_domicilio_idx"
  ON "padron_ruc_cache"("estado_contribuyente", "condicion_domicilio");
