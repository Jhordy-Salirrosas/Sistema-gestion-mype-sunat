import type { ReactNode } from 'react';
import { Input } from '@/components/ui';

/** Valores del formulario de emision, todos como texto. */
export interface EmitFormValues {
  ruc_emisor: string;
  serie: string;
  correlativo: string;
  monto_total: string;
}

interface OfflineEmitFieldsProps {
  values: EmitFormValues;
  onChange: (field: keyof EmitFormValues, value: string) => void;
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Los cuatro campos del formulario de emision de prueba. */
export function OfflineEmitFields({
  values,
  onChange,
}: OfflineEmitFieldsProps) {
  return (
    <>
      <Campo label="RUC emisor">
        <Input
          value={values.ruc_emisor}
          onChange={(e) => onChange('ruc_emisor', e.target.value)}
          required
        />
      </Campo>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col">
          <Campo label="Serie">
            <Input
              value={values.serie}
              onChange={(e) => onChange('serie', e.target.value)}
              required
            />
          </Campo>
        </div>

        <div className="flex w-28 flex-col">
          <Campo label="Correlativo">
            <Input
              type="number"
              min={1}
              value={values.correlativo}
              onChange={(e) => onChange('correlativo', e.target.value)}
              required
            />
          </Campo>
        </div>
      </div>

      <Campo label="Monto total">
        <Input
          type="number"
          step="0.01"
          min={0.01}
          value={values.monto_total}
          onChange={(e) => onChange('monto_total', e.target.value)}
          required
        />
      </Campo>
    </>
  );
}