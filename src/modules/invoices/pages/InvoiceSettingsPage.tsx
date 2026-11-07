import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Page,
  PageHeader,
  PageText,
} from '@/components/ui';
import { InvoiceSettingsTab } from '../components/InvoiceSettingsTab';
import { InvoiceConfigChecklist } from '../components/InvoiceConfigChecklist';
import { InvoiceStorageNote } from '../components/InvoiceStorageNote';
import { invoicesApi } from '../services/invoicesApi';
import { useInvoiceConfig } from '../hooks/useInvoiceConfig';
import { useAuthStore } from '@/stores/authStore';
import { invoiceConfigError } from '../lib/invoiceConfigError';

export default function InvoiceSettingsPage() {
  // El RUC sale de la empresa ACTIVA de la sesión y no de un campo del
  // formulario: la identidad fiscal no se cambia desde aquí (invalidaría los
  // comprobantes ya emitidos).
  const ruc = (useAuthStore((state) => state.activeCompany?.ruc) ?? '').trim();

  const { data, error, cargando, guardar } = useInvoiceConfig(ruc);

  /**
   * Aceptados de la empresa, para la nota de almacenamiento (D1, resto).
   *
   * El checklist no dice cuántos XML hay guardados y el listado tampoco expone
   * ese dato, así que la nota NO promete una cifra que no puede sostener: usa
   * los ACEPTADOS, que son justamente los que tienen CDR por definición (si
   * SUNAT respondió, respondió con un CDR).
   */
  const { data: metricas } = useQuery({
    queryKey: ['invoices', 'metrics', 'configuracion'],
    queryFn: () => invoicesApi.getMetrics(),
    staleTime: 1000 * 60 * 5,
  });

  const aceptados = metricas?.aceptados ?? 0;


  return (
    <Page>
      <PageHeader
        title="Configuración de Facturación Electrónica"
        description="Entorno de SUNAT, series con correlativo propio y estado de las credenciales para emitir"
      >
        <PageText variant="caption" className="text-muted-foreground">
          {cargando ? 'Consultando configuración…' : `Empresa ${ruc || 'sin RUC en sesión'}`}
        </PageText>
      </PageHeader>

      {/*
        Si el backend no responde, se dice. Mostrar el formulario vacío haría
        creer que la empresa no tiene series configuradas, que es una
        conclusión muy distinta y llevaría a corregir algo que no está roto.
      */}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo leer la configuración</AlertTitle>
          <AlertDescription>
            {invoiceConfigError(error)}{' '}
            Los valores del formulario pueden estar incompletos.
          </AlertDescription>
        </Alert>
      ) : null}

      {/*
        D1: el checklist del backend, que antes se descartaba.
        `useInvoiceConfig` ya traía `checklist` y `listo_para_emitir`; la
        pantalla solo pintaba el RUC y las series, así que el usuario no tenía
        forma de saber si SUNAT aceptaría sus comprobantes.
      */}
      {data && <InvoiceConfigChecklist config={data} />}

      <InvoiceStorageNote aceptados={aceptados} />

      <InvoiceSettingsTab
        ruc={ruc}
        configuracion={data}
        onGuardar={guardar}
        series={data?.series ?? []}
      />
    </Page>
  );
}
