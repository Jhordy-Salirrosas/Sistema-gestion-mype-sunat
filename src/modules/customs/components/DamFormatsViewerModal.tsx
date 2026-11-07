import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { FileText, DollarSign, Layers, ShieldCheck } from 'lucide-react';
import { type CustomsDeclarationRecord } from '../types';
import { DamFormatAView } from './DamFormatAView';

interface DamFormatsViewerModalProps {
  declaration: CustomsDeclarationRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DamFormatsViewerModal: React.FC<DamFormatsViewerModalProps> = ({
  declaration,
  isOpen,
  onClose,
}) => {
  const [activeFormat, setActiveFormat] = useState<'A' | 'B' | 'C'>('A');

  if (!declaration) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Visor Oficial de Formatos Aduaneros DAM / DUA
              </DialogTitle>
              <DialogDescription className="text-xs">
                Declaración Aduanera Oficial N° {declaration.dua_number || '118-2026-10-045892'} · Régimen 10
              </DialogDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Canal: {declaration.channel || 'VERDE'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Selector de Formatos Oficiales A / B / C */}
        <div className="flex border-b border-border gap-2 text-xs font-semibold">
          <Button
            size="sm"
            variant={activeFormat === 'A' ? 'default' : 'ghost'}
            onClick={() => setActiveFormat('A')}
            className="h-8 gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            Formato A (Series y Mercancías)
          </Button>
          <Button
            size="sm"
            variant={activeFormat === 'B' ? 'default' : 'ghost'}
            onClick={() => setActiveFormat('B')}
            className="h-8 gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Formato B (Declaración del Valor OMC)
          </Button>
          <Button
            size="sm"
            variant={activeFormat === 'C' ? 'default' : 'ghost'}
            onClick={() => setActiveFormat('C')}
            className="h-8 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Formato C (Liquidación de Tributos)
          </Button>
        </div>

        {/* Contenido Formato A */}
        {activeFormat === 'A' && <DamFormatAView declaration={declaration} />}

        {/* Contenido Formato B */}
        {activeFormat === 'B' && (
          <div className="space-y-3 py-2 text-xs">
            {/* Casilla 5: Proveedor Extranjero */}
            <div className="p-3 border rounded-lg bg-card/60 space-y-1.5">
              <h4 className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                1. Datos del Proveedor Extranjero (Casilla 5 DAV)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                <div>
                  <span className="block text-[10px]">Razón Social / Exportador:</span>
                  <span className="font-semibold text-foreground">{declaration.supplier_name || 'Shenzhen Tech Ltd.'}</span>
                </div>
                <div>
                  <span className="block text-[10px]">Tax ID / RUC País:</span>
                  <span className="font-mono font-medium text-foreground">{declaration.supplier_tax_id || '91440300MA5'}</span>
                </div>
                <div>
                  <span className="block text-[10px]">País de Residencia:</span>
                  <span className="font-medium text-foreground">{declaration.supplier_country ? `${declaration.supplier_country} — Exterior` : 'CN — China'}</span>
                </div>
                <div>
                  <span className="block text-[10px]">Condición del Proveedor:</span>
                  <Badge variant="outline" className="text-[9px] py-0">FABRICANTE DIRECTO</Badge>
                </div>
              </div>
            </div>

            {/* Casilla 6: Transacción Comercial y Factura */}
            <div className="p-3 border rounded-lg bg-card/60 space-y-1.5">
              <h4 className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                2. Factura Comercial e Incoterm Pactado (Casilla 6 DAV)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground block text-[10px]">N° Factura Comercial:</span>
                  <span className="font-mono font-bold text-primary">{declaration.commercial_invoice_number || 'INV-2026-SZ892'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Fecha de Emisión:</span>
                  <span className="font-medium">{String(declaration.numeration_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Término de Entrega (Incoterm):</span>
                  <span className="font-bold text-foreground">{declaration.incoterm || 'FOB'} — Free On Board (ICC 2020)</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Forma de Pago Convenida:</span>
                  <span className="font-medium">Transferencia Bancaria (SWIFT / T/T)</span>
                </div>
              </div>
            </div>

            {/* Casilla 7: Cuestionario OMC */}
            <div className="p-3 bg-muted/40 rounded-lg space-y-2 border border-border/50">
              <h4 className="font-bold text-foreground text-[11px]">
                3. Condiciones de la Transacción (Decisión 571 CAN / Acuerdo del Valor OMC):
              </h4>
              <ul className="space-y-1 text-muted-foreground text-[11px]">
                <li>✓ Casilla 7.1: ¿Existe vinculación comercial, laboral o societaria entre comprador y vendedor? <strong>NO</strong></li>
                <li>✓ Casilla 7.3: ¿Existen restricciones a la cesión o utilización de las mercancías? <strong>NO</strong></li>
                <li>✓ Casilla 7.8: ¿Existen cánones o derechos de licencia (regalías) respecto a las mercancías? <strong>NO</strong></li>
                <li>
                  ✓ Método de Valoración Oficial Aplicado:{' '}
                  <strong className="text-primary font-bold">
                    Primer Método — Valor de Transacción de Mercancías Importadas (Art. 1 Acuerdo OMC)
                  </strong>
                </li>
              </ul>
            </div>

            {/* Casilla 8: Determinación del Valor en Aduana */}
            <div className="p-3 border rounded-lg space-y-2 bg-card/60">
              <h4 className="font-bold text-foreground text-[11px]">
                4. Determinación del Valor en Aduana — Ajustes Art. 8 Acuerdo OMC (Casilla 8):
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground block text-[10px]">Precio Facturado (FOB Total):</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(declaration.fob_total_usd || 50000, 'USD')}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground block text-[10px]">(+) Flete Marítimo Internacional:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(declaration.freight_total_usd || 1200, 'USD')}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground block text-[10px]">(+) Seguro (TPPS SUNAT 0.75%):</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(declaration.insurance_total_usd || 375, 'USD')}
                  </span>
                </div>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded">
                  <span className="text-emerald-700 dark:text-emerald-300 block text-[10px] font-semibold">(=) Total Valor CIF Aduanas:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {formatCurrency(declaration.cif_total_usd || 51575, 'USD')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Formato C */}
        {activeFormat === 'C' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between border border-border/50">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Tipo de Cambio Aduanero Oficial:</span>
                <span className="font-mono font-bold text-foreground">S/ {declaration.exchange_rate || 3.82} por USD</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Base Imponible CIF en Moneda Nacional:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatCurrency(declaration.cif_total_pen || 197016.5, 'PEN')}
                </span>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-muted font-semibold border-b">
                  <tr>
                    <th className="p-2">Cód. SUNAT</th>
                    <th className="p-2">Concepto Tributario</th>
                    <th className="p-2">Tasa Legal</th>
                    <th className="p-2 text-right">Base Imponible</th>
                    <th className="p-2 text-right">Monto Liquidado (PEN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2 font-mono text-muted-foreground">0010</td>
                    <td className="p-2 font-medium">Ad-Valorem (Arancel de Aduanas)</td>
                    <td className="p-2 font-mono">0.0%</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(declaration.cif_total_pen || 197016.5, 'PEN')}</td>
                    <td className="p-2 text-right font-mono font-bold">S/ 0.00</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-muted-foreground">0003</td>
                    <td className="p-2 font-medium">IGV Aduanero (Impuesto General a las Ventas)</td>
                    <td className="p-2 font-mono">16.0%</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(declaration.cif_total_pen || 197016.5, 'PEN')}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatCurrency(declaration.total_igv_pen || 31522.64, 'PEN')}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-muted-foreground">0004</td>
                    <td className="p-2 font-medium">IPM (Impuesto de Promoción Municipal)</td>
                    <td className="p-2 font-mono">2.0%</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(declaration.cif_total_pen || 197016.5, 'PEN')}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatCurrency(declaration.total_ipm_pen || 3940.33, 'PEN')}
                    </td>
                  </tr>
                  <tr className="bg-amber-500/5">
                    <td className="p-2 font-mono text-amber-700 dark:text-amber-300">0026</td>
                    <td className="p-2 font-medium text-amber-700 dark:text-amber-300">
                      Percepción del IGV en Importaciones (Ley 29173)
                    </td>
                    <td className="p-2 font-mono text-amber-700 dark:text-amber-300">3.5% (Habitual)</td>
                    <td className="p-2 text-right font-mono text-amber-700 dark:text-amber-300">S/ 232,479.47</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(declaration.total_perception_pen || 8136.78, 'PEN')}
                    </td>
                  </tr>
                  <tr className="bg-primary/5 font-bold">
                    <td colSpan={4} className="p-2.5 text-right text-foreground uppercase tracking-wider">
                      TOTAL DEUDA TRIBUTARIA ADUANERA:
                    </td>
                    <td className="p-2.5 text-right font-mono text-primary text-xs">
                      {formatCurrency(43599.75, 'PEN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Recuadro Oficial de Cobranza (CDA) */}
            <div className="p-3 border rounded-lg bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Liquidación de Cobranza Oficial SUNAT (CDA)
                </span>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                  PAGADA / CON LEVANTE
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] p-2 bg-muted/20 rounded">
                <div>
                  <span className="text-muted-foreground block text-[10px]">N° Documento CDA (14 dígitos):</span>
                  <span className="font-mono font-bold text-foreground">11826100104589</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Fecha de Vencimiento:</span>
                  <span className="font-medium text-foreground">05/11/2026 (Exigible)</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Modalidad de Garantía:</span>
                  <span className="font-medium text-foreground">Pago Contado Previo (Sin Art. 160)</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Entidad Bancaria Recaudadora:</span>
                  <span className="font-medium text-foreground">BCP — Op. Bancaria 994128</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Cerrar Visor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
