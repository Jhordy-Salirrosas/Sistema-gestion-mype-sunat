/**
 * Persistencia de estado y auditoría del worker de facturación (M1).
 *
 * Se separa de `invoiceWorkerService` para que ese archivo contenga solo la
 * orquestación del pipeline y respete el límite de líneas del proyecto. El
 * cliente Prisma se recibe como dependencia para poder simularlo en pruebas.
 */

export interface PrismaUpdatable {
  invoice?: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  transactionHistory?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/** Actualiza el estado del comprobante y guarda el XML firmado si existe. */
export const actualizarEstadoInvoice = async (
  prisma: unknown,
  id: string,
  status: string,
  signedXml?: string,
): Promise<void> => {
  const client = prisma as PrismaUpdatable;
  if (!client?.invoice?.update) return;

  await client.invoice
    .update({
      where: { id },
      data: {
        estado: status,
        ...(signedXml ? { xml_storage_url: signedXml } : {}),
      },
    })
    .catch(() => null);
};

/** Registra una transición de estado en el historial de auditoría. */
export const registrarAuditoria = async (
  prisma: unknown,
  invoiceId: string,
  intento: number,
  estadoAnterior: string,
  estadoNuevo: string,
  codigoError: string,
  mensajeError: string,
  tiempoMs = 0,
): Promise<void> => {
  const client = prisma as PrismaUpdatable;
  if (!client?.transactionHistory?.create) return;

  await client.transactionHistory
    .create({
      data: {
        invoice_id: invoiceId,
        intento,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        codigo_error: codigoError,
        mensaje_error: mensajeError,
        tiempo_respuesta_ms: tiempoMs,
      },
    })
    .catch(() => null);
};
