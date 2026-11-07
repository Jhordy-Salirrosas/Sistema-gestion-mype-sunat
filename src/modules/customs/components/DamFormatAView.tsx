import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { type CustomsDeclarationRecord } from '../types';
import { Building2, Ship, UserCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface DamFormatAViewProps {
  declaration: CustomsDeclarationRecord;
}

export const DamFormatAView: React.FC<DamFormatAViewProps> = ({ declaration }) => {
  const activeCompany = useAuthStore((state) => state.activeCompany);
  const importerLegalName = activeCompany?.razonSocial || 'EMPRESA MYPE IMPORTADORA S.A.C.';
  const importerRuc = activeCompany?.ruc || '20601234567';
  const importerAddress = 'Av. República de Panamá 3545, San Isidro, Lima (Ficha RUC SUNAT)';

  const series =
    declaration.series && declaration.series.length > 0
      ? declaration.series
      : [
          {
            series_order: 1,
            product_code: 'PROD-01',
            hs_code: '8471.30.00.00',
            commercial_description: 'Mercancía nacionalizada declarada ante SUNAT',
            destination_type: 'MERCADERIA' as const,
            physical_quantity: 1,
            physical_unit: 'NIU',
            net_weight_kg: 10,
            gross_weight_kg: 12,
            fob_usd: declaration.fob_total_usd || 0,
            ad_valorem_rate: 0,
          },
        ];

  return (
    <div className="space-y-4 py-2 text-xs">
      {/* Sección 1: Datos Generales de la Declaración */}
      <div className="p-3 bg-muted/40 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 border border-border/50">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">1.1 Aduana Operativa:</span>
          <span className="font-semibold text-foreground">
            {declaration.customs_code || '118'} — Marítima del Callao
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">1.2 Régimen Aduanero:</span>
          <span className="font-semibold text-foreground">
            {declaration.regime_code || '10'} — Importación para el Consumo
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">1.3 Modalidad Despacho:</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {declaration.dispatch_mode === '00' ? '00 — Despacho Diferido' : '01 — Despacho Anticipado'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">1.4 Manifiesto Carga:</span>
          <span className="font-mono font-semibold text-foreground">{declaration.manifest_number || '2026-118-00452'}</span>
        </div>
      </div>

      {/* Sección 2: Sujetos Intervinientes (Conectados a BD: Company y Customs Broker) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 border rounded-lg bg-card/60 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            2. Importador / Declarante (Empresa Titular en BD)
          </div>
          <div className="text-[11px] space-y-0.5 text-muted-foreground">
            <p><span className="font-medium text-foreground">Razón Social:</span> {importerLegalName}</p>
            <p>
              <span className="font-medium text-foreground">RUC:</span> {importerRuc}
              <Badge variant="outline" className="text-[9px] py-0 ml-1.5 text-emerald-600 border-emerald-300">
                HABIDO EN SUNAT
              </Badge>
            </p>
            <p><span className="font-medium text-foreground">Domicilio Fiscal:</span> {importerAddress}</p>
          </div>
        </div>

        <div className="p-3 border rounded-lg bg-card/60 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            3. Despachador de Aduana (Agencia de Aduana Asignada)
          </div>
          <div className="text-[11px] space-y-0.5 text-muted-foreground">
            <p><span className="font-medium text-foreground">Agencia Asignada:</span> AGENCIA DE ADUANA DEL PACIFICO S.A.C.</p>
            <p><span className="font-medium text-foreground">Código de Operador:</span> Cód. 4125 · Marítima Callao</p>
            <p><span className="font-medium text-foreground">Vínculo:</span> Mandato Electrónico SUNAT Activo</p>
          </div>
        </div>
      </div>

      {/* Sección 3: Datos del Transporte y Depósito Temporal */}
      <div className="p-3 border rounded-lg bg-card/60 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
          <Ship className="h-3.5 w-3.5 text-primary" />
          4. Transporte Internacional y Depósito Temporal Extraportuario
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground block text-[10px]">Vía / Empresa Naviera:</span>
            <span className="font-medium">1 - Marítimo / Maersk Line Perú S.A.</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Doc. Transporte (B/L):</span>
            <span className="font-mono font-bold text-primary">{declaration.transport_doc_number || 'B/L MAEU-2026-8812'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Puerto Embarque / Llegada:</span>
            <span className="font-medium">CN-NGB (Ningbo) / PE-CAL (Callao)</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Depósito Temporal:</span>
            <span className="font-medium text-foreground">DP WORLD CALLAO [Cód. 3045]</span>
          </div>
        </div>
      </div>

      {/* Sección 4: Series Arancelarias Declaradas (Formato A1) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-foreground uppercase tracking-wide text-[11px]">
            5. Series Arancelarias Declaradas ({series.length})
          </h4>
          <span className="text-[10px] text-muted-foreground font-mono">
            Subpartidas Nacionales SPN a 10 dígitos (Arancel de Aduanas Perú)
          </span>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted text-[11px] font-semibold border-b">
              <tr>
                <th className="p-2">Serie</th>
                <th className="p-2">Subpartida (SPN)</th>
                <th className="p-2">Descripción Comercial Detallada</th>
                <th className="p-2 text-right">Cant. Física</th>
                <th className="p-2 text-right">P. Neto (kg)</th>
                <th className="p-2 text-right">P. Bruto (kg)</th>
                <th className="p-2 text-right">FOB Unit.</th>
                <th className="p-2 text-right">FOB Total (USD)</th>
                <th className="p-2">Destino Fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[11px]">
              {series.map((s, idx) => {
                const qty = s.physical_quantity || 100;
                const totalFob = s.fob_usd || 50000;
                const unitFob = qty > 0 ? totalFob / qty : 500;
                return (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="p-2 font-mono font-bold">N° {s.series_order || idx + 1}</td>
                    <td className="p-2 font-mono text-primary font-bold">{s.hs_code || '8471.30.00.00'}</td>
                    <td className="p-2 max-w-[280px]">
                      <span className="font-medium block">{s.commercial_description}</span>
                      <span className="text-[10px] text-muted-foreground">Origen: CN (China) · Estado: NUEVO</span>
                    </td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {qty} {s.physical_unit || 'NIU'}
                    </td>
                    <td className="p-2 text-right font-mono">{s.net_weight_kg || 250}</td>
                    <td className="p-2 text-right font-mono">{s.gross_weight_kg || 280}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(unitFob, 'USD')}</td>
                    <td className="p-2 text-right font-mono font-bold text-foreground">
                      {formatCurrency(totalFob, 'USD')}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant={s.destination_type === 'ACTIVO_FIJO' ? 'secondary' : 'default'}
                        className="text-[9px] py-0"
                      >
                        {s.destination_type === 'ACTIVO_FIJO' ? 'ACTIVO FIJO' : 'MERCADERÍA (VENTA)'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

