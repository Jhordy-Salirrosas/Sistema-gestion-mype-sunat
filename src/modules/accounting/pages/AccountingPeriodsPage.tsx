import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Lock, Unlock } from 'lucide-react';
import {
  Badge,
  Button,
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

const today = new Date();

export default function AccountingPeriodsPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [error, setError] = useState<string | null>(null);

  const { data: periods = [], isLoading, error: queryError } = useQuery({
    queryKey: ['accounting-periods'],
    queryFn: () => accountingApi.getPeriods(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });

  const openPeriod = useMutation({
    mutationFn: ({ y, m }: { y: number; m: number }) => accountingApi.openPeriod(y, m),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: () => setError('No se pudo abrir el período. Verifica la empresa activa.'),
  });

  const closePeriod = useMutation({
    mutationFn: (period: string) => accountingApi.closePeriod(period),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: () => setError('No se pudo cerrar el período.'),
  });

  return (
    <Page>
      <PageHeader
        title="Períodos contables"
        description="Abre y cierra los meses contables. Un período cerrado no admite asientos nuevos."
      />

      <Card className="mb-4">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Año</label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mes</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="w-24"
            />
          </div>
          <Button onClick={() => openPeriod.mutate({ y: year, m: month })} disabled={openPeriod.isPending}>
            <Unlock className="w-4 h-4 mr-1" />
            {openPeriod.isPending ? 'Abriendo…' : 'Abrir período'}
          </Button>
        </div>
      </Card>

      {error || queryError ? (
        <Card className="p-4 mb-4 text-sm text-destructive">
          {error ?? 'No se pudieron cargar los períodos.'}
        </Card>
      ) : null}

      <Card flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Año / mes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Abierto</TableHead>
              <TableHead>Cerrado</TableHead>
              <TableHead align="right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>Cargando períodos…</TableCell>
              </TableRow>
            ) : periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  No hay períodos. Abre el primero con el formulario de arriba.
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
                <TableRow key={period.period}>
                  <TableCell className="font-mono font-bold">{period.period}</TableCell>
                  <TableCell>
                    {period.year} / {String(period.month).padStart(2, '0')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={period.status === 'ABIERTO' ? 'outline' : 'secondary'}>
                      {period.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(period.openedAt).toLocaleDateString('es-PE')}</TableCell>
                  <TableCell>
                    {period.closedAt ? new Date(period.closedAt).toLocaleDateString('es-PE') : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {period.status === 'ABIERTO' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => closePeriod.mutate(period.period)}
                        disabled={closePeriod.isPending}
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        Cerrar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPeriod.mutate({ y: period.year, m: period.month })}
                        disabled={openPeriod.isPending}
                      >
                        <CalendarDays className="w-3.5 h-3.5 mr-1" />
                        Reabrir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </Page>
  );
}
