import { useState, type FormEvent } from 'react';
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
  Input,
  Page,
  PageHeader,
} from '@/components/ui';
import { ArrowRight, LoaderCircle, Upload } from 'lucide-react';
import { sireApi } from '../services/sireApi';
import type { ImportSireProposalResponse, SireBookType } from '../types/sire.types';

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function SireImportPage() {
  const [period, setPeriod] = useState(currentPeriod);
  const [bookType, setBookType] = useState<SireBookType>('RVIE_VENTAS');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSireProposalResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!/^(?!0000)\d{4}(0[1-9]|1[0-2])$/.test(period)) {
      setError('Ingresa un periodo válido con formato YYYYMM.');
      return;
    }
    if (!file) {
      setError('Selecciona el archivo TXT de la propuesta.');
      return;
    }
    if (!/\.txt$/i.test(file.name)) {
      setError('Solo se permiten archivos .txt.');
      return;
    }
    if (file.size === 0) {
      setError('El archivo está vacío.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no debe superar los 5 MiB.');
      return;
    }

    setLoading(true);
    try {
      setResult(await sireApi.importProposal({ period, bookType }, file));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Ocurrió un error inesperado al importar la propuesta.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Importar propuesta SIRE"
        description="Selecciona el periodo fiscal y prepara la propuesta de SUNAT."
      />
      <Alert variant="info">
        <AlertTitle>Formato provisional de pruebas</AlertTitle>
        <AlertDescription>
          La importación usa un formato interno provisional de 9 columnas y no el layout oficial SUNAT. No uses este
          flujo para cargar archivos oficiales. Formato sujeto a cambios según resolución oficial de SUNAT.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Archivo de propuesta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <label className="block max-w-xs space-y-1.5 text-sm font-medium">
              Periodo fiscal (YYYYMM)
              <Input
                aria-label="Periodo fiscal (YYYYMM)"
                inputMode="numeric"
                maxLength={6}
                placeholder="202610"
                value={period}
                disabled={loading}
                onChange={(event) => setPeriod(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm font-medium">
              Libro
              <select
                aria-label="Libro"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={bookType}
                disabled={loading}
                onChange={(event) => {
                  if (event.target.value === 'RVIE_VENTAS' || event.target.value === 'RCE_COMPRAS') {
                    setBookType(event.target.value);
                  }
                }}
              >
                <option value="RVIE_VENTAS">RVIE · Ventas</option>
                <option value="RCE_COMPRAS">RCE · Compras</option>
              </select>
            </label>
            <Input
              aria-label="Archivo TXT provisional"
              key={file?.name ?? 'no-file'}
              type="file"
              accept=".txt,text/plain"
              disabled={loading}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
                setResult(null);
              }}
            />
            {file && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{file.name} · {(file.size / 1024).toFixed(1)} KB</span>
                <Button type="button" variant="link" className="px-1" disabled={loading} onClick={() => setFile(null)}>
                  Cancelar selección
                </Button>
              </div>
            )}
            <Button type="submit" disabled={loading || !file}>
              {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              {loading ? 'Importando…' : 'Importar propuesta'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Formato esperado: RUC|tipo|serie|correlativo|fecha (YYYY-MM-DD)|base|IGV|total|CAR. Máximo 5 MiB.
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo importar la propuesta</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && (
            <Alert variant={result.rejected > 0 ? 'warning' : 'success'}>
              <AlertTitle>Importación completada</AlertTitle>
              <AlertDescription>
                Se importaron {result.imported} filas y se rechazaron {result.rejected}.
                {result.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {result.errors.map((item) => (
                      <li key={`${item.line}-${item.reason}`}>
                        Línea {item.line}: {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
          <Button variant="link" asChild className="px-0">
            <Link to="/sire/conciliacion">
              Ir a conciliación disponible <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
}
