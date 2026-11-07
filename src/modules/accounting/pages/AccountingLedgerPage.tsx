import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import {
  Badge,
  Card,
  Input,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const money = (value: number) => `S/ ${value.toFixed(2)}`;
const normalizarPeriodo = (value: string): string => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : value;
};


export default function AccountingLedgerPage() {
  const [period, setPeriod] = useState(periodoActual);
  const [accountCode, setAccountCode] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => accountingApi.getAccounts(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-ledger', period, accountCode],
    queryFn: () => accountingApi.getLedger(period, accountCode),
    enabled: Boolean(accountCode),
  });

  const movements = useMemo(() => data?.movements ?? [], [data]);

  return (
    <Page>
      <PageHeader
        title="Libro Mayor"
        description="Movimientos de una cuenta del PCGE con saldo acumulado por período"
      />

      <Card className="mb-4">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Período</label>
            <Input type="month" value={period} onChange={(event) => setPeriod(normalizarPeriodo(event.target.value))} />
          </div>
          <div className="space-y-1.5 min-w-72">
            <label className="text-xs font-medium">Cuenta contable</label>
            <Select value={accountCode || undefined} onValueChange={setAccountCode}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta PCGE" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.code} value={account.code}>
                    {account.code} · {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {data ? (
        <div className="grid gap-3 md:grid-cols-4 mb-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Cuenta</p>
            <p className="font-mono font-semibold">{data.accountCode}</p>
            <p className="text-sm">{data.accountName}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Debe</p>
            <p className="text-xl font-semibold">{money(data.totalDebit)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Haber</p>
            <p className="text-xl font-semibold">{money(data.totalCredit)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Saldo final</p>
            <p className="text-xl font-semibold">{money(data.closingBalance)}</p>
          </Card>
        </div>
      ) : null}

      {error ? (
        <Card className="p-4 mb-4 text-sm text-destructive">
          No se pudo cargar el libro mayor. Verifica el período y la cuenta.
        </Card>
      ) : null}

      <Card flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Asiento</TableHead>
              <TableHead>Glosa</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead align="right">Debe</TableHead>
              <TableHead align="right">Haber</TableHead>
              <TableHead align="right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!accountCode ? (
              <TableRow>
                <TableCell colSpan={7}>Selecciona una cuenta para ver sus movimientos.</TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>Cargando movimientos…</TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No hay movimientos para esa cuenta en el período.</TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={`${movement.entryId}-${movement.entryNumber}`}>
                  <TableCell>{movement.entryDate}</TableCell>
                  <TableCell className="font-mono">{movement.entryNumber}</TableCell>
                  <TableCell>{movement.glosa}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{movement.sourceModule}</Badge>
                  </TableCell>
                  <TableCell align="right">{movement.debit.toFixed(2)}</TableCell>
                  <TableCell align="right">{movement.credit.toFixed(2)}</TableCell>
                  <TableCell align="right" className="font-medium">{movement.saldo.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!accountCode ? (
        <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          El saldo inicial del período es S/ 0.00; el saldo se acumula con cada movimiento.
        </p>
      ) : null}
    </Page>
  );
}
