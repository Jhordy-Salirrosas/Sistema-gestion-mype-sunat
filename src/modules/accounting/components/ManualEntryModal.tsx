import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { accountingApi } from '../services/accountingApi';
import { enqueueAccountingEntry } from '@/lib/outbox';
import type { AccountingAccount } from '../types/accounting.types';

interface LineDraft {
  accountCode: string;
  debit: string;
  credit: string;
}

interface ManualEntryModalProps {
  open: boolean;
  period: string;
  onClose: () => void;
  onSaved: () => void;
}

const money = (value: number) => Math.round(value * 100) / 100;

export default function ManualEntryModal({ open, period, onClose, onSaved }: ManualEntryModalProps) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [glosa, setGlosa] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { accountCode: '', debit: '', credit: '' },
    { accountCode: '', debit: '', credit: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => accountingApi.getAccounts(),
    enabled: open,
  });

  const accountsByCode = useMemo(
    () => new Map(accounts.map((account) => [account.code, account])),
    [accounts],
  );

  useEffect(() => {
    if (!open || accounts.length === 0) return;
    setLines((prev) => {
      if (prev.some((line) => line.accountCode)) return prev;
      return [
        { accountCode: '1211', debit: '', credit: '' },
        { accountCode: '7011', debit: '', credit: '' },
      ];
    });
  }, [accounts, open]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return { debit: money(debit), credit: money(credit), balanced: Math.abs(debit - credit) < 0.001 };
  }, [lines]);

  if (!open) return null;

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, { accountCode: '', debit: '', credit: '' }]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!glosa.trim()) {
      setError('La glosa es obligatoria.');
      return;
    }
    if (!totals.balanced || totals.debit <= 0) {
      setError('El asiento debe estar cuadrado y tener un monto mayor que cero.');
      return;
    }
    if (lines.some((line) => !line.accountCode)) {
      setError('Todas las líneas deben tener una cuenta PCGE.');
      return;
    }

    const payload = {
      period,
      entryDate,
      glosa: glosa.trim(),
      sourceModule: 'MANUAL',
      lines: lines.map((line, index) => {
        const account = accountsByCode.get(line.accountCode);
        return {
          lineOrder: index + 1,
          accountCode: line.accountCode,
          accountName: account?.name ?? line.accountCode,
          debitAmount: Number(line.debit) || 0,
          creditAmount: Number(line.credit) || 0,
        };
      }),
    };

    setSaving(true);
    try {
      await accountingApi.createEntry(payload);
      setGlosa('');
      setLines([
        { accountCode: '1211', debit: '', credit: '' },
        { accountCode: '7011', debit: '', credit: '' },
      ]);
      onSaved();
      onClose();
    } catch (error) {
      const sinRespuesta =
        !navigator.onLine ||
        (error instanceof Error && 'response' in error && !(error as { response?: unknown }).response);
      if (sinRespuesta) {
        await enqueueAccountingEntry(payload);
        setError('Sin conexión: el asiento quedó guardado y se enviará al reconectar.');
        return;
      }
      setError('No se pudo registrar el asiento. Revisa el período y las cuentas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full p-6 shadow-xl relative text-card-foreground space-y-4 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-lg font-semibold tracking-tight">Nuevo asiento contable</h3>
          <p className="text-sm text-muted-foreground">
            Registra un asiento manual del período {period}. El número se asigna automáticamente.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fecha contable</label>
              <Input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Glosa / concepto</label>
              <Input
                placeholder="Ej. Ajuste por diferencia de caja"
                value={glosa}
                onChange={(event) => setGlosa(event.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Cuenta contable</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-right p-2 w-28">Debe (S/)</th>
                  <th className="text-right p-2 w-28">Haber (S/)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const account = accountsByCode.get(line.accountCode);
                  return (
                    <tr key={`line-${index}`} className="border-t">
                      <td className="p-2 min-w-52">
                        <Select
                          value={line.accountCode || undefined}
                          onValueChange={(value) => updateLine(index, { accountCode: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cuenta" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((accountOption: AccountingAccount) => (
                              <SelectItem key={accountOption.code} value={accountOption.code}>
                                {accountOption.code} · {accountOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {account?.name ?? 'Selecciona una cuenta'}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.debit}
                          onChange={(event) => updateLine(index, { debit: event.target.value, credit: '' })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.credit}
                          onChange={(event) => updateLine(index, { credit: event.target.value, debit: '' })}
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                          aria-label="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-1" />
              Agregar línea
            </Button>
            <div className={`text-sm font-semibold ${totals.balanced ? 'text-emerald-600' : 'text-destructive'}`}>
              Debe: S/ {totals.debit.toFixed(2)} · Haber: S/ {totals.credit.toFixed(2)}
              {totals.balanced ? ' · cuadrado' : ' · descuadrado'}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving || !totals.balanced}>
              {saving ? 'Registrando…' : 'Registrar asiento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
