/**
 * Validación del tipo de comprobante antes de generar el XML (M1).
 *
 * Se separa de `ublGeneratorService` para que ese archivo contenga solo el
 * ensamblado del documento y respete el límite de líneas del proyecto.
 */
import { BadRequestException } from '@nestjs/common';
import { esTipoUbl, esTipoResumen } from './sunatCatalogsQuery';

/**
 * Verifica que el tipo del Catálogo 01 se emita como documento UBL individual.
 *
 * Las comunicaciones de baja (RA) y los resúmenes diarios (RC) no llevan
 * líneas ni firma por comprobante: se envían por otro canal, por lo que
 * generarlos como <Invoice> produciría un rechazo de SUNAT.
 */
export const asegurarTipoUbl = (tipo: string): void => {
  if (esTipoResumen(tipo)) {
    throw new BadRequestException(
      `El tipo '${tipo}' debe enviarse como resumen o comunicación de baja`,
    );
  }

  if (!esTipoUbl(tipo)) {
    throw new BadRequestException(
      `El tipo de comprobante '${tipo}' no se emite como documento UBL individual`,
    );
  }
};

/** Raíz UBL que corresponde al tipo de comprobante. */
export const raizDe = (tipo: string): 'Invoice' | 'CreditNote' | 'DebitNote' => {
  if (tipo === '07') return 'CreditNote';
  if (tipo === '08') return 'DebitNote';
  return 'Invoice';
};
