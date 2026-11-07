import { useState } from 'react';
import { Button, Card, Input, Page, PageHeader } from '@/components/ui';
import { Download, FileCheck2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';

export default function AccountingPlePage() {
  const { activeCompany, user } = useAuthStore();
  const companyId = activeCompany?.tenantId ?? user?.companyId ?? '';
  const companyRuc = activeCompany?.ruc ?? user?.companyRuc ?? '';
  const [isDownloadingDiario, setIsDownloadingDiario] = useState(false);
  const [isDownloadingMayor, setIsDownloadingMayor] = useState(false);
  const [period, setPeriod] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [error, setError] = useState<string | null>(null);

  // Función unificada para consultar al Backend y descargar la trama real
  const handleExportPle = async (bookCode: '050100' | '060100') => {
    const setLoader = bookCode === '050100' ? setIsDownloadingDiario : setIsDownloadingMayor;
    setLoader(true);
    setError(null);

    try {
      const response = await apiClient.post('/accounting/ple/export', {
        companyId,
        companyRuc,
        year: Number(period.slice(0, 4)),
        month: Number(period.slice(5, 7)),
        bookCode,
      });

      const { fileName, content } = response.data;
      if (!fileName || !content) {
        throw new Error('El backend no devolvió una trama PLE válida');
      }
      downloadTxtFile(fileName, content);
    } catch (error) {
      console.error('Error al exportar trama PLE:', error);
      setError('No se pudo generar el PLE del período seleccionado.');
    } finally {
      setLoader(false);
    }
  };

  const downloadTxtFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader
        title="Libros Electrónicos (PLE / SIRE)"
        description="Generación de estructuras y tramas oficiales PLE 5.1 / SIRE para presentación tributaria ante SUNAT"
      />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="periodo-ple"
            >
              Período a exportar
            </label>
            <Input
              id="periodo-ple"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-44"
            />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            La trama se genera con los asientos del período seleccionado.
          </p>
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Libro Diario 5.1 */}
        <Card className="p-5 space-y-3 border">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-base">Libro Diario 5.1 (PLE)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Estructura de asientos contables del periodo fiscal activo en formato texto plano `.txt`.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleExportPle('050100')}
            disabled={isDownloadingDiario}
          >
            {isDownloadingDiario ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isDownloadingDiario ? 'Generando Trama...' : 'Descargar Libro Diario 5.1'}
          </Button>
        </Card>

        {/* Libro Mayor 6.1 */}
        <Card className="p-5 space-y-3 border">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-base">Libro Mayor 6.1 (PLE)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Centralización de saldos acumulados por código de cuenta contable del mes.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleExportPle('060100')}
            disabled={isDownloadingMayor}
          >
            {isDownloadingMayor ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isDownloadingMayor ? 'Generando Trama...' : 'Descargar Libro Mayor 6.1'}
          </Button>
        </Card>
      </div>
    </Page>
  );
}