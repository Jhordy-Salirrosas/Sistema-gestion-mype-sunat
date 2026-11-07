import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  Input,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { accountingApi } from '../services/accountingApi';

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};


const normalizarPeriodo = (value: string): string => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : value;
};

export default function AccountingTrialBalancePage() {
  const [period, setPeriod] = useState(periodoActual);
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-trial-balance', period],
    queryFn: () => accountingApi.getTrialBalance(period),
  });

  return (
    <Page>
      <PageHeader
        title="Balance de Comprobación"
        description="Sumas y saldos por cuenta del período, con validación de partida doble"
      />

      <Card className="mb-4">
        <div className="p-4 flex items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Período</label>
            <Input type="month" value={period} onChange={(event) => setPeriod(normalizarPeriodo(event.target.value))} />
          </div>
          <Badge
            variant={
              !data
                ? 'outline'
                : Math.abs(data.totalDebit - data.totalCredit) < 0.01
                  ? 'outline'
                  : 'destructive'
            }
          >
            {!data
              ? 'Sin datos'
              : Math.abs(data.totalDebit - data.totalCredit) < 0.01
                ? 'Cuadrado'
                : 'Descuadrado'}
          </Badge>
        </div>
      </Card>

      {error ? (
        <Card className="p-4 mb-4 text-sm text-destructive">
          No se pudo cargar el balance. Verifica el período.
        </Card>
      ) : null}

      <Card flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Denominación</TableHead>
              <TableHead align="right">Debe</TableHead>
              <TableHead align="right">Haber</TableHead>
              <TableHead align="right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando balance…</TableCell>
              </TableRow>
            ) : !data || data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No hay movimientos en el período.</TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow key={row.accountCode}>
                  <TableCell className="font-mono font-semibold">{row.accountCode}</TableCell>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell align="right">{row.debit.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.credit.toFixed(2)}</TableCell>
                  <TableCell align="right" className="font-medium">{row.balance.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data ? (
        <div className="mt-4 flex justify-end gap-6 text-sm font-semibold">
          <span>Total debe: S/ {data.totalDebit.toFixed(2)}</span>
          <span>Total haber: S/ {data.totalCredit.toFixed(2)}</span>
        </div>
      ) : null}
    </Page>
  );
}
