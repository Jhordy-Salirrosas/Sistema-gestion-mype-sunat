import { useState } from 'react';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

const MESES = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
];

/**
 * Selector Año + Mes. Evita el control nativo `month`, que en algunos
 * navegadores autocompleta ceros y confunde el formato contable.
 */
export function PeriodInput({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<{base: string; year: string; month: string} | null>(null);
  const parts = /^(\d{4})-(\d{1,2})$/.exec(value);
  const year = draft?.base === value ? draft.year : parts?.[1] ?? '';
  const month = draft?.base === value ? draft.month : parts?.[2].padStart(2, '0') ?? '';
  const valido = /^\d{4}$/.test(year) && MESES.includes(month);
  const cambiar = (nuevoAnio: string, nuevoMes: string) => {
    setDraft({base: value, year: nuevoAnio, month: nuevoMes});
    if (/^\d{4}$/.test(nuevoAnio) && MESES.includes(nuevoMes)) onChange(`${nuevoAnio}-${nuevoMes}`);
  };

  return (
    <div className={cn('flex gap-1.5', className)}>
      <Input
        id={id}
        aria-label="Año contable"
        type="number"
        step={1}
        aria-invalid={!valido}
        value={year}
        onChange={(event) => cambiar(event.target.value, month)}
        className="w-24"
      />
      <select
        aria-label="Mes contable"
        value={month}
        onChange={(event) => cambiar(year, event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {MESES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {!valido && <p role="alert" className="text-xs text-destructive">Indique un año entero de cuatro dígitos y un mes entre 1 y 12.</p>}
    </div>
  );
}
