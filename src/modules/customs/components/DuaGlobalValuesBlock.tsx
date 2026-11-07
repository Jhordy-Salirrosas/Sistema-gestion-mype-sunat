import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DollarSign } from 'lucide-react';

interface Props {
  values: {
    fob_value_usd: number;
    freight_value_usd: number;
    insurance_value_usd: number;
    ad_valorem_rate: number;
    perception_rate: number;
  };
  onChange: (field: string, value: number) => void;
  errors?: Record<string, string>;
}

export const DuaGlobalValuesBlock = ({ values, onChange, errors = {} }: Props) => {
  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Bloque 2: Valores Globales en Divisas (USD) & Tasas Arancelarias
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-semibold block mb-1">
              Valor FOB Total ($) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={values.fob_value_usd}
              onChange={(e) => onChange('fob_value_usd', Number(e.target.value))}
              className="font-mono text-xs font-semibold"
            />
            {errors.fob_value_usd && (
              <span className="text-[10px] text-destructive block mt-1">{errors.fob_value_usd}</span>
            )}
          </div>

          <div>
            <label className="font-semibold block mb-1">Flete Internacional ($)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={values.freight_value_usd}
              onChange={(e) => onChange('freight_value_usd', Number(e.target.value))}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Seguro de Transporte ($)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={values.insurance_value_usd}
              onChange={(e) => onChange('insurance_value_usd', Number(e.target.value))}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold block mb-1">Tasa Ad-Valorem (%)</label>
            <select
              value={values.ad_valorem_rate}
              onChange={(e) => onChange('ad_valorem_rate', Number(e.target.value))}
              className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={0}>0% (Exonerado / TLC)</option>
              <option value={6}>6% (Tasa Preferencial MYPE / General)</option>
              <option value={11}>11% (Tasa Plena)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Tasa Percepción IGV (%)</label>
            <select
              value={values.perception_rate}
              onChange={(e) => onChange('perception_rate', Number(e.target.value))}
              className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={3.5}>3.5% (Importador Habitual)</option>
              <option value={5}>5% (Mercancías Usadas / Sensibles)</option>
              <option value={10}>10% (Primera Importación)</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
