import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { ComprobanteDraft } from '../types/sire.types';
import { getAmountFeedback } from '../validators/sireSchema';

interface Props {
  comprobantes: ComprobanteDraft[];
  showFeedback: boolean;
  onChange: (rows: ComprobanteDraft[]) => void;
}

const amountFields = ['baseImponible', 'igv', 'total'] as const;
const amountLabels = { baseImponible: 'Base imponible', igv: 'IGV', total: 'Total' };

export const SireComprobantesTable = ({ comprobantes, showFeedback, onChange }: Props) => {
  const updateRow = (index: number, patch: Partial<ComprobanteDraft>) => {
    onChange(comprobantes.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Comprobantes del ERP</h2>
          <p className="text-sm text-muted-foreground">Registra los importes locales que deseas conciliar con SIRE.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...comprobantes, {
          tipoComprobante: '01', serie: '', correlativo: '', baseImponible: '', igv: '', total: '',
        }])}>
          <Plus aria-hidden="true" /> Agregar comprobante
        </Button>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Serie</TableHead>
              <TableHead>Correlativo</TableHead>
              {amountFields.map((field) => <TableHead key={field}>{amountLabels[field]}</TableHead>)}
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comprobantes.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <select
                    aria-label={`Tipo comprobante ${index + 1}`}
                    className="h-8 rounded-lg border border-input bg-background px-2"
                    value={row.tipoComprobante}
                    onChange={(event) => updateRow(index, { tipoComprobante: event.target.value as ComprobanteDraft['tipoComprobante'] })}
                  >
                    {['01', '03', '07', '08'].map((type) => <option key={type}>{type}</option>)}
                  </select>
                </TableCell>
                <TableCell><Input aria-label={`Serie ${index + 1}`} value={row.serie} onChange={(event) => updateRow(index, { serie: event.target.value })} /></TableCell>
                <TableCell><Input aria-label={`Correlativo ${index + 1}`} value={row.correlativo} onChange={(event) => updateRow(index, { correlativo: event.target.value })} /></TableCell>
                {amountFields.map((field) => {
                  const feedback = showFeedback ? getAmountFeedback(row[field]) : null;
                  return (
                    <TableCell key={field}>
                      <Input
                        aria-label={`${amountLabels[field]} ${index + 1}`}
                        aria-invalid={!!feedback}
                        inputMode="decimal"
                        value={row[field]}
                        onChange={(event) => updateRow(index, { [field]: event.target.value })}
                      />
                      {feedback && <span className="text-xs text-amber-700">{feedback}</span>}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar comprobante ${index + 1}`}
                    onClick={() => onChange(comprobantes.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!comprobantes.length && (
              <TableRow><TableCell colSpan={7} align="center">Agrega los comprobantes locales que deseas conciliar.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
