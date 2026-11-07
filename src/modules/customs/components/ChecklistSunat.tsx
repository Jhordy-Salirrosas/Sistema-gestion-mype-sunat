import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square, FileCheck } from 'lucide-react';

const SUNAT_INVOICE_REQUIREMENTS = [
  { id: 1, label: 'Nombre / Razón social y domicilio legal del remitente extranjero' },
  { id: 2, label: 'Número de factura proforma / orden, lugar y fecha de formulación' },
  { id: 3, label: 'Nombre o razón social del importador peruano y domicilio fiscal' },
  { id: 4, label: 'Descripción detallada: marca, modelo, cantidad, unidad física y estado (nuevo)' },
  { id: 5, label: 'Valor unitario y precio total bajo el Incoterm pactado (FOB / CIF)' },
  { id: 6, label: 'Moneda de la transacción comercial (USD)' },
  { id: 7, label: 'Forma y condiciones de pago (Transferencia bancaria / Carta de crédito)' },
  { id: 8, label: 'Número y fecha de pedido u orden de compra atendida' },
];

export const ChecklistSunat: React.FC = () => {
  const [checkedIds, setCheckedIds] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isComplete = checkedIds.length === SUNAT_INVOICE_REQUIREMENTS.length;

  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            Checklist Factura Comercial (Art. A.3.2.b PG.01)
          </CardTitle>
          <Badge variant={isComplete ? 'default' : 'secondary'} className="text-xs">
            {checkedIds.length}/{SUNAT_INVOICE_REQUIREMENTS.length} Requisitos Validados
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-2">
        {SUNAT_INVOICE_REQUIREMENTS.map((req) => {
          const isChecked = checkedIds.includes(req.id);
          return (
            <div
              key={req.id}
              onClick={() => toggleCheck(req.id)}
              className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors text-xs"
            >
              <button
                type="button"
                className="mt-0.5 text-primary shrink-0 focus:outline-hidden"
                aria-label={`Verificar requisito ${req.id}`}
              >
                {isChecked ? (
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <span className={isChecked ? 'text-foreground' : 'text-muted-foreground line-through'}>
                {req.id}. {req.label}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
