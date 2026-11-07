import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { ArrowRight, History, LoaderCircle } from 'lucide-react';
import { sireApi } from '../services/sireApi';
import type { SireHistoryResponse } from '../types/sire.types';

const PAGE_SIZE = 20;

export default function SireHistoryPage() {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<SireHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = !history && !error;

  useEffect(() => {
    let active = true;
    sireApi.getHistory(page, PAGE_SIZE)
      .then((response) => {
        if (active) setHistory(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo consultar el historial SIRE.');
        }
      })
    return () => {
      active = false;
    };
  }, [page]);

  const pageCount = history ? Math.max(1, Math.ceil(history.total / PAGE_SIZE)) : 1;

  return (
    <Page>
      <PageHeader
        title="Historial SIRE"
        description="Consulta los periodos fiscales conciliados y cerrados."
      />
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar el historial</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card flush>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History aria-hidden="true" /> Periodos fiscales</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Libro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead align="right">Cumplimiento</TableHead>
                <TableHead>Fecha de conciliación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Cargando historial…</span>
                  </TableCell>
                </TableRow>
              ) : history?.items.length ? history.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.period}</TableCell>
                  <TableCell>{item.bookType === 'RVIE' ? 'RVIE · Ventas' : 'RCE · Compras'}</TableCell>
                  <TableCell>{item.status === 'CERRADO' ? 'Cerrado' : item.status}</TableCell>
                  <TableCell align="right">{item.complianceRate.toFixed(2)}%</TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleDateString('es-PE')}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {error ? 'No se pudo obtener el historial.' : 'Aún no hay periodos cerrados.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {history ? `${history.total} periodos · Página ${page} de ${pageCount}` : ''}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => {
            setHistory(null);
            setError(null);
            setPage((value) => value - 1);
          }}>
            Anterior
          </Button>
          <Button type="button" variant="outline" disabled={loading || page >= pageCount} onClick={() => {
            setHistory(null);
            setError(null);
            setPage((value) => value + 1);
          }}>
            Siguiente
          </Button>
        </div>
      </div>
      <Button variant="outline" asChild>
        <Link to="/sire/conciliacion">Ir a conciliación <ArrowRight aria-hidden="true" /></Link>
      </Button>
    </Page>
  );
}
