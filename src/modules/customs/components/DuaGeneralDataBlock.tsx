import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Ship } from 'lucide-react';

interface Props {
  values: {
    dua_number: string;
    customs_agency_code: string;
    regime_code?: string;
    numeration_date: string;
    exchange_rate: number;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: Record<string, string>;
}

export const DuaGeneralDataBlock = ({ values, onChange, errors = {} }: Props) => {
  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Bloque 1: Datos Aduaneros de la Declaración (DAM)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold block mb-1">
              N° DUA / DAM <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="118-2026-10-001234"
              value={values.dua_number}
              onChange={(e) => onChange('dua_number', e.target.value)}
              className="font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Formato oficial: <code>Aduana-Año-Régimen-Número</code>
            </span>
            {errors.dua_number && (
              <span className="text-[10px] text-destructive block mt-1">{errors.dua_number}</span>
            )}
          </div>

          <div>
            <label className="font-semibold block mb-1">Aduana de Despacho</label>
            <Input
              placeholder="118 - MARÍTIMA DEL CALLAO"
              value={values.customs_agency_code}
              onChange={(e) => onChange('customs_agency_code', e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-semibold block mb-1">Régimen Aduanero</label>
            <Input
              value={values.regime_code}
              onChange={(e) => onChange('regime_code', e.target.value)}
              className="font-mono text-xs bg-muted/40"
              readOnly
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              10: Importación para el Consumo
            </span>
          </div>

          <div>
            <label className="font-semibold block mb-1">
              Fecha de Numeración <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={values.numeration_date}
              onChange={(e) => onChange('numeration_date', e.target.value)}
              className="text-xs"
            />
            {errors.numeration_date && (
              <span className="text-[10px] text-destructive block mt-1">{errors.numeration_date}</span>
            )}
          </div>

          <div>
            <label className="font-semibold block mb-1">
              Tipo de Cambio SUNAT (S/) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              step="0.0001"
              min="1"
              value={values.exchange_rate}
              onChange={(e) => onChange('exchange_rate', Number(e.target.value))}
              className="font-mono text-xs font-semibold text-primary"
            />
            {errors.exchange_rate && (
              <span className="text-[10px] text-destructive block mt-1">{errors.exchange_rate}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
