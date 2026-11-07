import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { type RegisterDuaWizardPayload } from '../types';

interface DuaStep4ConfirmationProps {
  data: Partial<RegisterDuaWizardPayload>;
  isSubmitting: boolean;
  onConfirm: () => void;
}

export const DuaStep4Confirmation: React.FC<DuaStep4ConfirmationProps> = ({
  data,
  isSubmitting,
  onConfirm,
}) => {
  const duaNumber = `${data.customs_code || '118'}-${data.declaration_year || 2026}-10-${data.correlative_number || '004200'}`;

  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardContent className="p-4 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h4 className="font-bold text-base text-foreground">Confirmación y Transmisión Oficial de la DAM</h4>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Declaración Proyectada: <span className="font-bold text-primary">{duaNumber}</span>
            </p>
          </div>
          <Badge variant="default" className="text-xs gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Canal Verde Proyectado
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5 font-mono">
            <p className="font-bold text-foreground text-xs font-sans">Cuota 0010 (Derechos DAM)</p>
            <p className="text-[11px] text-muted-foreground">Código Tributario: 0001 / 0002 / 0014</p>
            <div className="flex justify-between text-xs pt-1 border-t border-border/40 font-bold">
              <span>CDA Asignado:</span>
              <span className="text-primary">{data.customs_code || '118'}26100104589</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Plazo de pago: 15 días calendario</p>
          </div>

          <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5 font-mono">
            <p className="font-bold text-foreground text-xs font-sans">Cuota 0026 (Percepción IGV 3.5%)</p>
            <p className="text-[11px] text-muted-foreground">Código Tributario: 0096 (R.S. 203-2003)</p>
            <div className="flex justify-between text-xs pt-1 border-t border-border/40 font-bold">
              <span>CDA Asignado:</span>
              <span className="text-amber-600 dark:text-amber-400">{data.customs_code || '118'}26100264589</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Pago simultáneo exigido para levante</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Al confirmar, se numerará oficialmente la DAM bajo <strong>Despacho Anticipado</strong>, se generarán
            las cuotas de pago bancario y el expediente comercial transicionará al estado <strong>EN_DESPACHO</strong>.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="gap-1.5 px-4 font-bold"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? 'Transmitiendo a SUNAT...' : 'Confirmar y Numerar DAM'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
