-- Datos fiscales devueltos por la consulta RUC de SUNAT/Decolecta.
ALTER TABLE "company_configurations"
  ADD COLUMN "direccion" TEXT,
  ADD COLUMN "estado" TEXT,
  ADD COLUMN "condicion" TEXT,
  ADD COLUMN "ubigeo" TEXT,
  ADD COLUMN "es_agente_retencion" BOOLEAN;
